import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { stageManifest, validateVersion } from "./manifest.mjs";
import { acceptanceFingerprint, requireAcceptance } from "./acceptance.mjs";
const channel = process.argv[2];
const base = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const config =
  channel === "nightly"
    ? JSON.parse(readFileSync("src-tauri/tauri.nightly.conf.json", "utf8"))
    : base;
const version = config.version;
validateVersion(version, channel);
if (
  config.identifier !==
  (channel === "nightly" ? "com.reprise.nightly" : "com.reprise.desktop")
)
  throw Error("Release application identity mismatch");
if (
  base.plugins.updater.requireSignedVersion !== true ||
  base.bundle.createUpdaterArtifacts !== true
)
  throw Error("Signed update artifacts and versions are mandatory");
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const allowed = spawnSync("git", [
  "merge-base",
  "--is-ancestor",
  source,
  channel === "stable" ? "origin/main" : "origin/develop",
]);
if (allowed.status !== 0)
  throw Error("Release source must belong to its approved channel branch");
if (process.env.PUBLISH_RELEASE === "true") requireAcceptance();
const notesFile = `docs/releases/${version}.md`;
const notes = readFileSync(notesFile, "utf8");
if (
  channel === "stable" &&
  /^##?\s+(Implementation|Validation|Known limitations)/im.test(notes)
)
  throw Error("Stable notes contain a developer-only section");
const args = ["node_modules/@tauri-apps/cli/tauri.js", "build"];
if (channel === "nightly")
  args.push("--config", "src-tauri/tauri.nightly.conf.json");
const build = spawnSync(process.execPath, args, { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const dir = "src-tauri/target/release/bundle/nsis";
const filename = readdirSync(dir).find(
  (n) => n.includes(`_${version}_`) && n.endsWith("_x64-setup.exe"),
);
if (!filename) throw Error("Release installer missing");
const output = resolve(`artifacts/release-${channel}-${version}`);
const meta = stageManifest({
  installer: join(dir, filename),
  version,
  channel,
  output,
  notes,
});
writeFileSync(
  join(output, "release-metadata.json"),
  JSON.stringify(
    { ...meta, source, acceptance: acceptanceFingerprint() },
    null,
    2,
  ) + "\n",
);
// Detect accidental exact credential inclusion before anything becomes an Actions artifact.
for (const file of readdirSync(output)) {
  const bytes = readFileSync(join(output, file));
  for (const name of [
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ]) {
    const value = process.env[name];
    if (value && bytes.includes(Buffer.from(value)))
      throw Error(
        "Credential material detected in a staged artifact; upload blocked",
      );
  }
}
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version}\nartifact_dir=${output}\n`,
  );
console.log(`Verified signed ${channel} installer ${version}: ${meta.hash}`);
