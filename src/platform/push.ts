/**
 * Typed Web Push client for Nightly.
 *
 * Tyrant owns the worker, VAPID keys, and the HTTP API in `docs/PWA-PUSH.md`.
 * This stub does not create an account, deploy a worker, or send a request.
 * Task titles, notes, and descriptions never leave the device. A reminder
 * time is only an id, a unix second, and a category.
 *
 * Replace `subscribeToReminders` and `syncReminderTimes` when that document
 * names the endpoint. Keep this argument shape.
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
  /** "accepted" is reserved for the real client. This stub never returns it. */
  status: "unconfigured" | "unsupported" | "accepted";
  /** How many reminder times were prepared. None are transmitted. */
  count: number;
}

export interface PushClient {
  subscribe(): Promise<PushSubscriptionState>;
  syncReminderTimes(reminders: readonly ReminderTime[]): Promise<ReminderSyncResult>;
}

/** Drop every field except the three the push service is allowed to see. */
export function reminderTimes(input: readonly ReminderTime[]): ReminderTime[] {
  return input.map((item) => ({
    id: String(item.id),
    at: Number(item.at),
    category: String(item.category),
  }));
}

const unconfiguredReason =
  "Closed-app reminders are not connected. The Nightly push service is not deployed from this branch.";

export async function subscribeToReminders(): Promise<PushSubscriptionState> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof PushManager === "undefined"
  ) {
    return { status: "unsupported" };
  }
  return { status: "unconfigured", reason: unconfiguredReason };
}

export async function syncReminderTimes(
  reminders: readonly ReminderTime[],
): Promise<ReminderSyncResult> {
  const prepared = reminderTimes(reminders);
  void prepared;
  return { status: "unconfigured", count: prepared.length };
}

export function createPushStub(): PushClient {
  return {
    subscribe: subscribeToReminders,
    syncReminderTimes,
  };
}
