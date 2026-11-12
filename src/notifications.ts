import type { Notice } from "./model";
export const notificationCategories: Record<string, string> = {
  Scheduled: "Scheduled",
  Deadline: "Deadline",
  Snoozed: "Snoozed",
  Settled: "Settled",
  Waiting: "Waiting",
  DailyReview: "Daily Review",
  Diagnostic: "Diagnostic",
  Updates: "Updates",
  Overdue: "Overdue",
};
export const reminderCategories = [
  "Scheduled",
  "Deadline",
  "Snoozed",
  "Settled",
  "Waiting",
  "DailyReview",
];
export function categoryLabel(id: string): string {
  return (
    notificationCategories[id] ??
    id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ")
  );
}
export type NoticeAction = "read" | "dismiss" | "clear_read" | "clear_all";
export function filterNotices(
  notices: Notice[],
  category: string,
  unread: boolean,
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return notices
    .filter(
      (n) =>
        (!unread || !n.read) &&
        (category === "All" || n.category === category) &&
        `${categoryLabel(n.category)} ${n.title} ${n.message}`
          .toLocaleLowerCase()
          .includes(needle),
    )
    .slice()
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id));
}
