import { base64url } from "./bytes";
import { LIMITS, type Env, type PushLogEntry, type ReminderRecord, type SubscriptionRecord } from "./types";

const DEVICES_KEY = "devices";
const LOG_KEY = "push-log";

function subKey(deviceId: string): string {
  return `sub:${deviceId}`;
}

function remKey(deviceId: string): string {
  return `rem:${deviceId}`;
}

async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const text = await env.PUSH_KV.get(key);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function listDevices(env: Env): Promise<string[]> {
  const devices = await readJson<unknown>(env, DEVICES_KEY);
  if (!Array.isArray(devices)) return [];
  return devices.filter((item): item is string => typeof item === "string");
}

async function saveDevices(env: Env, devices: string[]): Promise<void> {
  await env.PUSH_KV.put(DEVICES_KEY, JSON.stringify([...new Set(devices)]));
}

export async function rememberDevice(env: Env, deviceId: string): Promise<void> {
  const devices = await listDevices(env);
  if (!devices.includes(deviceId)) await saveDevices(env, [...devices, deviceId]);
}

export async function forgetDevice(env: Env, deviceId: string): Promise<void> {
  const devices = await listDevices(env);
  if (devices.includes(deviceId)) await saveDevices(env, devices.filter((id) => id !== deviceId));
}

export async function readSubscription(env: Env, deviceId: string): Promise<SubscriptionRecord | null> {
  const value = await readJson<SubscriptionRecord>(env, subKey(deviceId));
  if (!value || typeof value.endpoint !== "string" || typeof value.p256dh !== "string" || typeof value.auth !== "string") {
    return null;
  }
  return { endpoint: value.endpoint, p256dh: value.p256dh, auth: value.auth };
}

export async function writeSubscription(env: Env, deviceId: string, subscription: SubscriptionRecord): Promise<void> {
  await env.PUSH_KV.put(subKey(deviceId), JSON.stringify(subscription));
  await rememberDevice(env, deviceId);
}

export async function deleteSubscription(env: Env, deviceId: string): Promise<void> {
  await env.PUSH_KV.delete(subKey(deviceId));
}

function tokenKey(deviceId: string): string {
  return `tok:${deviceId}`;
}

export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function readTokenHash(env: Env, deviceId: string): Promise<string | null> {
  return env.PUSH_KV.get(tokenKey(deviceId));
}

export async function writeTokenHash(env: Env, deviceId: string, token: string): Promise<void> {
  await env.PUSH_KV.put(tokenKey(deviceId), await hashDeviceToken(token));
}

export async function deleteToken(env: Env, deviceId: string): Promise<void> {
  await env.PUSH_KV.delete(tokenKey(deviceId));
}

export async function deviceTokenMatches(env: Env, deviceId: string, token: string): Promise<boolean> {
  if (!token || token.length > 128) return false;
  const stored = await readTokenHash(env, deviceId);
  if (!stored) return false;
  const actual = await hashDeviceToken(token);
  let diff = stored.length ^ actual.length;
  const length = Math.max(stored.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (stored.charCodeAt(index) || 0) ^ (actual.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export function storedReminder(reminder: ReminderRecord): ReminderRecord {
  const stored: ReminderRecord = { id: reminder.id, at: reminder.at, category: reminder.category };
  if (reminder.attempts && reminder.attempts > 0) stored.attempts = reminder.attempts;
  return stored;
}

export async function readReminders(env: Env, deviceId: string): Promise<ReminderRecord[]> {
  const value = await readJson<unknown>(env, remKey(deviceId));
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as ReminderRecord;
    if (typeof record.id !== "string" || typeof record.at !== "number" || typeof record.category !== "string") return [];
    return [storedReminder(record)];
  });
}

export async function writeReminders(env: Env, deviceId: string, reminders: ReminderRecord[]): Promise<void> {
  await env.PUSH_KV.put(remKey(deviceId), JSON.stringify(reminders.map(storedReminder)));
  await rememberDevice(env, deviceId);
}

export async function deleteReminders(env: Env, deviceId: string): Promise<void> {
  await env.PUSH_KV.delete(remKey(deviceId));
}

export async function readPushLog(env: Env): Promise<PushLogEntry[]> {
  const value = await readJson<unknown>(env, LOG_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PushLogEntry => Boolean(item) && typeof item === "object");
}

export async function appendPushLog(env: Env, entries: PushLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const current = await readPushLog(env);
  const next = [...entries].reverse().concat(current).slice(0, LIMITS.logLimit);
  await env.PUSH_KV.put(LOG_KEY, JSON.stringify(next));
}
