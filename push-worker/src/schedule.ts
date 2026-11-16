import { reminderPayload } from "./payload";
import { sendNotification, topicFor, ttlFor } from "./send";
import {
  appendPushLog,
  deleteReminders,
  deleteSubscription,
  forgetDevice,
  listDevices,
  readReminders,
  readSubscription,
  writeReminders,
} from "./store";
import { LIMITS, type Env, type PushLogEntry, type ReminderRecord } from "./types";

export function selectDue(reminders: ReminderRecord[], nowMs: number): { due: ReminderRecord[]; pending: ReminderRecord[] } {
  const due: ReminderRecord[] = [];
  const pending: ReminderRecord[] = [];
  for (const reminder of reminders) {
    if (Number.isInteger(reminder.at) && reminder.at * 1000 <= nowMs) due.push(reminder);
    else pending.push(reminder);
  }
  due.sort((left, right) => left.at - right.at);
  return { due, pending };
}

export async function runSchedule(env: Env, nowMs: number, fetchImpl: typeof fetch = fetch): Promise<PushLogEntry[]> {
  const logged: PushLogEntry[] = [];
  const devices = await listDevices(env);
  for (const deviceId of devices) {
    const reminders = await readReminders(env, deviceId);
    const { due, pending } = selectDue(reminders, nowMs);
    if (due.length === 0) continue;
    const subscription = await readSubscription(env, deviceId);
    if (!subscription) continue;

    const kept = [...pending];
    let subscriptionGone = false;
    for (const reminder of due) {
      if (subscriptionGone) {
        kept.push(reminder);
        continue;
      }
      const result = await sendNotification({
        env,
        subscription,
        payload: reminderPayload(reminder),
        topic: await topicFor("reminder", reminder.id),
        ttl: ttlFor("reminder"),
        nowMs,
        fetchImpl,
      });
      const entry: PushLogEntry = {
        at: new Date(nowMs).toISOString(),
        deviceId,
        endpointHost: result.endpointHost,
        status: result.status,
        reason: result.reason,
        apnsId: result.apnsId,
        reminderId: reminder.id,
        kind: "reminder",
      };
      logged.push(entry);
      if (result.stale) {
        await deleteSubscription(env, deviceId);
        subscriptionGone = true;
        continue;
      }
      if (result.ok) continue;
      const attempts = (reminder.attempts ?? 0) + 1;
      if (attempts < LIMITS.maxAttempts) kept.push({ ...reminder, attempts });
    }

    if (subscriptionGone && kept.length === 0) {
      await deleteReminders(env, deviceId);
      await forgetDevice(env, deviceId);
    } else {
      await writeReminders(env, deviceId, kept);
    }
  }
  await appendPushLog(env, logged);
  return logged;
}
