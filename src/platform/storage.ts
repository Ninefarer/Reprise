/**
 * Web persistence seam for Nightly.
 *
 * Shipping placeholder: `createLocalStoragePlaceholder` (localStorage).
 * `feature/pwa-storage` (Feno) replaces that function. Callers, including
 * `createWebSession`, should keep using `WebStorage` only.
 *
 * Do not add IndexedDB, `navigator.storage.persist()`, or JSON backup here.
 * Those methods are already on the interface so the replacement can land
 * without a second migration of the UI.
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
