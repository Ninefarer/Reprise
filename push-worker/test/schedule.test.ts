import { beforeEach, describe, expect, it } from "vitest";
import { base64urlDecode, utf8Decode } from "../src/bytes";
import { reminderPayload } from "../src/payload";
import { runSchedule, selectDue } from "../src/schedule";
import type { ReminderRecord } from "../src/types";
import { clearVapidCache } from "../src/vapid";
import { decryptWebPush } from "../src/webpush";
import { generateSubscriptionKeys, generateVapidKeys, MemoryKv, testEnv } from "./helpers";

const now = Date.parse("2026-11-16T18:00:00.000Z");

function reminder(id: string, fireAt: string, attempts?: number, category = "Deadline"): ReminderRecord {
  const at = Math.floor(Date.parse(fireAt) / 1000);
  return attempts ? { id, at, category, attempts } : { id, at, category };
}

describe("due reminders", () => {
  it("selects reminders at or before the cron tick, oldest first", () => {
    const selected = selectDue(
      [
        reminder("later", "2026-11-16T18:05:00.000Z"),
        reminder("older", "2026-11-16T17:00:00.000Z"),
        reminder("now", "2026-11-16T18:00:00.000Z"),
      ],
      now,
    );
    expect(selected.due.map((item) => item.id)).toEqual(["older", "now"]);
    expect(selected.pending.map((item) => item.id)).toEqual(["later"]);
  });

  it("names the category and never a task", () => {
    const deadline = reminderPayload({ id: "task:Deadline:1", category: "Deadline" });
    expect(deadline).toEqual({
      title: "Reprise",
      body: "Deadline reminder",
      tag: "task:Deadline:1",
      url: "./",
    });
    expect(deadline).not.toHaveProperty("taskId");
    expect(reminderPayload({ id: "review:2026-11-16", category: "DailyReview" })).toEqual({
      title: "Reprise",
      body: "Time for your daily review",
      tag: "review:2026-11-16",
      url: "./",
      review: true,
    });
  });
});

describe("scheduled delivery", () => {
  let kv: MemoryKv;
  let env: ReturnType<typeof testEnv>;
  const keysPromise = generateSubscriptionKeys();
  const vapidPromise = generateVapidKeys();

  beforeEach(async () => {
    clearVapidCache();
    kv = new MemoryKv();
    const vapid = await vapidPromise;
    env = testEnv(kv, { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey });
    const keys = await keysPromise;
    await kv.put("devices", JSON.stringify(["iphone-1"]));
    await kv.put("sub:iphone-1", JSON.stringify({
      endpoint: keys.endpoint,
      p256dh: keys.publicKey,
      auth: keys.auth,
    }));
  });

  async function store(reminders: ReminderRecord[]) {
    await kv.put("rem:iphone-1", JSON.stringify(reminders));
  }

  it("does not send a reminder that is still in the future", async () => {
    await store([reminder("later", "2026-11-16T18:01:00.000Z")]);
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("", { status: 201 });
    };
    await runSchedule(env, now, fetchImpl);
    expect(calls).toBe(0);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "")).toEqual([reminder("later", "2026-11-16T18:01:00.000Z")]);
  });

  it("sends a due reminder and removes it", async () => {
    const keys = await keysPromise;
    await store([
      reminder("due", "2026-11-16T17:59:00.000Z"),
      reminder("later", "2026-11-16T19:00:00.000Z"),
    ]);
    let body: Uint8Array | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = new Uint8Array(init?.body as ArrayBuffer);
      return new Response("", { status: 201 });
    };
    const logged = await runSchedule(env, now, fetchImpl);
    const decoded = JSON.parse(utf8Decode(await decryptWebPush(body ?? new Uint8Array(), {
      privateKey: base64urlDecode(keys.privateKey),
      publicKey: base64urlDecode(keys.publicKey),
      auth: base64urlDecode(keys.auth),
    })));
    expect(decoded).toEqual(reminderPayload({ id: "due", category: "Deadline" }));
    expect(decoded).not.toHaveProperty("taskId");
    expect(logged.map((entry) => entry.reminderId)).toEqual(["due"]);
    expect(logged[0].endpointHost).toBe("fcm.googleapis.com");
    expect(logged[0].status).toBe(201);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "")).toEqual([reminder("later", "2026-11-16T19:00:00.000Z")]);
    expect(kv.values.has("sub:iphone-1")).toBe(true);
  });

  it("deletes a stale subscription on 410 and keeps reminders that were not attempted", async () => {
    await store([
      reminder("first", "2026-11-16T17:00:00.000Z"),
      reminder("second", "2026-11-16T17:30:00.000Z"),
      reminder("later", "2026-11-16T19:00:00.000Z"),
    ]);
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response('{"reason":"Unregistered"}', { status: 410 });
    };
    const logged = await runSchedule(env, now, fetchImpl);
    expect(calls).toBe(1);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      status: 410,
      reason: '{"reason":"Unregistered"}',
      endpointHost: "fcm.googleapis.com",
      reminderId: "first",
    });
    expect(kv.values.has("sub:iphone-1")).toBe(false);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "").map((item: ReminderRecord) => item.id)).toEqual(["later", "second"]);
    expect(JSON.stringify(kv.values.get("push-log"))).not.toContain("secret-token");
  });

  it("deletes the subscription on 404 as well", async () => {
    await store([reminder("due", "2026-11-16T17:00:00.000Z")]);
    const fetchImpl: typeof fetch = async () => new Response("gone", { status: 404 });
    await runSchedule(env, now, fetchImpl);
    expect(kv.values.has("sub:iphone-1")).toBe(false);
    expect(kv.values.has("rem:iphone-1")).toBe(false);
    expect(JSON.parse(kv.values.get("devices") ?? "")).toEqual([]);
  });

  it("retries a rejected push and drops it after five failures", async () => {
    await store([reminder("due", "2026-11-16T17:00:00.000Z")]);
    const fetchImpl: typeof fetch = async () => new Response("no", { status: 429 });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await runSchedule(env, now + attempt, fetchImpl);
      const stored = JSON.parse(kv.values.get("rem:iphone-1") ?? "") as ReminderRecord[];
      expect(stored[0].attempts).toBe(attempt);
    }
    await runSchedule(env, now + 5, fetchImpl);
    expect(JSON.parse(kv.values.get("rem:iphone-1") ?? "")).toEqual([]);
    const log = JSON.parse(kv.values.get("push-log") ?? "") as Array<{ status: number }>;
    expect(log).toHaveLength(5);
    expect(log[0].status).toBe(429);
  });
});
