import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
export function acceptanceFingerprint(ref) {
  if (ref && !/^[a-f0-9]{40}$/.test(ref))
    throw Error("Acceptance source must be a full commit SHA");
  const read = (path) =>
    (ref
      ? execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" })
      : readFileSync(path, "utf8")
    ).replaceAll("\r\n", "\n");
  const stable = JSON.parse(read("src-tauri/tauri.conf.json")),
    nightly = JSON.parse(read("src-tauri/tauri.nightly.conf.json"));
  const nsis = (config) => {
    const section = config.bundle?.windows?.nsis ?? {};
    const hooks = section.installerHooks ?? "";
    const relative = hooks.replace(/^\.\//, "");
    if (hooks && !/^[A-Za-z0-9._/-]+$/.test(relative))
      throw Error("Installer hook path must stay inside src-tauri");
    return {
      installMode: section.installMode ?? "currentUser",
      installerHooks: hooks,
      hookSource: hooks ? read(`src-tauri/${relative}`) : "",
    };
  };
  return createHash("sha256")
    .update(
      JSON.stringify({
        backend: read("src-tauri/src/updates.rs"),
        verifier: read("scripts/updater/manifest.mjs"),
        stable: {
          id: stable.identifier,
          updater: stable.plugins.updater,
          nsis: nsis(stable),
        },
        nightly: {
          id: nightly.identifier,
          updater: nightly.plugins.updater,
          nsis: nsis(nightly),
        },
      }),
    )
    .digest("hex");
}
export function requireAcceptance() {
  const actual = acceptanceFingerprint();
  if (
    !process.env.UPDATER_ACCEPTANCE_FINGERPRINT ||
    process.env.UPDATER_ACCEPTANCE_FINGERPRINT !== actual
  )
    throw Error(
      "Publish blocked: an installed signed-upgrade acceptance test is required for this updater configuration and key",
    );
  return actual;
}
