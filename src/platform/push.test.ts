import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker";
import {
  reminderTimes,
  subscribeToReminders,
  syncReminderTimes,
} from "./push";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  return values;
}

describe("push client stub", () => {
  it("keeps only id, time, and category", () => {
    const prepared = reminderTimes([
      {
        id: "event-1",
        at: 1_700_000_000,
        category: "Deadline",
        title: "Do not send",
      } as never,
    ]);
    expect(prepared).toEqual([
      { id: "event-1", at: 1_700_000_000, category: "Deadline" },
    ]);
    expect(JSON.stringify(prepared)).not.toContain("Do not send");
  });

  it("does not send reminder times anywhere", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await syncReminderTimes([
      { id: "event-1", at: 1_700_000_000, category: "Scheduled" },
    ]);
    expect(result).toEqual({ status: "unconfigured", count: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not subscribe when push is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("PushManager", undefined);
    await expect(subscribeToReminders()).resolves.toEqual({
      status: "unsupported",
    });
  });

  it("sends only id, time, and category when the worker is configured", async () => {
    vi.stubEnv("VITE_PUSH_WORKER_URL", "https://push.example");
    vi.stubEnv("VITE_PUSH_SHARED_SECRET", "local-secret");
    storage({ "reprise.nightly.push-device-token": "device-token-0123456789abcdef" });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("navigator", { serviceWorker: {} });
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await syncReminderTimes([
      {
        id: "event-1",
        at: 1_700_000_000,
        category: "Deadline",
        title: "Do not send",
      } as never,
    ]);
    expect(result).toEqual({ status: "accepted", count: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://push.example/reminders");
    expect(new Headers(init.headers).get("x-reprise-push-secret")).toBe("local-secret");
    expect(new Headers(init.headers).get("x-reprise-device-token")).toBe("device-token-0123456789abcdef");
    expect(new Headers(init.headers).has("x-reprise-admin-secret")).toBe(false);
    expect(JSON.parse(String(init.body))).toMatchObject({
      reminders: [{ id: "event-1", at: 1_700_000_000, category: "Deadline" }],
    });
    expect(String(init.body)).not.toContain("Do not send");
  });

  it("does not report accepted when the worker rejects the sync", async () => {
    vi.stubEnv("VITE_PUSH_WORKER_URL", "https://push.example");
    vi.stubEnv("VITE_PUSH_SHARED_SECRET", "local-secret");
    storage({ "reprise.nightly.push-device-token": "device-token-0123456789abcdef" });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("navigator", { serviceWorker: {} });
    const fetchSpy = vi.fn(async () => new Response("no", { status: 401 }));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      syncReminderTimes([{ id: "event-1", at: 1_700_000_000, category: "Scheduled" }]),
    ).resolves.toEqual({ status: "unconfigured", count: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("subscribes with the fetched VAPID key and stores the endpoint only after 2xx", async () => {
    vi.stubEnv("VITE_PUSH_WORKER_URL", "https://push.example/");
    vi.stubEnv("VITE_PUSH_SHARED_SECRET", "local-secret");
    const saved = storage();
    const subscribe = vi.fn(async (options: PushSubscriptionOptionsInit) => {
      expect(options.userVisibleOnly).toBe(true);
      expect(options.applicationServerKey).toBeInstanceOf(ArrayBuffer);
      return {
        endpoint: "https://web.push.apple.com/device",
        toJSON: () => ({
          endpoint: "https://web.push.apple.com/device",
          keys: { p256dh: "key", auth: "auth" },
        }),
      };
    });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
    });
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).endsWith("/vapid-public-key")) {
        return new Response(JSON.stringify({ publicKey: "AQID" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, deviceToken: "issued-device-token-0123456789" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(subscribeToReminders()).resolves.toEqual({
      status: "subscribed",
      endpoint: "https://web.push.apple.com/device",
    });
    const post = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(post[0]).toBe("https://push.example/subscribe");
    expect(JSON.parse(String(post[1].body)).subscription.endpoint).toBe(
      "https://web.push.apple.com/device",
    );
    expect(saved.get("reprise.nightly.push-device-token")).toBe("issued-device-token-0123456789");
  });

  it("registers the worker at the Pages base without caching", async () => {
    const register = vi.fn(async () => undefined);
    registerServiceWorker(
      { serviceWorker: { register } } as unknown as Navigator,
      "/Reprise/",
    );
    expect(register).toHaveBeenCalledWith("/Reprise/sw.js", {
      scope: "/Reprise/",
    });
  });
});
