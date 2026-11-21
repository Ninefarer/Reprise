import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const version = JSON.parse(read("src-tauri/tauri.conf.json")).version;
assert.equal(
  JSON.parse(read("package.json")).version,
  version,
  "package version",
);
assert.equal(
  JSON.parse(read("package-lock.json")).packages[""].version,
  version,
  "lock version",
);
assert.equal(
  read("src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1],
  version,
  "Rust version",
);
assert.equal(
  read("src-tauri/Cargo.lock").match(
    /\[\[package\]\]\s+name = "reprise"\s+version = "([^"]+)"/,
  )?.[1],
  version,
  "Rust lock version",
);
const nightly = JSON.parse(read("src-tauri/tauri.nightly.conf.json"));
assert.equal(nightly.identifier, "com.reprise.nightly", "Nightly identity");
assert.equal(
  JSON.parse(read("src-tauri/tauri.conf.json")).identifier,
  "com.reprise.desktop",
  "Stable identity",
);
assert.ok(
  nightly.version.includes("-nightly."),
  "Nightly version must be a prerelease",
);
assert.ok(
  read("src/changelog.ts").includes(`version: "${version}"`),
  "Missing installed Stable notes",
);
assert.ok(
  read("docs/releases/" + version + ".md").trim(),
  "Missing publication notes",
);
console.log("Stable metadata consistent: " + version);
