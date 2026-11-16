const json = process.argv.includes("--json");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

const publicKey = base64url(rawPublic);
const privateKey = jwk.d;
if (!privateKey) {
  console.error("Could not export the VAPID private key.");
  process.exit(1);
}

if (json) {
  process.stdout.write(`${JSON.stringify({ publicKey, privateKey })}\n`);
} else {
  console.error("Keep the private key in a Wrangler secret. Do not commit it.");
  console.log(`Public key:\n${publicKey}`);
  console.log(`Private key:\n${privateKey}`);
}
