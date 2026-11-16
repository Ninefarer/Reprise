import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker";
import {
  reminderTimes,
  subscribeToReminders,
  syncReminderTimes,
} from "./push";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
