import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateVersion, verifyInstaller } from "./manifest.mjs";
test("manifest versions enforce channel separation", () => {
  validateVersion("3.3.2", "stable");
  validateVersion("3.3.2-nightly.20261112.1", "nightly");
  for (const [v, c] of [
    ["3.3.2-nightly.1", "stable"],
    ["3.3.2", "nightly"],
    ["03.3.2", "stable"],
    ["3.3.2-nightly.01", "nightly"],
    ["garbage", "stable"],
  ])
    assert.throws(() => validateVersion(v, c));
});
const dir = "artifacts/updater-qa/new";
test(
  "real signed installer rejects tampering, wrong versions and changed trusted comments",
  { skip: !existsSync(dir) },
  () => {
    const name = readdirSync(dir).find((n) => n.endsWith("_x64-setup.exe"));
    const bytes = readFileSync(join(dir, name)),
      signature = readFileSync(join(dir, name + ".sig"), "utf8").trim();
    const pub = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
      .plugins.updater.pubkey;
    const manifest = JSON.parse(readFileSync(join(dir, "latest.json"), "utf8"));
    verifyInstaller(bytes, signature, pub, manifest.version);
    const changed = Buffer.from(bytes);
    changed[0] ^= 1;
    assert.throws(() =>
      verifyInstaller(changed, signature, pub, manifest.version),
    );
    assert.throws(() =>
      verifyInstaller(bytes, signature, pub, "99.0.0-nightly.1"),
    );
    const text = Buffer.from(signature, "base64")
      .toString("utf8")
      .replace(`version:${manifest.version}`, "version:99.0.0-nightly.1");
    assert.throws(() =>
      verifyInstaller(
        bytes,
        Buffer.from(text).toString("base64"),
        pub,
        "99.0.0-nightly.1",
      ),
    );
  },
);
