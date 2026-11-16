/**
 * Web persistence seam for Nightly.
 *
 * The shipping store is IndexedDB (`createIndexedDbStorage`). The first read
 * copies a version 1 document out of the localStorage placeholder, then
 * removes that key. `createLocalStoragePlaceholder` stays for the migration
 * source and for tests. Callers, including `createWebSession`, keep using
 * `WebStorage` only.
 *
 * iOS keeps Home Screen storage in a separate partition from Safari tabs.
 * The same key does not share tasks between them. Say so in the UI; do not
 * try to bridge the partitions.
 *
 * Document shape is `StoredDocument` version 1. A reader that does not
 * understand `version` must throw and leave the saved bytes untouched.
 */

export const WEB_STORAGE_KEY = "reprise.nightly.pwa.v1";
export const WEB_STORAGE_VERSION = 1 as const;

export interface StoredEvent {
  id: string;
  task_id: string;
  category: string;
  at: number;
  processed: boolean;
}

export interface StoredHistory {
  task_id: string;
  at: number;
  action: string;
  before: string | null;
  after: string;
}

export interface StoredNotice {
  id: string;
  task_id: string | null;
  category: string;
  title: string;
  message: string;
  created_at: number;
  scheduled_at: number;
  submitted_at: number | null;
  state: string;
  read: boolean;
  interaction_at?: number | null;
  action?: string | null;
  error?: string | null;
}

export interface StoredDocument {
  version: typeof WEB_STORAGE_VERSION;
  settings: import("../model").Settings;
  tasks: import("../model").Task[];
  history: StoredHistory[];
  notifications: StoredNotice[];
  retired: { id: string; at: number }[];
  events: StoredEvent[];
  /** Data URL for the profile image, or null. Stays on device. */
  avatar: string | null;
  /**
   * Nightly welcome version the user dismissed with Continue to Nightly.
   * Desktop keeps that in process memory. Web reloads, so it lives on this
   * document. Omit it until the first dismiss. Round-trip the field; do not
   * bump `version` for its absence.
   */
  nightly_welcome_seen?: string | null;
}

export class WebStoragePendingError extends Error {
  readonly code = "pending" as const;
  constructor(method: "exportBackup" | "importBackup") {
    super(
      method === "exportBackup"
        ? "JSON export is not in this build."
        : "JSON import is not in this build.",
    );
    this.name = "WebStoragePendingError";
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface WebStorage {
  /** Storage key. The placeholder uses `WEB_STORAGE_KEY`. */
  readonly key: string;
  /**
   * Load the document. `null` means this key has never been written.
   * Throw, and do not write, when the bytes exist but are not version 1.
   */
  read(): Promise<StoredDocument | null>;
  /** Replace the whole document. A failed write must leave the previous bytes in place. */
  write(document: StoredDocument): Promise<void>;
  /**
   * Ask the browser to exempt this origin from eviction.
   * Placeholder: resolve `false`. Do not call `navigator.storage.persist()`.
   * Feno: call `navigator.storage.persist()` and return its result. The
   * Settings button starts this from a tap.
   */
  requestPersistence(): Promise<boolean>;
  /**
   * Return a JSON backup the user can download. Do not upload it.
   * Placeholder: reject with `WebStoragePendingError`.
   * Feno: serialize the current document. If this throws, leave storage as it was.
   */
  exportBackup(): Promise<string>;
  /**
   * Replace the document from a user-held JSON backup.
   * Placeholder: reject with `WebStoragePendingError`.
   * Feno: validate `version`, then write. Keep the previous document when
   * validation fails.
   */
  importBackup(json: string): Promise<void>;
}

function isDocument(value: unknown): value is StoredDocument {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { version?: unknown }).version === WEB_STORAGE_VERSION &&
    Array.isArray((value as { tasks?: unknown }).tasks) &&
    Array.isArray((value as { notifications?: unknown }).notifications)
  );
}

export function createLocalStoragePlaceholder(
  storage: StorageLike,
  key = WEB_STORAGE_KEY,
): WebStorage {
  return {
    key,
    async read() {
      const raw = storage.getItem(key);
      if (raw == null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          "Saved tasks could not be read. They were left untouched.",
        );
      }
      if (!isDocument(parsed)) {
        throw new Error(
          "Saved tasks use a different storage version. They were left untouched.",
        );
      }
      return parsed;
    },
    async write(document) {
      if (!isDocument(document)) {
        throw new Error("Refusing to store an incomplete task document.");
      }
      const raw = JSON.stringify(document);
      try {
        storage.setItem(key, raw);
      } catch {
        throw new Error(
          "This browser refused to store the tasks. The previous copy was left in place.",
        );
      }
    },
    async requestPersistence() {
      return false;
    },
    async exportBackup() {
      throw new WebStoragePendingError("exportBackup");
    },
    async importBackup() {
      throw new WebStoragePendingError("importBackup");
    },
  };
}

/** Process-local stand-in for tests. Not the shipping store. */
export function createMemoryStorage(key = WEB_STORAGE_KEY): WebStorage {
  let raw: string | null = null;
  return createLocalStoragePlaceholder(
    {
      getItem: () => raw,
      setItem: (_name, value) => {
        raw = value;
      },
      removeItem: () => {
        raw = null;
      },
    },
    key,
  );
}

export function browserLocalStorage(): WebStorage {
  return createLocalStoragePlaceholder(globalThis.localStorage);
}

const DB_STORE = "documents";
const DB_VERSION = 1;
const DEFAULT_DB_NAME = "reprise.nightly.pwa";

export interface IndexedDbStorageOptions {
  indexedDB: IDBFactory;
  localStorage?: StorageLike | null;
  key?: string;
  databaseName?: string;
  /** Test seam. Defaults to `navigator.storage.persist()`. */
  persist?: () => Promise<boolean> | boolean;
}

interface OpenCache {
  promises: Map<string, Promise<IDBDatabase>>;
}

const openCaches = new WeakMap<IDBFactory, OpenCache>();

function cacheFor(factory: IDBFactory): OpenCache {
  let cache = openCaches.get(factory);
  if (!cache) {
    cache = { promises: new Map() };
    openCaches.set(factory, cache);
  }
  return cache;
}

interface ReadOutcome {
  document: StoredDocument | null;
  dropLegacy: boolean;
}

/**
 * IndexedDB document store. Opening is safe to call more than once, including
 * from two tabs: one connection is shared per page, and a readwrite
 * transaction plus a Web Lock (when the browser has one) makes the
 * localStorage migration a single writer.
 */
export function createIndexedDbStorage(
  options: IndexedDbStorageOptions,
): WebStorage {
  const key = options.key ?? WEB_STORAGE_KEY;
  const databaseName = options.databaseName ?? DEFAULT_DB_NAME;
  const legacy = options.localStorage ?? null;
  const factory = options.indexedDB;
  const lockName = `${databaseName}:${key}`;

  function forget(db?: IDBDatabase) {
    const cache = cacheFor(factory);
    const current = cache.promises.get(databaseName);
    if (!db || !current) {
      cache.promises.delete(databaseName);
      return;
    }
    void current.then(
      (open) => {
        if (open === db) cache.promises.delete(databaseName);
      },
      () => {
        cache.promises.delete(databaseName);
      },
    );
  }

  function openDatabase(): Promise<IDBDatabase> {
    const cache = cacheFor(factory);
    const existing = cache.promises.get(databaseName);
    if (existing) return existing;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      request.onerror = () => {
        cache.promises.delete(databaseName);
        reject(request.error ?? new Error("IndexedDB could not be opened."));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          forget(db);
        };
        db.onclose = () => forget(db);
        resolve(db);
      };
    });
    cache.promises.set(databaseName, opening);
    return opening;
  }

  async function runTransaction<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const attempt = async () => {
      const db = await openDatabase();
      const tx = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);
      const done = transactionDone(tx);
      try {
        const result = await fn(store);
        await done;
        return result;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* The transaction may already have finished. */
        }
        await done.catch(() => undefined);
        throw error;
      }
    };
    try {
      return await attempt();
    } catch (error) {
      if (!isClosed(error)) throw error;
      forget();
      return attempt();
    }
  }

  async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const locks = globalThis.navigator?.locks;
    if (!locks?.request) return fn();
    return locks.request(lockName, () => fn());
  }

  function dropLegacy() {
    try {
      legacy?.removeItem(key);
    } catch {
      /* The IndexedDB copy is the one the app reads. */
    }
  }

  async function readDocument(): Promise<ReadOutcome> {
    return runTransaction("readwrite", (store) =>
      new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB request failed."));
        request.onsuccess = () => {
          try {
            const existing: unknown = request.result;
            if (existing !== undefined) {
              if (!isDocument(existing)) {
                reject(
                  new Error(
                    "Saved tasks use a different storage version. They were left untouched.",
                  ),
                );
                return;
              }
              resolve({ document: existing, dropLegacy: true });
              return;
            }
            const found = readLegacy(legacy, key);
            if (found.state === "absent") {
              resolve({ document: null, dropLegacy: false });
              return;
            }
            if (found.state === "invalid") {
              reject(new Error(found.message));
              return;
            }
            const put = store.put(found.document, key);
            put.onerror = () =>
              reject(put.error ?? new Error("IndexedDB request failed."));
            put.onsuccess = () =>
              resolve({ document: found.document, dropLegacy: true });
          } catch (error) {
            reject(error);
          }
        };
      }),
    );
  }

  return {
    key,
    async read() {
      const outcome = await exclusive(readDocument);
      if (outcome.dropLegacy) dropLegacy();
      return outcome.document;
    },
    async write(document) {
      if (!isDocument(document)) {
        throw new Error("Refusing to store an incomplete task document.");
      }
      await exclusive(() =>
        runTransaction("readwrite", (store) => requestToPromise(store.put(document, key))),
      );
      dropLegacy();
    },
    async requestPersistence() {
      try {
        const persist = options.persist ?? defaultPersist;
        return (await persist()) === true;
      } catch {
        return false;
      }
    },
    async exportBackup() {
      const document = await this.read();
      if (!document) {
        throw new Error("There are no saved tasks to export yet.");
      }
      return `${JSON.stringify(document, null, 2)}\n`;
    },
    async importBackup(json) {
      const document = parseBackup(json);
      await this.write(document);
    },
  };
}

let browserStore: WebStorage | null = null;

/** The store the Nightly web app reads. One instance per page. */
export function browserIndexedDbStorage(): WebStorage {
  if (browserStore) return browserStore;
  const factory = globalThis.indexedDB;
  if (!factory) return unavailableStorage();
  browserStore = createIndexedDbStorage({
    indexedDB: factory,
    localStorage: safeLocalStorage(),
  });
  return browserStore;
}

function unavailableStorage(key = WEB_STORAGE_KEY): WebStorage {
  const fail = async () => {
    throw new Error(
      "This browser cannot store tasks because IndexedDB is unavailable.",
    );
  };
  return {
    key,
    read: fail,
    write: async () => {
      await fail();
    },
    requestPersistence: async () => false,
    exportBackup: fail,
    importBackup: async () => {
      await fail();
    },
  };
}

function safeLocalStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function defaultPersist(): Promise<boolean> {
  try {
    const manager = globalThis.navigator?.storage;
    if (!manager || typeof manager.persist !== "function") {
      return Promise.resolve(false);
    }
    return Promise.resolve(manager.persist())
      .then((value) => value === true)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

type LegacyRead =
  | { state: "absent" }
  | { state: "invalid"; message: string }
  | { state: "ok"; document: StoredDocument };

function readLegacy(storage: StorageLike | null, key: string): LegacyRead {
  if (!storage) return { state: "absent" };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { state: "absent" };
  }
  if (raw == null) return { state: "absent" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      state: "invalid",
      message: "Saved tasks could not be read. They were left untouched.",
    };
  }
  if (!isDocument(parsed)) {
    return {
      state: "invalid",
      message:
        "Saved tasks use a different storage version. They were left untouched.",
    };
  }
  return { state: "ok", document: normalizeDocument(parsed) };
}

function normalizeDocument(document: StoredDocument): StoredDocument {
  // Copy every own field first so optional and future keys, including
  // `nightly_welcome_seen`, survive migration and import.
  return {
    ...document,
    version: WEB_STORAGE_VERSION,
    settings: document.settings,
    tasks: document.tasks,
    history: Array.isArray(document.history) ? document.history : [],
    notifications: document.notifications,
    retired: Array.isArray(document.retired) ? document.retired : [],
    events: Array.isArray(document.events) ? document.events : [],
    avatar: typeof document.avatar === "string" ? document.avatar : null,
  };
}

export function parseBackup(json: string): StoredDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json.replace(/^\uFEFF/, "").trim());
  } catch {
    throw new Error(
      "This backup could not be read. Saved tasks were left untouched.",
    );
  }
  if (!isBackupDocument(parsed)) {
    throw new Error(
      "This backup is not a Reprise version 1 file. Saved tasks were left untouched.",
    );
  }
  return normalizeDocument(parsed);
}

function isBackupDocument(value: unknown): value is StoredDocument {
  if (!isDocument(value)) return false;
  const document = value as StoredDocument;
  const settings = document.settings as { onboarded?: unknown; name?: unknown };
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    typeof settings.onboarded !== "boolean" ||
    typeof settings.name !== "string"
  ) {
    return false;
  }
  if (
    !Array.isArray(document.history) ||
    !Array.isArray(document.retired) ||
    !Array.isArray(document.events)
  ) {
    return false;
  }
  if (document.avatar !== null && typeof document.avatar !== "string") {
    return false;
  }
  return (
    document.tasks.every(isTaskRecord) &&
    document.notifications.every(isRecord) &&
    document.history.every(isRecord) &&
    document.events.every(isRecord) &&
    document.retired.every(isRecord)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTaskRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."));
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
  });
}

function isClosed(error: unknown): boolean {
  return error instanceof DOMException && error.name === "InvalidStateError";
}
