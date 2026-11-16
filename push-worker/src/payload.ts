import type { NotificationPayload } from "./types";

const BODIES: Record<string, string> = {
  Scheduled: "Scheduled reminder",
  Deadline: "Deadline reminder",
  Snoozed: "Snoozed reminder",
  Settled: "Settled reminder",
  Waiting: "Waiting reminder",
  DailyReview: "Time for your daily review",
};

export function reminderPayload(reminder: { id: string; category: string }): NotificationPayload {
  const payload: NotificationPayload = {
    title: "Reprise",
    body: BODIES[reminder.category] ?? "A reminder is ready.",
    tag: reminder.id,
    url: "./",
  };
  if (reminder.category === "DailyReview") payload.review = true;
  return payload;
}

export function testPayload(input: { title: string; body: string; url: string }): NotificationPayload {
  return {
    title: input.title,
    body: input.body,
    tag: "reprise-test",
    url: input.url,
  };
}

export function encodePayload(payload: NotificationPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}
