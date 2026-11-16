import { describe, expect, it, vi } from "vitest";
import { createWebPlatform } from "./web";
import {
  WEB_STORAGE_KEY,
  WebStoragePendingError,
  createLocalStoragePlaceholder,
  createMemoryStorage,
} from "./storage";
import { createWebSession } from "./webStore";

const version = "3.4.4-nightly.test";

describe("web storage placeholder", () => {
  it("keeps a captured task when a new session reads the same store", async () => {
    const storage = createMemoryStorage();
    const first = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_000,
    });
    await first.capture("Buy milk");
    const second = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_100,
    });
    const snapshot = await second.snapshot();
    expect(snapshot?.tasks.map((task) => task.title)).toEqual(["Buy milk"]);
    expect(snapshot?.settings.onboarded).toBe(false);
    expect(snapshot?.release?.should_show).toBe(false);
  });

  it("drops an in-memory deletion receipt after the page is reopened", async () => {
    const storage = createMemoryStorage();
    const first = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_000,
    });
    const task = await first.capture("Temporary");
    const token = await first.deleteTask(task.id, task.updated_at);
    const second = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_100,
    });
    await expect(second.undoDeletion(token)).rejects.toThrow(
      /no longer be undone/,
    );
    expect((await second.snapshot())?.tasks).toHaveLength(0);
  });

  it("leaves an unreadable document untouched", async () => {
    let raw: string | null = JSON.stringify({ version: 2, tasks: [{ title: "keep" }] });
    const storage = createLocalStoragePlaceholder(
      {
        getItem: () => raw,
        setItem: (_key, value) => {
          raw = value;
        },
        removeItem: () => {
          raw = null;
        },
      },
      WEB_STORAGE_KEY,
    );
    await expect(storage.read()).rejects.toThrow(/left untouched/);
    expect(raw).toContain('"title":"keep"');
    await expect(storage.exportBackup()).rejects.toBeInstanceOf(
      WebStoragePendingError,
    );
    await expect(storage.importBackup("{}")).rejects.toBeInstanceOf(
      WebStoragePendingError,
    );
    expect(raw).toContain('"title":"keep"');
  });

  it("does not call navigator.storage.persist", async () => {
    const persist = vi.fn(async () => true);
    const storage = createMemoryStorage();
    vi.stubGlobal("navigator", { storage: { persist } });
    await expect(storage.requestPersistence()).resolves.toBe(false);
    expect(persist).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("open-page reminders", () => {
  it("records an in-app notice without putting the task title in the push envelope", async () => {
    const session = createWebSession({
      storage: createMemoryStorage(),
      version,
      now: () => 1_700_000_000,
      permission: () => "denied",
    });
    await session.savePreferencePatch({ quiet_start: "00:00", quiet_end: "00:00" });
    const task = await session.capture("Secret title");
    await session.saveTask(
      { ...task, status: "Scheduled", scheduled_at: 1_700_003_600 },
      "Scheduled",
    );
    const waiting = await session.tick();
    expect(waiting.reminders).toEqual([
      expect.objectContaining({
        category: "Scheduled",
        at: 1_700_003_600,
      }),
    ]);
    expect(JSON.stringify(waiting.reminders)).not.toContain("Secret title");
    const due = createWebSession({
      storage: createMemoryStorage(),
      version,
      now: () => 1_700_003_600,
      permission: () => "granted",
    });
    await due.savePreferencePatch({ quiet_start: "00:00", quiet_end: "00:00" });
    const created = await due.capture("Secret title");
    await due.saveTask(
      { ...created, status: "Snoozed", wake_at: 1_700_003_600 },
      "Snoozed",
    );
    const pass = await due.tick();
    const snapshot = await due.snapshot();
    expect(snapshot.tasks[0]?.review_at).toBe(1_700_003_600);
    expect(snapshot.notifications.some((notice) => notice.category === "Snoozed")).toBe(
      true,
    );
    expect(pass.deliver.some((item) => item.taskId === created.id)).toBe(true);
  });

  it("rejects a stale edit and keeps the saved title", async () => {
    const session = createWebSession({
      storage: createMemoryStorage(),
      version,
      now: () => 1_700_000_000,
    });
    const task = await session.capture("First");
    await session.saveTask({ ...task, title: "Second" }, "Edited");
    await expect(
      session.saveTask({ ...task, title: "Stale" }, "Edited"),
    ).rejects.toThrow(/changed elsewhere/);
    expect((await session.snapshot()).tasks[0]?.title).toBe("Second");
  });
});
