import { asBuffer, base64url, base64urlDecode, padP256Scalar, utf8 } from "./bytes";
import { LIMITS } from "./types";

interface CachedToken {
  token: string;
  createdAt: number;
}

const tokenCache = new Map<string, CachedToken>();

export function clearVapidCache(): void {
  tokenCache.clear();
}

export function vapidSigningInput(audience: string, subject: string, expiresAt: number): string {
  const header = base64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64url(utf8(JSON.stringify({ aud: audience, exp: expiresAt, sub: subject })));
  return `${header}.${payload}`;
}

function ecJwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64url(publicKey.subarray(1, 33)),
    y: base64url(publicKey.subarray(33, 65)),
  };
  if (privateKey) jwk.d = base64url(padP256Scalar(privateKey));
  return jwk;
}

async function importSigningKey(privateKey: Uint8Array, publicKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", ecJwk(publicKey, privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function importVerifyKey(publicKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", ecJwk(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

export async function signVapidJwt(input: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  audience: string;
  subject: string;
  expiresAt: number;
}): Promise<string> {
  const unsigned = vapidSigningInput(input.audience, input.subject, input.expiresAt);
  const key = await importSigningKey(input.privateKey, input.publicKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, asBuffer(utf8(unsigned))),
  );
  if (signature.length !== 64) throw new Error("unexpected VAPID signature length");
  return `${unsigned}.${base64url(signature)}`;
}

export function pushServiceOrigin(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("push endpoint must be https");
  return url.origin;
}

export function validVapidSubject(subject: string): boolean {
  if (subject.startsWith("mailto:")) {
    const address = subject.slice("mailto:".length);
    if (address !== address.trim() || /\s/.test(address)) return false;
    const match = /^[^@]+@([^@]+)$/.exec(address);
    if (!match || !match[1].includes(".")) return false;
    const domain = match[1].toLowerCase();
    return domain !== "localhost" && !domain.endsWith(".localhost");
  }
  try {
    const url = new URL(subject);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && host !== "localhost" && !host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function decodeVapidKey(value: string, expectedLength: number): Uint8Array {
  const bytes = base64urlDecode(value.trim());
  if (expectedLength === 32) return padP256Scalar(bytes);
  if (bytes.length !== expectedLength) throw new Error("VAPID key has the wrong length");
  return bytes;
}

export async function createVapidAuthorization(input: {
  endpoint: string;
  subject: string;
  publicKey: string;
  privateKey: string;
  nowMs: number;
}): Promise<{ authorization: string; origin: string }> {
  if (!validVapidSubject(input.subject)) {
    throw new Error("VAPID subject must be a mailto address or https URL");
  }
  const origin = pushServiceOrigin(input.endpoint);
  const publicBytes = decodeVapidKey(input.publicKey, 65);
  const privateBytes = decodeVapidKey(input.privateKey, 32);
  if (publicBytes[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point");
  const cacheKey = `${origin}\n${input.subject}\n${input.publicKey.trim()}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && input.nowMs - cached.createdAt < LIMITS.jwtReuseMs) {
    return { authorization: `vapid t=${cached.token}, k=${input.publicKey.trim()}`, origin };
  }
  const expiresAt = Math.floor(input.nowMs / 1000) + LIMITS.jwtLifetimeSeconds;
  const token = await signVapidJwt({
    privateKey: privateBytes,
    publicKey: publicBytes,
    audience: origin,
    subject: input.subject,
    expiresAt,
  });
  tokenCache.set(cacheKey, { token, createdAt: input.nowMs });
  return { authorization: `vapid t=${token}, k=${input.publicKey.trim()}`, origin };
}

export async function topicForReminder(id: string): Promise<string> {
  if (/^[A-Za-z0-9_-]{1,32}$/.test(id)) return id;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", asBuffer(utf8(id))));
  return base64url(digest).slice(0, 32);
}
