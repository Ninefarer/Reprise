import { base64urlDecode, codePointLength } from "./bytes";
import { LIMITS, type ReminderRecord, type SubscriptionRecord } from "./types";

export class PushInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushInputError";
  }
}

const DEVICE_ID = /^[A-Za-z0-9_-]{8,80}$/;
const REMINDER_ID = /^[A-Za-z0-9_.:-]{1,160}$/;
export const REMINDER_CATEGORIES = ["Scheduled", "Deadline", "Snoozed", "Settled", "Waiting", "DailyReview"] as const;

export function requireDeviceId(value: unknown): string {
  if (typeof value !== "string" || !DEVICE_ID.test(value)) {
    throw new PushInputError("deviceId must be 8 to 80 letters, numbers, _ or -");
  }
  return value;
}

export function normalizeTitle(value: unknown): string {
  if (typeof value !== "string") throw new PushInputError("title is required");
  const title = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!title) throw new PushInputError("title is required");
  if (codePointLength(title) > LIMITS.maxTitleCodePoints) {
    throw new PushInputError(`title must be ${LIMITS.maxTitleCodePoints} characters or fewer`);
  }
  return title;
}

export function parseReminders(value: unknown, nowMs: number): ReminderRecord[] {
  if (!Array.isArray(value)) throw new PushInputError("reminders must be an array");
  if (value.length > LIMITS.maxReminders) {
    throw new PushInputError(`a device can store ${LIMITS.maxReminders} reminders`);
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new PushInputError("each reminder must be an object");
    const record = item as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== "string" || !REMINDER_ID.test(id)) {
      throw new PushInputError("reminder id must be 1 to 160 letters, numbers, colon, _ or -");
    }
    if (seen.has(id)) throw new PushInputError(`duplicate reminder id ${id}`);
    seen.add(id);
    const at = record.at;
    if (typeof at !== "number" || !Number.isInteger(at) || at < 0) {
      throw new PushInputError("at must be unix seconds");
    }
    if (at > nowSeconds + Math.floor(LIMITS.maxFutureMs / 1000)) {
      throw new PushInputError("at must be within 366 days");
    }
    const category = record.category;
    if (typeof category !== "string" || !REMINDER_CATEGORIES.includes(category as (typeof REMINDER_CATEGORIES)[number])) {
      throw new PushInputError("category must be Scheduled, Deadline, Snoozed, Settled, Waiting, or DailyReview");
    }
    return { id, at, category };
  });
}

function decodeKey(value: unknown, label: string, length: number): string {
  if (typeof value !== "string") throw new PushInputError(`${label} is required`);
  let bytes: Uint8Array;
  try {
    bytes = base64urlDecode(value.trim());
  } catch {
    throw new PushInputError(`${label} must be base64url`);
  }
  if (bytes.length !== length) throw new PushInputError(`${label} has the wrong length`);
  return value.trim();
}

export function isBlockedPushHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal") return true;
  if (host.includes(":")) return blockedIpv6(host);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return blockedIpv4(host);
  return false;
}

function blockedIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function blockedIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return blockedIpv4(mapped[1]);
  return false;
}

export function parseSubscription(value: unknown): SubscriptionRecord {
  if (!value || typeof value !== "object") throw new PushInputError("subscription is required");
  const record = value as Record<string, unknown>;
  const nested = record.subscription && typeof record.subscription === "object"
    ? (record.subscription as Record<string, unknown>)
    : record;
  const endpoint = nested.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2000) throw new PushInputError("endpoint must be an https URL");
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new PushInputError("endpoint must be an https URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || isBlockedPushHost(url.hostname)) {
    throw new PushInputError("endpoint must be an https push service");
  }
  const keys = nested.keys;
  if (!keys || typeof keys !== "object") throw new PushInputError("subscription keys are required");
  const keyRecord = keys as Record<string, unknown>;
  const p256dh = decodeKey(keyRecord.p256dh, "p256dh", 65);
  if (base64urlDecode(p256dh)[0] !== 4) throw new PushInputError("p256dh must be an uncompressed P-256 point");
  const auth = decodeKey(keyRecord.auth, "auth", 16);
  return { endpoint: url.toString(), p256dh, auth };
}

export function notificationUrl(value: unknown, allowedOrigin: string): string {
  if (value === undefined) return "/";
  if (typeof value !== "string" || value.length > 2000) throw new PushInputError("url is invalid");
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PushInputError("url must be a path or an https URL on the allowed origin");
  }
  if (url.protocol !== "https:" || url.origin !== allowedOrigin) {
    throw new PushInputError("url must be a path or an https URL on the allowed origin");
  }
  return url.toString();
}
