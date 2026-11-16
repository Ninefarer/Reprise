import { base64url, base64urlDecode, padP256Scalar } from "../src/bytes";
import type { Env, KvStore } from "../src/types";

export class MemoryKv implements KvStore {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export function testEnv(kv: MemoryKv, overrides: Partial<Env> = {}): Env {
  return {
    PUSH_KV: kv,
    ALLOWED_ORIGIN: "https://ninefarer.github.io",
    VAPID_SUBJECT: "mailto:push@example.com",
    VAPID_PUBLIC_KEY: "B".padEnd(87, "A"),
    VAPID_PRIVATE_KEY: "A".repeat(43),
    PUSH_SHARED_SECRET: "test-secret",
    ...overrides,
  };
}

export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = base64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.d) throw new Error("missing private key");
  return { publicKey, privateKey: base64url(padP256Scalar(base64urlDecode(jwk.d))) };
}

export async function generateSubscriptionKeys(): Promise<{
  publicKey: string;
  privateKey: string;
  auth: string;
  endpoint: string;
}> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = base64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.d) throw new Error("missing private key");
  const privateKey = base64url(padP256Scalar(base64urlDecode(jwk.d)));
  const authBytes = new Uint8Array(16);
  crypto.getRandomValues(authBytes);
  return {
    publicKey,
    privateKey,
    auth: base64url(authBytes),
    endpoint: "https://fcm.googleapis.com/fcm/send/secret-token",
  };
}

export function call(
  handler: (request: Request, env: Env) => Promise<Response>,
  env: Env,
  path: string,
  init: RequestInit & { origin?: string; secret?: string | null; deviceId?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.origin) headers.set("origin", init.origin);
  if (init.secret) headers.set("x-reprise-push-secret", init.secret);
  if (init.deviceId) headers.set("x-device-id", init.deviceId);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return handler(new Request(`https://push.example${path}`, { ...init, headers }), env);
}
