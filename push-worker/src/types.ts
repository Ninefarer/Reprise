export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  PUSH_KV: KvStore;
  ALLOWED_ORIGIN: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  PUSH_SHARED_SECRET: string;
}

export interface SubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ReminderRecord {
  id: string;
  at: number;
  category: string;
  attempts?: number;
}

export interface PushLogEntry {
  at: string;
  deviceId: string;
  endpointHost: string;
  status: number;
  reason: string;
  apnsId: string | null;
  reminderId: string | null;
  kind: "reminder" | "test";
}

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  review?: boolean;
}

export interface SendResult {
  ok: boolean;
  stale: boolean;
  status: number;
  reason: string;
  endpointHost: string;
  apnsId: string | null;
}

export const LIMITS = {
  maxReminders: 500,
  maxTitleCodePoints: 120,
  maxAttempts: 5,
  logLimit: 50,
  maxFutureMs: 366 * 24 * 60 * 60 * 1000,
  maxBodyBytes: 32_768,
  reminderTtlSeconds: 60 * 60,
  testTtlSeconds: 5 * 60,
  jwtLifetimeSeconds: 12 * 60 * 60,
  jwtReuseMs: 60 * 60 * 1000,
  recordSize: 4096,
} as const;
