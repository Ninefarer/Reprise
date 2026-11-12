import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { basename, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export function validateVersion(version, channel) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(
      version,
    );
  if (
    !match ||
    match[4]
      ?.split(".")
      .some((p) => /^\d+$/.test(p) && p.length > 1 && p.startsWith("0"))
  )
    throw Error("Invalid semantic version");
  if (
    !["stable", "nightly"].includes(channel) ||
    (channel === "stable") === !!match[4]
  )
    throw Error("Version does not match release channel");
}
export function verifyInstaller(
  bytes,
  encodedSignature,
  encodedPublicKey,
  version,
) {
  const publicLines = Buffer.from(encodedPublicKey.trim(), "base64")
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  const lines = Buffer.from(encodedSignature.trim(), "base64")
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  if (
    !publicLines[0]?.startsWith("untrusted comment:") ||
    !lines[0]?.startsWith("untrusted comment:") ||
    !lines[2]?.startsWith("trusted comment: ")
  )
    throw Error("Malformed updater signature or public key");
  const key = Buffer.from(publicLines[1] ?? "", "base64"),
    sig = Buffer.from(lines[1] ?? "", "base64"),
    globalSig = Buffer.from(lines[3] ?? "", "base64");
  if (
    key.length !== 42 ||
    sig.length !== 74 ||
    globalSig.length !== 64 ||
    sig.subarray(0, 2).toString() !== "ED" ||
    !key.subarray(2, 10).equals(sig.subarray(2, 10))
  )
    throw Error("Unsupported signature or signing key mismatch");
  const comment = lines[2].slice(17);
  const signedVersion = comment
    .split("\t")
    .find((p) => p.startsWith("version:"))
    ?.slice(8);
  if (
    !signedVersion ||
    signedVersion.replace(/^v/, "") !== version.replace(/^v/, "")
  )
    throw Error("Missing or mismatched signed version");
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      key.subarray(10),
    ]),
    format: "der",
    type: "spki",
  });
  const signature = sig.subarray(10);
  if (
    !verify(
      null,
      createHash("blake2b512").update(bytes).digest(),
      publicKey,
      signature,
    ) ||
    !verify(
      null,
      Buffer.concat([signature, Buffer.from(comment)]),
      publicKey,
      globalSig,
    )
  )
    throw Error("Updater signature verification failed");
}
export function stageManifest({
  installer,
  version,
  channel,
  output,
  notes = "",
  qa = false,
}) {
  validateVersion(version, channel);
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  if (
    !config.plugins.updater.requireSignedVersion ||
    !config.plugins.updater.pubkey
  )
    throw Error("A public key and signed versions are required");
  const bytes = readFileSync(installer),
    signature = readFileSync(installer + ".sig", "utf8").trim();
  verifyInstaller(bytes, signature, config.plugins.updater.pubkey, version);
  const name = basename(installer).replaceAll(" ", ".");
  if (!name.endsWith("_x64-setup.exe"))
    throw Error("Expected a Windows x64 NSIS installer");
  mkdirSync(output, { recursive: true });
  copyFileSync(installer, join(output, name));
  writeFileSync(join(output, name + ".sig"), signature + "\n");
  const hash = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(output, name + ".sha256"), `${hash}  ${name}\n`);
  const manifest = {
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: qa
          ? `http://127.0.0.1:43187/${encodeURIComponent(name)}`
          : `https://github.com/Ninefarer/Reprise/releases/download/v${encodeURIComponent(version)}/${encodeURIComponent(name)}`,
      },
    },
  };
  writeFileSync(
    join(output, "latest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return { name, hash, version, channel };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [installer, version, channel, output, notesFile] =
    process.argv.slice(2);
  if (!output)
    throw Error(
      "Usage: node manifest.mjs INSTALLER VERSION CHANNEL OUTPUT [NOTES_FILE]",
    );
  console.log(
    stageManifest({
      installer,
      version,
      channel,
      output,
      notes: notesFile ? readFileSync(notesFile, "utf8") : "",
    }),
  );
}
