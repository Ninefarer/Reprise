import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest } from "../src/api";
import { base64urlDecode, utf8Decode } from "../src/bytes";
import { decryptWebPush } from "../src/webpush";
import { call, generateSubscriptionKeys, generateVapidKeys, MemoryKv, testEnv } from "./helpers";
import { clearVapidCache } from "../src/vapid";

describe("push API", () => {
  let kv: MemoryKv;
  let env: ReturnType<typeof testEnv>;
  const keysPromise = generateSubscriptionKeys();
  const vapidPromise = generateVapidKeys();

  beforeEach(() => {
    clearVapidCache();
    kv = new MemoryKv();
    env = testEnv(kv);
  });

  it("returns the VAPID public key without the shared secret", async () => {
    env.VAPID_PUBLIC_KEY = "public-key";
    const response = await call(handleRequest, env, "/vapid-public-key", { origin: env.ALLOWED_ORIGIN });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(env.ALLOWED_ORIGIN);
    expect(await response.json()).toEqual({ publicKey: "public-key" });
  });

  it("rejects a browser origin that is not the configured site", async () => {
    const response = await call(handleRequest, env, "/vapid-public-key", { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a preflight for the allowed origin", async () => {
    const response = await call(handleRequest, env, "/subscribe", { method: "OPTIONS", origin: env.ALLOWED_ORIGIN });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Reprise-Push-Secret");
  });

  it("requires the shared secret on writes and stores only the subscription keys", async () => {
    const keys = await keysPromise;
    const missing = await call(handleRequest, env, "/subscribe", {
      method: "POST",
      origin: env.ALLOWED_ORIGIN,
      body: JSON.stringify({ deviceId: "iphone-1" }),
    });
    expect(missing.status).toBe(401);

    const saved = await call(handleRequest, env, "/subscribe", {
      method: "POST",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        subscription: {
          endpoint: keys.endpoint,
          expirationTime: null,
          keys: { p256dh: keys.publicKey, auth: keys.auth },
        },
        task: "this must not be stored",
      }),
    });
    expect(saved.status).toBe(200);
    expect(JSON.parse(kv.values.get("sub:iphone-1") ?? "")).toEqual({
      endpoint: keys.endpoint,
      p256dh: keys.publicKey,
      auth: keys.auth,
    });
  });

  it("replaces reminders with id, time, and category only", async () => {
    const at = Math.floor(Date.now() / 1000) + 3600;
    const id = "6f1c2a40-1111-4111-8111-111111111111:Deadline:1700000000";
    const response = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        reminders: [
          {
            id,
            at,
            category: "Deadline",
            title: "Do not store",
            notes: "full task notes",
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, count: 1 });
    const stored = JSON.parse(kv.values.get("rem:iphone-1") ?? "");
    expect(stored).toEqual([{ id, at, category: "Deadline" }]);
    expect(JSON.stringify(stored)).not.toContain("Do not store");
    const rejected = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        reminders: [{ id: "note", at, category: "Buy milk" }],
      }),
    });
    expect(rejected.status).toBe(400);

    const replaced = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      body: JSON.stringify({ deviceId: "iphone-1", reminders: [] }),
    });
    expect(replaced.status).toBe(200);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "")).toEqual([]);
  });

  it("deletes one reminder and then the whole subscription", async () => {
    await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        reminders: [
          { id: "one", at: Math.floor(Date.now() / 1000) + 60, category: "Scheduled" },
          { id: "two", at: Math.floor(Date.now() / 1000) + 120, category: "Waiting" },
        ],
      }),
    });
    const deleted = await call(handleRequest, env, "/reminders/one", {
      method: "DELETE",
      secret: "test-secret",
      deviceId: "iphone-1",
    });
    expect(deleted.status).toBe(200);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "").map((item: { id: string }) => item.id)).toEqual(["two"]);

    const keys = await keysPromise;
    await call(handleRequest, env, "/subscribe", {
      method: "POST",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.publicKey, auth: keys.auth } },
      }),
    });
    const unsubscribed = await call(handleRequest, env, "/subscribe", {
      method: "DELETE",
      secret: "test-secret",
      deviceId: "iphone-1",
    });
    expect(unsubscribed.status).toBe(200);
    expect(kv.values.has("sub:iphone-1")).toBe(false);
    expect(kv.values.has("rem:iphone-1")).toBe(false);
  });

  it("sends a test push, logs the host and response, and keeps the endpoint token out of the log", async () => {
    const keys = await keysPromise;
    const vapid = await vapidPromise;
    env.VAPID_PUBLIC_KEY = vapid.publicKey;
    env.VAPID_PRIVATE_KEY = vapid.privateKey;
    await call(handleRequest, env, "/subscribe", {
      method: "POST",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "iphone-1",
        subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.publicKey, auth: keys.auth } },
      }),
    });

    let captured: { url: string; headers: Headers; body: Uint8Array } | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: new Uint8Array(init?.body as ArrayBuffer),
      };
      return new Response('{"reason":"accepted"}', { status: 201, headers: { "apns-id": "apple-id" } });
    };
    const response = await handleRequest(
      new Request("https://push.example/test-push", {
        method: "POST",
        headers: { "content-type": "application/json", "x-reprise-push-secret": "test-secret" },
        body: JSON.stringify({ deviceId: "iphone-1", title: "Reprise", body: "Hello", url: "/?from=test" }),
      }),
      env,
      { fetchImpl, now: Date.parse("2026-11-16T18:00:00.000Z") },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: 201, endpointHost: "fcm.googleapis.com" });
    expect(captured).not.toBeNull();
    const sent = captured as unknown as { url: string; headers: Headers; body: Uint8Array };
    expect(sent.url).toBe(keys.endpoint);
    expect(sent.headers.get("content-encoding")).toBe("aes128gcm");
    expect(sent.headers.get("ttl")).toBe("300");
    expect(sent.headers.get("urgency")).toBe("high");
    expect(sent.headers.get("authorization")).toContain("vapid t=");
    const decoded = utf8Decode(await decryptWebPush(sent.body, {
      privateKey: base64urlDecode(keys.privateKey),
      publicKey: base64urlDecode(keys.publicKey),
      auth: base64urlDecode(keys.auth),
    }));
    expect(JSON.parse(decoded)).toEqual({
      title: "Reprise",
      body: "Hello",
      tag: "reprise-test",
      url: "/?from=test",
    });

    const log = await call(handleRequest, env, "/push-log", { secret: "test-secret" });
    const entries = (await log.json()) as { entries: Array<Record<string, unknown>> };
    expect(entries.entries).toEqual([
      {
        at: "2026-11-16T18:00:00.000Z",
        deviceId: "iphone-1",
        endpointHost: "fcm.googleapis.com",
        status: 201,
        reason: '{"reason":"accepted"}',
        apnsId: "apple-id",
        reminderId: null,
        kind: "test",
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("secret-token");
    const hidden = await call(handleRequest, env, "/push-log");
    expect(hidden.status).toBe(401);
  });
});
