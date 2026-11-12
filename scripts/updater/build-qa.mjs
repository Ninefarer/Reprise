import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { stageManifest } from "./manifest.mjs";

if (
  !process.env.TAURI_SIGNING_PRIVATE_KEY ||
  !process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD
)
  throw Error("Signing secrets must be present only in this build step");
const temp = mkdtempSync(join(tmpdir(), "reprise-updater-build-"));
const base = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const output = resolve("artifacts/updater-qa");
for (const step of [0, 1]) {
  const version = `3.3.2-nightly.20261112.${900 + step}`;
  const config = {
    identifier: "com.reprise.updater.qa",
    productName: "Reprise Updater QA",
    version,
    app: {
      windows: base.app.windows.map((w) => ({
        ...w,
        title: w.label === "main" ? "Reprise Updater QA" : w.title,
      })),
    },
    plugins: {
      updater: {
        endpoints: ["http://127.0.0.1:43187/latest.json"],
        pubkey: base.plugins.updater.pubkey,
        requireSignedVersion: true,
        dangerousInsecureTransportProtocol: true,
        windows: { installMode: "passive" },
      },
    },
  };
  const file = join(temp, `qa-${step}.json`);
  writeFileSync(file, JSON.stringify(config));
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/@tauri-apps/cli/tauri.js",
      "build",
      "--debug",
      "--features",
      "updater-e2e",
      "--config",
      file,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  const dir = "src-tauri/target/debug/bundle/nsis";
  const name = readdirSync(dir).find(
    (n) => n.includes(version) && n.endsWith("_x64-setup.exe"),
  );
  if (!name) throw Error("Signed QA installer not found");
  const staged = join(output, step === 0 ? "old" : "new");
  const meta = stageManifest({
    installer: join(dir, name),
    version,
    channel: "nightly",
    output: staged,
    qa: true,
    notes: "Signed updater acceptance test.",
  });
  mkdirSync(output, { recursive: true });
  copyFileSync(join(dir, name), join(output, `qa-${step}-setup.exe`));
  console.log(
    `Signed and independently verified QA build ${step}: ${meta.hash}`,
  );
}
