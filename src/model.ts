export type Status =
  | "Inbox"
  | "DoNow"
  | "Scheduled"
  | "Settled"
  | "Snoozed"
  | "Waiting"
  | "Finished"
  | "Dropped";
export const statuses: Status[] = [
  "Inbox",
  "DoNow",
  "Scheduled",
  "Settled",
  "Snoozed",
  "Waiting",
  "Finished",
  "Dropped",
];
export type View =
  | Status
  | "Home"
  | "Daily Review"
  | "Resurfaced"
  | "All Tasks"
  | "Notification History"
  | "Settings";
export type Density = "comfortable" | "compact";
export type Theme = "system" | "light" | "dark";
export type ThemeFamily = "classic" | "pitch-black" | "ashen-white";
export type Material = "flat" | "frosted" | "glass";
export type Accent =
  "theme" | "lavender" | "sage" | "icy-blue" | "rose" | "neutral";
export type AnimationPreference = "off" | "subtle" | "expressive";
export interface VisualPreferences {
  theme: Theme;
  theme_family: ThemeFamily;
  density: Density;
  modal_backdrop: "dim" | "blur" | "none";
  scrollbars: "system" | "always";
  accent: Accent;
  animation: AnimationPreference;
  desktop_glass: boolean;
  desktop_material: "clear" | "acrylic";
  desktop_tint: number;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: number;
  energy: string;
  created_at: number;
  updated_at: number;
  scheduled_at: number | null;
  due_at: number | null;
  wake_at: number | null;
  completed_at: number | null;
  project: string;
  tags: string;
  recurrence: string;
  reason: string;
  review_at: number | null;
  review_reason: string | null;
  parent_task_id: string | null;
  settled_at?: number | null;
  settlement_mode?: string | null;
}
export interface Settings {
  name: string;
  workspace: string;
  theme: Theme;
  density: Density;
  onboarded: boolean;
  settlement_mode: string;
  return_time: string;
  review_time: string;
  daily_review: boolean;
  quiet_start: string;
  quiet_end: string;
  notifications: boolean;
  close_to_tray: boolean;
  startup: boolean;
  shortcut: string;
  paused: boolean;
  categories: string[];
  profile_image?: string | null;
  sidebar_width?: number;
  sidebar_collapsed?: boolean;
  sidebar_groups?: Partial<
    Record<import("./navigation").NavigationGroup, boolean>
  >;
  command_shortcut?: string;
  theme_family?: ThemeFamily;
  /** Legacy floating-effect preferences retained for round-trip compatibility only. */
  material?: Material;
  glass_coverage?: "menus" | "all" | "off";
  blur_intensity?: number;
  modal_backdrop?: "dim" | "blur" | "none";
  scrollbars?: "system" | "always";
  last_seen_release?: string | null;
  notification_panel_pinned?: boolean;
  accent?: Accent;
  animation?: AnimationPreference;
  desktop_glass?: boolean;
  desktop_material?: "clear" | "acrylic";
  desktop_tint?: number;
}
export interface Notice {
  id: string;
  task_id: string | null;
  category: string;
  title: string;
  message: string;
  created_at: number;
  scheduled_at: number;
  submitted_at: number | null;
  state: string;
  read: boolean;
}
export interface History {
  at: number;
  action: string;
  before: string | null;
  after: string;
}
export interface Snapshot {
  system_visuals?: {
    auto_hide_scrollbars: boolean | null;
    advanced_effects: boolean | null;
    animations_enabled?: boolean | null;
  };
  release?: {
    version: string;
    acknowledged: string | null;
    should_show: boolean;
  };
  avatar?: string | null;
  tasks: Task[];
  settings: Settings;
  notifications: Notice[];
}
export const label = (s: string) =>
  s === "DoNow" ? "Do Now" : s === "Notification History" ? "Notifications" : s;
export const date = (n: number | null | undefined) =>
  n == null
    ? "Not set"
    : new Date(n * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
export const isOpen = (t: Task) => !["Finished", "Dropped"].includes(t.status);
export const isToday = (n: number | null, now: number) =>
  n !== null &&
  new Date(n * 1000).toDateString() === new Date(now * 1000).toDateString();
export const reviewGroups = (tasks: Task[], now: number) => [
  {
    title: "Resurfaced",
    description: "Ready for another look.",
    tasks: tasks.filter((t) => isOpen(t) && t.review_at !== null),
  },
  {
    title: "Inbox",
    description: "Give each intention a place.",
    tasks: tasks.filter((t) => t.status === "Inbox" && t.review_at === null),
  },
  {
    title: "Today",
    description: "Plans for this calendar day.",
    tasks: tasks.filter((t) => isOpen(t) && isToday(t.scheduled_at, now)),
  },
  {
    title: "Overdue",
    description: "Dates to reconsider, without pressure.",
    tasks: tasks.filter(
      (t) => isOpen(t) && t.due_at !== null && t.due_at < now,
    ),
  },
  {
    title: "Waiting follow-ups",
    description: "Check in; the dependency may still be unresolved.",
    tasks: tasks.filter(
      (t) => t.status === "Waiting" && t.wake_at !== null && t.wake_at <= now,
    ),
  },
];
export function tasksForView(tasks: Task[], view: View, now: number): Task[] {
  if (view === "All Tasks") return tasks;
  if (view === "Home")
    return tasks.filter(
      (t) =>
        isOpen(t) &&
        (t.status === "DoNow" ||
          t.review_at !== null ||
          isToday(t.scheduled_at, now)),
    );
  if (view === "Daily Review") {
    const ids = new Set(
      reviewGroups(tasks, now).flatMap((g) => g.tasks.map((t) => t.id)),
    );
    return tasks.filter((t) => ids.has(t.id));
  }
  if (view === "Resurfaced")
    return tasks.filter((t) => isOpen(t) && t.review_at !== null);
  return tasks.filter(
    (t) =>
      t.status === view &&
      (!["Settled", "Snoozed"].includes(view) || t.review_at === null),
  );
}
export const matches = (t: Task, q: string) =>
  `${t.title} ${t.description} ${t.project} ${t.tags}`
    .toLowerCase()
    .includes(q.trim().toLowerCase());
export function remaining(at: number | null, now: number) {
  if (at === null) return "No return time";
  const min = Math.ceil((at - now) / 60);
  if (min <= 0) return "Return due · awaiting scheduler";
  if (min < 60) return `Returns in ${min} min`;
  if (min < 1440) return `Returns in ${Math.floor(min / 60)}h ${min % 60}m`;
  return `Returns in ${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
}
export const localInput = (at: number | null) =>
  at === null
    ? ""
    : new Date(at * 1000 - new Date(at * 1000).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
export const parseInput = (value: string) =>
  value ? Math.floor(new Date(value).getTime() / 1000) : null;
