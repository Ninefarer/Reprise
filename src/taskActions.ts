import type { Task } from "./model";
export type ActionId =
  | "start"
  | "resume"
  | "surface"
  | "schedule"
  | "snooze"
  | "return"
  | "followup"
  | "settle"
  | "inbox"
  | "finish"
  | "drop"
  | "edit"
  | "history"
  | "delete"
  | "review";
export interface TaskAction {
  id: ActionId;
  label: string;
  icon: string;
}
const definitions: Record<ActionId, [string, string]> = {
  start: ["Start Now", "▶"],
  resume: ["Resume", "↩"],
  surface: ["Resurface Now", "↻"],
  schedule: ["Schedule", "▦"],
  snooze: ["Snooze", "◷"],
  return: ["Change Return Time", "◷"],
  followup: ["Change Follow-Up", "◷"],
  settle: ["Settle", "Ⅱ"],
  inbox: ["Move to Inbox", "▤"],
  finish: ["Finish", "✓"],
  drop: ["Drop", "×"],
  edit: ["Edit", "✎"],
  history: ["View History", "≡"],
  delete: ["Delete Permanently", "⌫"],
  review: ["Review", "↻"],
};
export function taskActions(t: Task): TaskAction[] {
  let ids: ActionId[];
  if (t.status === "Finished" || t.status === "Dropped")
    return [
      {
        id: "inbox",
        label: t.status === "Finished" ? "Reopen" : "Restore",
        icon: "↩",
      },
      ...(["history", "delete"] as ActionId[]).map((id) => ({
        id,
        label: definitions[id][0],
        icon: definitions[id][1],
      })),
    ];
  if (t.review_at !== null)
    ids = [
      "review",
      "start",
      "schedule",
      "snooze",
      "settle",
      "finish",
      "drop",
      "edit",
      "delete",
    ];
  else
    switch (t.status) {
      case "Inbox":
        ids = [
          "start",
          "schedule",
          "snooze",
          "settle",
          "finish",
          "edit",
          "delete",
        ];
        break;
      case "DoNow":
        ids = [
          "settle",
          "snooze",
          "schedule",
          "inbox",
          "finish",
          "edit",
          "delete",
        ];
        break;
      case "Scheduled":
        ids = [
          "start",
          "schedule",
          "snooze",
          "settle",
          "finish",
          "edit",
          "delete",
        ];
        break;
      case "Settled":
        ids = [
          "resume",
          "start",
          "surface",
          "return",
          "snooze",
          "schedule",
          "finish",
          "edit",
          "delete",
        ];
        break;
      case "Snoozed":
        ids = [
          "surface",
          "start",
          "snooze",
          "schedule",
          "settle",
          "finish",
          "edit",
          "delete",
        ];
        break;
      case "Waiting":
        ids = [
          "resume",
          "start",
          "followup",
          "schedule",
          "finish",
          "edit",
          "delete",
        ];
        break;
    }
  return ids.map((id) => ({
    id,
    label:
      id === "surface" && t.status === "Snoozed"
        ? "Wake Now"
        : id === "schedule" && t.status === "Scheduled"
          ? "Reschedule"
          : id === "snooze" && t.status === "Snoozed"
            ? "Change Snooze Time"
            : definitions[id][0],
    icon: definitions[id][1],
  }));
}
