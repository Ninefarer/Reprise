import { indexedDB } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { showNightlyWelcome } from "../Nightly";
import type { Settings, Task } from "../model";
import { createWebPlatform } from "./web";
import {
  WEB_STORAGE_KEY,
  createIndexedDbStorage,
  createLocalStoragePlaceholder,
  type StoredDocument,
} from "./storage";

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
import { createWebSession } from "./webStore";

const version = "3.4.4-nightly.test";

function memory(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

let databases = 0;

let lastDatabase = "";

function openStore(localStorage: MemoryStorage | null = memory()) {
  databases += 1;
  lastDatabase = `reprise-test-${databases}`;
  return createIndexedDbStorage({
    indexedDB,
    localStorage,
    databaseName: lastDatabase,
  });
}

function document(title: string, name = "Ada"): StoredDocument {
  return {
    version: 1,
    settings: {
      onboarded: true,
      name,
    } as Settings,
    tasks: [{ id: `task-${title}`, title } as Task],
    history: [],
    notifications: [],
    retired: [],
    events: [],
    avatar: null,
  };
}

describe("IndexedDB store", () => {
  it("reads a document after writing it, including a second open", async () => {
    const storage = openStore();
    expect(await storage.read()).toBeNull();
    await storage.write(document("Buy milk"));
    await storage.read();
    const reopened = createIndexedDbStorage({
      indexedDB,
      localStorage: memory(),
      databaseName: lastDatabase,
    });
    expect((await reopened.read())?.tasks.map((task) => task.title)).toEqual([
      "Buy milk",
    ]);
    await expect(
      storage.write({ version: 1, tasks: "no" } as unknown as StoredDocument),
    ).rejects.toThrow(/incomplete/);
    expect((await storage.read())?.tasks.map((task) => task.title)).toEqual([
      "Buy milk",
    ]);
  });

  it("migrates the localStorage placeholder once and keeps it if the bytes are unreadable", async () => {
    const local = memory();
    const legacy = createLocalStoragePlaceholder(local);
    const session = createWebSession({
      storage: legacy,
      version,
      now: () => 1_700_000_000,
    });
    await session.capture("From the placeholder");
    expect(local.getItem(WEB_STORAGE_KEY)).toContain("From the placeholder");

    const storage = openStore(local);
    const again = createIndexedDbStorage({
      indexedDB,
      localStorage: local,
      databaseName: `reprise-test-${databases}`,
    });
    const [first, second] = await Promise.all([storage.read(), again.read()]);
    expect(first?.tasks.map((task) => task.title)).toEqual([
      "From the placeholder",
    ]);
    expect(second?.tasks.map((task) => task.title)).toEqual([
      "From the placeholder",
    ]);
    expect(local.getItem(WEB_STORAGE_KEY)).toBeNull();
    expect((await storage.read())?.tasks).toHaveLength(1);

    const broken = memory();
    broken.setItem(
      WEB_STORAGE_KEY,
      JSON.stringify({ version: 2, tasks: [{ title: "keep" }], notifications: [] }),
    );
    const blocked = openStore(broken);
    await expect(blocked.read()).rejects.toThrow(/left untouched/);
    expect(broken.getItem(WEB_STORAGE_KEY)).toContain('"title":"keep"');
    await expect(blocked.read()).rejects.toThrow(/left untouched/);
    expect(broken.getItem(WEB_STORAGE_KEY)).toContain('"title":"keep"');

    const corrupt = memory();
    corrupt.setItem(WEB_STORAGE_KEY, "{not json");
    const unreadable = openStore(corrupt);
    await expect(unreadable.read()).rejects.toThrow(/could not be read/);
    expect(corrupt.getItem(WEB_STORAGE_KEY)).toBe("{not json");
  });

  it("reports persistence without throwing when the browser has no API", async () => {
    const persist = vi.fn(async () => true);
    const granted = createIndexedDbStorage({
      indexedDB,
      localStorage: memory(),
      databaseName: `reprise-test-persist-${++databases}`,
      persist,
    });
    await expect(granted.requestPersistence()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledOnce();

    const denied = createIndexedDbStorage({
      indexedDB,
      localStorage: memory(),
      databaseName: `reprise-test-persist-${++databases}`,
      persist: async () => false,
    });
    await expect(denied.requestPersistence()).resolves.toBe(false);

    const exploding = createIndexedDbStorage({
      indexedDB,
      localStorage: memory(),
      databaseName: `reprise-test-persist-${++databases}`,
      persist: () => {
        throw new Error("unsupported");
      },
    });
    await expect(exploding.requestPersistence()).resolves.toBe(false);

    vi.stubGlobal("navigator", {});
    const missing = openStore();
    await expect(missing.requestPersistence()).resolves.toBe(false);
    vi.stubGlobal("navigator", {
      storage: {
        persist: () => Promise.reject(new Error("blocked")),
      },
    });
    await expect(missing.requestPersistence()).resolves.toBe(false);
    vi.unstubAllGlobals();
  });

  it("round-trips a backup and refuses a bad file without replacing tasks", async () => {
    const storage = openStore();
    const platform = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_000,
    });
    await platform.capture("Market flowers");
    await platform.capture("Call home");
    const json = await storage.exportBackup();
    const parsed = JSON.parse(json) as StoredDocument;
    expect(parsed.version).toBe(1);
    expect(parsed.tasks.map((task) => task.title).sort()).toEqual([
      "Call home",
      "Market flowers",
    ]);

    await platform.capture("Temporary note");
    expect((await platform.snapshot())?.tasks).toHaveLength(3);
    await storage.importBackup(json);
    const restored = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_100,
    });
    expect(
      (await restored.snapshot())?.tasks.map((task) => task.title).sort(),
    ).toEqual(["Call home", "Market flowers"]);

    const before = await storage.exportBackup();
    const bad = [
      "",
      "{",
      "[]",
      JSON.stringify({ version: 2, tasks: [], notifications: [] }),
      JSON.stringify({ version: 1, tasks: [], notifications: [] }),
      JSON.stringify({
        version: 1,
        settings: { onboarded: true, name: "Ada" },
        tasks: ["nope"],
        notifications: [],
        history: [],
        retired: [],
        events: [],
        avatar: null,
      }),
    ];
    for (const file of bad) {
      await expect(storage.importBackup(file)).rejects.toThrow(/left untouched/);
    }
    expect(await storage.exportBackup()).toBe(before);
  });

  it("keeps nightly_welcome_seen and unknown fields through migration and backup", async () => {
    const local = memory();
    const saved = {
      ...document("From the placeholder"),
      nightly_welcome_seen: version,
      future_field: "keep-me",
    };
    local.setItem(WEB_STORAGE_KEY, JSON.stringify(saved));
    const migrated = openStore(local);
    const moved = await migrated.read();
    expect(moved?.nightly_welcome_seen).toBe(version);
    expect(moved).toMatchObject({ future_field: "keep-me" });
    expect(local.getItem(WEB_STORAGE_KEY)).toBeNull();
    const reread = await migrated.read();
    expect(reread?.nightly_welcome_seen).toBe(version);
    expect(reread).toMatchObject({ future_field: "keep-me" });

    const storage = openStore();
    const platform = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_000,
    });
    await platform.capture("Market flowers");
    await platform.acknowledgeNightlyWelcome(version);
    const exported = JSON.parse(await storage.exportBackup()) as StoredDocument & {
      future_field?: string;
    };
    expect(exported.nightly_welcome_seen).toBe(version);
    exported.future_field = "keep-me";
    await platform.capture("Temporary note");
    await storage.importBackup(JSON.stringify(exported));
    const restored = (await storage.read()) as StoredDocument & {
      future_field?: string;
    };
    expect(restored.nightly_welcome_seen).toBe(version);
    expect(restored.future_field).toBe("keep-me");
    expect(restored.tasks.map((task) => task.title)).toEqual(["Market flowers"]);
    expect(JSON.parse(await storage.exportBackup())).toMatchObject({
      nightly_welcome_seen: version,
      future_field: "keep-me",
    });
  });

  it("does not show the Nightly welcome again after an IndexedDB reload", async () => {
    const storage = openStore();
    const first = createWebPlatform({
      storage,
      version,
      now: () => 1_700_000_000,
    });
    const opened = await first.snapshot();
    expect(
      showNightlyWelcome(
        opened?.release?.version,
        opened?.release?.nightly_welcome_seen,
      ),
    ).toBe(true);
    await first.acknowledgeNightlyWelcome(version);
    const reopened = createIndexedDbStorage({
      indexedDB,
      localStorage: memory(),
      databaseName: lastDatabase,
    });
    const second = createWebPlatform({
      storage: reopened,
      version,
      now: () => 1_700_000_100,
    });
    const again = await second.snapshot();
    expect(again?.release?.nightly_welcome_seen).toBe(version);
    expect(
      showNightlyWelcome(
        again?.release?.version,
        again?.release?.nightly_welcome_seen,
      ),
    ).toBe(false);
  });
});
