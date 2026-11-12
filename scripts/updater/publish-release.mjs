import { readFileSync, readdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { requireAcceptance } from "./acceptance.mjs";
import { verifyInstaller, validateVersion } from "./manifest.mjs";
const dir = process.argv[2];
const meta = JSON.parse(
  readFileSync(join(dir, "release-metadata.json"), "utf8"),
);
const acceptance = requireAcceptance();
validateVersion(meta.version, meta.channel);
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (meta.source !== source || meta.acceptance !== acceptance)
  throw Error("Staged release does not match tested source");
const manifest = JSON.parse(readFileSync(join(dir, "latest.json"), "utf8"));
const pub = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
  .plugins.updater.pubkey;
verifyInstaller(
  readFileSync(join(dir, meta.name)),
  manifest.platforms["windows-x86_64"].signature,
  pub,
  meta.version,
);
if (
  manifest.version !== meta.version ||
  manifest.platforms["windows-x86_64"].url !==
    `https://github.com/Ninefarer/Reprise/releases/download/v${encodeURIComponent(meta.version)}/${encodeURIComponent(meta.name)}`
)
  throw Error("Manifest URL/version mismatch");
const gh = (args) =>
  execFileSync(
    "gh",
    args[0] === "api" ? args : [...args, "--repo", "Ninefarer/Reprise"],
    {
      encoding: "utf8",
    },
  );
const tag = `v${meta.version}`;
const exists = spawnSync(
  "gh",
  ["release", "view", tag, "--repo", "Ninefarer/Reprise"],
  { stdio: "ignore" },
);
if (exists.status === 0)
  throw Error(
    "Versioned releases are immutable; choose a new version instead of overwriting",
  );
const existingTag = spawnSync(
  "gh",
  ["api", `repos/Ninefarer/Reprise/git/ref/tags/${encodeURIComponent(tag)}`],
  { stdio: "ignore" },
);
if (existingTag.status === 0)
  throw Error("Release tag already exists; refusing to move or reuse it");
const files = readdirSync(dir)
  .filter(
    (n) =>
      n.endsWith(".exe") ||
      n.endsWith(".exe.sig") ||
      n.endsWith(".exe.sha256") ||
      n === "latest.json",
  )
  .map((n) => join(dir, n));
if (files.length !== 4)
  throw Error("Expected installer, signature, checksum and manifest");
const args = [
  "release",
  "create",
  tag,
  ...files,
  "--draft",
  "--verify-tag",
  "--target",
  source,
  "--title",
  `Reprise ${meta.version}${meta.channel === "nightly" ? " Nightly" : ""}`,
  "--notes-file",
  `docs/releases/${meta.version}.md`,
];
if (meta.channel === "nightly") args.push("--prerelease");
// Draft releases may defer implicit tag creation until publication. Verify an
// explicit immutable ref before uploading or publishing the draft.
gh([
  "api",
  "repos/Ninefarer/Reprise/git/refs",
  "--method",
  "POST",
  "-f",
  `ref=refs/tags/${tag}`,
  "-f",
  `sha=${source}`,
]);
gh(args);
const assets = JSON.parse(
  gh(["release", "view", tag, "--json", "assets"]),
).assets;
if (
  assets.length !== 4 ||
  !assets.every((a) => {
    const local = files.find(
      (file) => file.endsWith("/" + a.name) || file.endsWith("\\" + a.name),
    );
    return (
      local &&
      a.digest ===
        "sha256:" +
          createHash("sha256").update(readFileSync(local)).digest("hex")
    );
  })
)
  throw Error(
    "Draft assets could not be verified; release remains unpublished",
  );
const createdTag = JSON.parse(
  gh([
    "api",
    `repos/Ninefarer/Reprise/git/ref/tags/${encodeURIComponent(tag)}`,
  ]),
);
if (createdTag.object.type !== "commit" || createdTag.object.sha !== source)
  throw Error("Draft tag target mismatch; publication blocked");
gh([
  "release",
  "edit",
  tag,
  "--draft=false",
  `--latest=${meta.channel === "stable"}`,
]);
if (meta.channel === "nightly") {
  const pointer = spawnSync(
    "gh",
    ["release", "view", "nightly-updates", "--repo", "Ninefarer/Reprise"],
    { stdio: "ignore" },
  );
  if (pointer.status === 0)
    gh([
      "release",
      "upload",
      "nightly-updates",
      join(dir, "latest.json"),
      "--clobber",
    ]);
  else
    gh([
      "release",
      "create",
      "nightly-updates",
      join(dir, "latest.json"),
      "--prerelease",
      "--latest=false",
      "--target",
      source,
      "--title",
      "Nightly update feed",
      "--notes-file",
      "docs/releases/nightly-feed.md",
    ]);
}
console.log(
  `Published verified ${tag}; ${meta.channel === "stable" ? "Stable is Latest" : "Stable Latest was preserved"}.`,
);
