import { asBuffer, base64url, base64urlDecode, concat, padP256Scalar, randomBytes } from "./bytes";
import { LIMITS } from "./types";

export interface DerivedPushKeys {
  ecdhSecret: Uint8Array;
  prkKey: Uint8Array;
  ikm: Uint8Array;
  prk: Uint8Array;
  cek: Uint8Array;
  nonce: Uint8Array;
}

export interface EphemeralKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  salt: Uint8Array;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    asBuffer(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, asBuffer(data)));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 1;
  const block = await hmacSha256(prk, input);
  return block.slice(0, length);
}

function assertUncompressed(key: Uint8Array, label: string): void {
  if (key.length !== 65 || key[0] !== 4) {
    throw new Error(`${label} must be an uncompressed P-256 point`);
  }
}

function ecJwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  assertUncompressed(publicKey, "public key");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64url(publicKey.subarray(1, 33)),
    y: base64url(publicKey.subarray(33, 65)),
  };
  if (privateKey) jwk.d = base64url(padP256Scalar(privateKey));
  return jwk;
}

async function sharedSecret(privateKey: Uint8Array, matchingPublic: Uint8Array, peerPublic: Uint8Array): Promise<Uint8Array> {
  const local = await crypto.subtle.importKey(
    "jwk",
    ecJwk(matchingPublic, privateKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const peer = await importEcdhPublic(peerPublic);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, local, 256));
}

async function importEcdhPublic(publicKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", ecJwk(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

export async function generateEphemeralKey(): Promise<EphemeralKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.d) throw new Error("ephemeral private key was not exportable");
  return {
    privateKey: padP256Scalar(base64urlDecode(jwk.d)),
    publicKey,
    salt: randomBytes(16),
  };
}

/**
 * RFC 8291 section 3.4. HKDF-SHA256 combines the ECDH secret with the
 * 16-byte authentication secret, then derives the aes128gcm key and nonce.
 */
export async function deriveAes128Gcm(input: {
  uaPublic: Uint8Array;
  asPublic: Uint8Array;
  asPrivate: Uint8Array;
  auth: Uint8Array;
  salt: Uint8Array;
}): Promise<DerivedPushKeys> {
  assertUncompressed(input.uaPublic, "subscription key");
  assertUncompressed(input.asPublic, "ephemeral key");
  if (input.auth.length !== 16) throw new Error("auth secret must be 16 bytes");
  if (input.salt.length !== 16) throw new Error("salt must be 16 bytes");

  const ecdhSecret = await sharedSecret(input.asPrivate, input.asPublic, input.uaPublic);
  return keysFromSecret({
    ecdhSecret,
    uaPublic: input.uaPublic,
    asPublic: input.asPublic,
    auth: input.auth,
    salt: input.salt,
  });
}

async function keysFromSecret(input: {
  ecdhSecret: Uint8Array;
  uaPublic: Uint8Array;
  asPublic: Uint8Array;
  auth: Uint8Array;
  salt: Uint8Array;
}): Promise<DerivedPushKeys> {
  const keyInfo = concat([utf8Bytes("WebPush: info"), new Uint8Array([0]), input.uaPublic, input.asPublic]);
  const prkKey = await hmacSha256(input.auth, input.ecdhSecret);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);
  const prk = await hmacSha256(input.salt, ikm);
  const cek = await hkdfExpand(prk, utf8Bytes("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, utf8Bytes("Content-Encoding: nonce\0"), 12);
  return { ecdhSecret: input.ecdhSecret, prkKey, ikm, prk, cek, nonce };
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function encryptWebPush(
  plaintext: Uint8Array,
  subscription: { p256dh: Uint8Array; auth: Uint8Array },
  ephemeral?: EphemeralKey,
): Promise<Uint8Array> {
  const keys = ephemeral ?? (await generateEphemeralKey());
  const derived = await deriveAes128Gcm({
    uaPublic: subscription.p256dh,
    asPublic: keys.publicKey,
    asPrivate: keys.privateKey,
    auth: subscription.auth,
    salt: keys.salt,
  });
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 2;
  if (padded.length + 16 > LIMITS.recordSize) throw new Error("payload is too large");

  const aesKey = await crypto.subtle.importKey("raw", asBuffer(derived.cek), "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(derived.nonce), tagLength: 128 }, aesKey, asBuffer(padded)),
  );
  const header = new Uint8Array(86);
  header.set(keys.salt, 0);
  new DataView(header.buffer).setUint32(16, LIMITS.recordSize, false);
  header[20] = 65;
  header.set(keys.publicKey, 21);
  return concat([header, encrypted]);
}

export async function decryptWebPush(
  body: Uint8Array,
  receiver: { privateKey: Uint8Array; publicKey: Uint8Array; auth: Uint8Array },
): Promise<Uint8Array> {
  if (body.length < 86 + 16) throw new Error("push body is too short");
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(16, false);
  const idlen = body[20];
  if (rs !== LIMITS.recordSize || idlen !== 65) throw new Error("unexpected aes128gcm header");
  const asPublic = body.slice(21, 86);
  const encrypted = body.slice(86);
  const derived = await keysFromSecret({
    ecdhSecret: await sharedSecret(receiver.privateKey, receiver.publicKey, asPublic),
    uaPublic: receiver.publicKey,
    asPublic,
    auth: receiver.auth,
    salt,
  });
  const aesKey = await crypto.subtle.importKey("raw", asBuffer(derived.cek), "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBuffer(derived.nonce), tagLength: 128 }, aesKey, asBuffer(encrypted)),
  );
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end -= 1;
  if (end === 0 || padded[end - 1] !== 2) throw new Error("invalid push padding");
  return padded.slice(0, end - 1);
}
