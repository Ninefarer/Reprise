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

  async function enroll(deviceId: string): Promise<string> {
    const keys = await keysPromise;
    const response = await call(handleRequest, env, "/subscribe", {
      method: "POST",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId,
        subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.publicKey, auth: keys.auth } },
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { deviceToken?: string };
    expect(body.deviceToken && body.deviceToken.length > 20).toBeTruthy();
    expect([...kv.values.values()].join("\n")).not.toContain(body.deviceToken);
    return body.deviceToken ?? "";
  }

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
    const allowedHeaders = response.headers.get("access-control-allow-headers") ?? "";
    expect(allowedHeaders).toContain("X-Reprise-Push-Secret");
    expect(allowedHeaders).toContain("X-Reprise-Device-Token");
    expect(allowedHeaders).not.toContain("X-Reprise-Admin-Secret");
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
    const issued = (await saved.json()) as { deviceToken?: string };
    expect(typeof issued.deviceToken).toBe("string");
    expect(JSON.parse(kv.values.get("sub:iphone-1") ?? "")).toEqual({
      endpoint: keys.endpoint,
      p256dh: keys.publicKey,
      auth: keys.auth,
    });
  });

  it("replaces reminders with id, time, and category only", async () => {
    const token = await enroll("iphone-1");
    const at = Math.floor(Date.now() / 1000) + 3600;
    const id = "6f1c2a40-1111-4111-8111-111111111111:Deadline:1700000000";
    const outsider = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: "someone-elses-token-not-this-device",
      body: JSON.stringify({ deviceId: "iphone-1", reminders: [] }),
    });
    expect(outsider.status).toBe(401);
    const response = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: token,
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
      deviceToken: token,
      body: JSON.stringify({
        deviceId: "iphone-1",
        reminders: [{ id: "note", at, category: "Buy milk" }],
      }),
    });
    expect(rejected.status).toBe(400);

    const replaced = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: token,
      body: JSON.stringify({ deviceId: "iphone-1", reminders: [] }),
    });
    expect(replaced.status).toBe(200);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "")).toEqual([]);
  });

  it("deletes one reminder and then the whole subscription", async () => {
    const token = await enroll("iphone-1");
    await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: token,
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
      deviceToken: token,
      deviceId: "iphone-1",
    });
    expect(deleted.status).toBe(200);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "").map((item: { id: string }) => item.id)).toEqual(["two"]);

    const unsubscribed = await call(handleRequest, env, "/subscribe", {
      method: "DELETE",
      secret: "test-secret",
      deviceToken: token,
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
    const token = await enroll("iphone-1");

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
        headers: {
          "content-type": "application/json",
          "x-reprise-push-secret": "test-secret",
          "x-reprise-device-token": token,
        },
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

    const withSharedSecret = await call(handleRequest, env, "/push-log", { secret: "test-secret" });
    expect(withSharedSecret.status).toBe(401);
    const log = await call(handleRequest, env, "/push-log", { admin: "admin-secret" });
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

  it("lets a device token change only that device", async () => {
    const first = await enroll("iphone-1");
    const second = await enroll("iphone-2");
    const crossed = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: second,
      body: JSON.stringify({
        deviceId: "iphone-1",
        reminders: [{ id: "nope", at: Math.floor(Date.now() / 1000) + 60, category: "Deadline" }],
      }),
    });
    expect(crossed.status).toBe(401);
    const own = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      deviceToken: first,
      body: JSON.stringify({ deviceId: "iphone-1", reminders: [] }),
    });
    expect(own.status).toBe(200);
  });

  it("rate limits test pushes and caps devices and request size", async () => {
    const token = await enroll("iphone-1");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await call(handleRequest, env, "/test-push", {
        method: "POST",
        secret: "test-secret",
        deviceToken: token,
        body: JSON.stringify({ deviceId: "iphone-1" }),
      });
      expect(response.status).not.toBe(429);
    }
    const limited = await call(handleRequest, env, "/test-push", {
      method: "POST",
      secret: "test-secret",
      deviceToken: token,
      body: JSON.stringify({ deviceId: "iphone-1" }),
    });
    expect(limited.status).toBe(429);

    for (let index = 2; index <= 8; index += 1) await enroll(`device-${index}`);
    const keys = await keysPromise;
    const overflow = await call(handleRequest, env, "/subscribe", {
      method: "POST",
      secret: "test-secret",
      body: JSON.stringify({
        deviceId: "device-09",
        subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.publicKey, auth: keys.auth } },
      }),
    });
    expect(overflow.status).toBe(429);

    const oversized = await call(handleRequest, env, "/reminders", {
      method: "PUT",
      secret: "test-secret",
      body: "x".repeat(40_000),
    });
    expect(oversized.status).toBe(400);
  });
});
