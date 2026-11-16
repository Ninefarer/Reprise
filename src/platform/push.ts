/**
 * Web Push client for the Nightly PWA.
 *
 * The worker and its HTTP API are documented in `docs/PWA-PUSH.md`.
 * Task titles, notes, and descriptions never leave the device. A reminder
 * time is only an id, a unix second, and a category.
 */

export interface ReminderTime {
  /** Event id already stored on the device. Not a task title. */
  id: string;
  /** Unix seconds. */
  at: number;
  /** Scheduled, Deadline, Snoozed, Settled, Waiting, or DailyReview. */
  category: string;
}

export type PushSubscriptionState =
  | { status: "unsupported" }
  | { status: "unconfigured"; reason: string }
  | { status: "subscribed"; endpoint: string };

export interface ReminderSyncResult {
  /** "accepted" is returned only when the worker answers 2xx. */
  status: "unconfigured" | "unsupported" | "accepted";
  /** How many reminder times were prepared. */
  count: number;
}

export interface PushClient {
  subscribe(): Promise<PushSubscriptionState>;
  syncReminderTimes(reminders: readonly ReminderTime[]): Promise<ReminderSyncResult>;
}

const DEVICE_KEY = "reprise.nightly.push-device";
const unconfiguredReason =
  "Closed-app reminders are not connected. The Nightly push service is not deployed from this branch.";

let memoryDeviceId: string | null = null;

/** Drop every field except the three the push service is allowed to see. */
export function reminderTimes(input: readonly ReminderTime[]): ReminderTime[] {
  return input.map((item) => ({
    id: String(item.id),
    at: Number(item.at),
    category: String(item.category),
  }));
}

function pushAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined"
  );
}

function envString(name: "VITE_PUSH_WORKER_URL" | "VITE_PUSH_SHARED_SECRET"): string {
  const fromMeta = (import.meta.env as unknown as Record<string, unknown>)[name];
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProcess = proc?.env?.[name];
  return typeof fromProcess === "string" ? fromProcess.trim() : "";
}

function workerConfig(): { url: string; secret: string } | null {
  const rawUrl = envString("VITE_PUSH_WORKER_URL");
  const secret = envString("VITE_PUSH_SHARED_SECRET");
  if (!rawUrl || !secret) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1";
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return { url: `${url.origin}${path}`, secret };
}

function deviceId(): string {
  try {
    const stored = globalThis.localStorage?.getItem(DEVICE_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,80}$/.test(stored)) {
      memoryDeviceId = stored;
      return stored;
    }
  } catch {
    /* Private browsing can refuse storage. Keep the id for this page. */
  }
  if (!memoryDeviceId) memoryDeviceId = crypto.randomUUID();
  try {
    globalThis.localStorage?.setItem(DEVICE_KEY, memoryDeviceId);
  } catch {
    /* The in-memory id still lets this page subscribe and sync together. */
  }
  return memoryDeviceId;
}

function decodePublicKey(value: string): ArrayBuffer {
  const pad = (4 - (value.length % 4)) % 4;
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The service worker did not become ready.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function subscribeToReminders(): Promise<PushSubscriptionState> {
  if (!pushAvailable()) return { status: "unsupported" };
  const config = workerConfig();
  if (!config) return { status: "unconfigured", reason: unconfiguredReason };
  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, 8000);
    const keyResponse = await fetch(`${config.url}/vapid-public-key`);
    if (!keyResponse.ok) {
      return { status: "unconfigured", reason: "The push service did not provide a key." };
    }
    const keyBody = (await keyResponse.json()) as { publicKey?: unknown };
    if (typeof keyBody.publicKey !== "string" || keyBody.publicKey.length === 0) {
      return { status: "unconfigured", reason: "The push service did not provide a key." };
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodePublicKey(keyBody.publicKey),
    });
    const saved = await fetch(`${config.url}/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-reprise-push-secret": config.secret,
      },
      body: JSON.stringify({
        deviceId: deviceId(),
        subscription: subscription.toJSON(),
      }),
    });
    if (!saved.ok) {
      return { status: "unconfigured", reason: "The push service did not accept this device." };
    }
    return { status: "subscribed", endpoint: subscription.endpoint };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push subscription failed.";
    return { status: "unconfigured", reason: message };
  }
}

export async function syncReminderTimes(
  reminders: readonly ReminderTime[],
): Promise<ReminderSyncResult> {
  const prepared = reminderTimes(reminders);
  const config = workerConfig();
  if (!config) return { status: "unconfigured", count: prepared.length };
  if (!pushAvailable()) return { status: "unsupported", count: prepared.length };
  try {
    const response = await fetch(`${config.url}/reminders`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-reprise-push-secret": config.secret,
      },
      body: JSON.stringify({ deviceId: deviceId(), reminders: prepared }),
    });
    if (!response.ok) return { status: "unconfigured", count: prepared.length };
    return { status: "accepted", count: prepared.length };
  } catch {
    return { status: "unconfigured", count: prepared.length };
  }
}

export function createPushStub(): PushClient {
  return {
    subscribe: subscribeToReminders,
    syncReminderTimes,
  };
}
