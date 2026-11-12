import { statuses, type Status } from "./model";

/** Presentation categories only. Resurfaced never becomes a lifecycle status. */
export type TaskCategory = Status | "Resurfaced";
export function taskCategory(value: string): TaskCategory | undefined {
  return value === "Resurfaced" || statuses.includes(value as Status)
    ? (value as TaskCategory)
    : undefined;
}
export function reviewCategory(title: string): TaskCategory | undefined {
  return title === "Today"
    ? "Scheduled"
    : title === "Waiting follow-ups"
      ? "Waiting"
      : taskCategory(title);
}
