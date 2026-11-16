import type {
  History,
  Settings,
  Snapshot,
  Status,
  Task,
  VisualPreferences,
} from "../model";
import type { ReminderTime } from "./push";
import {
  type StoredDocument,
  type StoredEvent,
  type StoredHistory,
  type StoredNotice,
  type WebStorage,
} from "./storage";
import type {
  BrowserNotificationPermission,
  DiagnosticsReport,
  LocalNotification,
  SidebarPreferencesInput,
} from "./types";

export interface WebSessionOptions {
  storage: WebStorage;
  version: string;
  now?: () => number;
  permission?: () => BrowserNotificationPermission;
  systemVisuals?: () => Snapshot["system_visuals"];
}

export interface ReminderPass {
  changed: boolean;
  deliver: LocalNotification[];
  reminders: ReminderTime[];
}

interface DeletionReceipt {
  task: Task;
  history: StoredHistory[];
  events: StoredEvent[];
  notifications: StoredNotice[];
  children: { before: string; after: string }[];
}

const groups = ["general", "tasks", "history", "app"] as const;
const preferenceFields = [
  "name",
  "settlement_mode",
  "return_time",
  "review_time",
  "daily_review",
  "quiet_start",
  "quiet_end",
  "notifications",
  "categories",
  "close_to_tray",
  "command_shortcut",
] as const;

export function createWebSession(options: WebSessionOptions) {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const permission = options.permission ?? (() => "default" as const);
  const systemVisuals =
    options.systemVisuals ??
    (() => ({
      auto_hide_scrollbars: null,
      advanced_effects: null,
      animations_enabled: null,
    }));
  const receipts = new Map<string, DeletionReceipt>();
  let chain: Promise<unknown> = Promise.resolve();
  let heartbeat: number | null = null;
  let schedulerError: string | null = null;

  async function load(): Promise<StoredDocument> {
    const existing = await options.storage.read();
    if (existing) return existing;
    const created = emptyDocument(options.version);
    await options.storage.write(created);
    return created;
  }

  function exclusive<T>(fn: (doc: StoredDocument) => T, persist: boolean) {
    const run = chain.then(async () => {
      const doc = await load();
      const draft = persist ? structuredClone(doc) : doc;
      const result = fn(draft);
      if (persist) await options.storage.write(draft);
      return result;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    snapshot(): Promise<Snapshot> {
      return exclusive(
        (doc) => toSnapshot(doc, options.version, systemVisuals()),
        false,
      );
    },
    capture(title: string) {
      return exclusive((doc) => {
        const at = now();
        return commitSave(doc, newTask(title, at), "Created", at);
      }, true);
    },
    saveTask(task: Task, action: string) {
      return exclusive((doc) => {
        const at = now();
        if (!doc.tasks.some((item) => item.id === task.id)) {
          throw new Error("This task no longer exists.");
        }
        const next = { ...task };
        if (action === "Settled") {
          next.status = "Settled";
          next.settlement_mode = doc.settings.settlement_mode;
          next.wake_at = settlement(
            at,
            doc.settings.settlement_mode,
            doc.settings.return_time,
          );
        }
        return commitSave(doc, next, action, at);
      }, true);
    },
    saveSettings(settings: Settings) {
      return exclusive((doc) => {
        const next = { ...settings };
        next.name = next.name.trim();
        next.workspace = next.workspace.trim();
        if (
          [...next.name].length > 100 ||
          [...next.workspace].length > 120
        ) {
          throw new Error("Use a shorter profile or workspace name");
        }
        if (!["system", "light", "dark"].includes(next.theme)) {
          throw new Error("Choose System, Light or Dark");
        }
        validateCommandShortcut(next.command_shortcut ?? "Ctrl+K");
        const current = doc.settings;
        next.profile_image = current.profile_image;
        next.sidebar_width = current.sidebar_width;
        next.sidebar_collapsed = current.sidebar_collapsed;
        next.sidebar_groups = current.sidebar_groups;
        next.notification_panel_pinned = current.notification_panel_pinned;
        next.accent = current.accent;
        next.animation = current.animation;
        next.desktop_glass = current.desktop_glass;
        next.desktop_material = current.desktop_material;
        next.desktop_tint = current.desktop_tint;
        next.theme = current.theme;
        next.theme_family = current.theme_family;
        next.density = current.density;
        next.material = current.material;
        next.glass_coverage = current.glass_coverage;
        next.blur_intensity = current.blur_intensity;
        next.modal_backdrop = current.modal_backdrop;
        next.scrollbars = current.scrollbars;
        next.last_seen_release = current.last_seen_release;
        doc.settings = next;
      }, true);
    },
    savePreferencePatch(patch: Partial<Settings>) {
      return exclusive((doc) => {
        const unknown = Object.keys(patch).find(
          (key) =>
            !preferenceFields.includes(key as (typeof preferenceFields)[number]),
        );
        if (unknown) throw new Error("Unknown preference field");
        const next = { ...doc.settings, ...patch };
        next.name = next.name.trim();
        if ([...next.name].length > 100) {
          throw new Error("Use a shorter display name");
        }
        if (!["next_day", "24h"].includes(next.settlement_mode)) {
          throw new Error("Choose a supported settlement mode");
        }
        for (const time of [
          next.return_time,
          next.review_time,
          next.quiet_start,
          next.quiet_end,
        ]) {
          if (!validTime(time)) throw new Error("Enter times as HH:mm");
        }
        validateCommandShortcut(next.command_shortcut ?? "Ctrl+K");
        doc.settings = next;
      }, true);
    },
    visualPreferences(patch: Partial<VisualPreferences>) {
      return exclusive((doc) => {
        applyVisual(doc.settings, patch);
      }, true);
    },
    taskHistory(id: string): Promise<History[]> {
      return exclusive(
        (doc) =>
          doc.history
            .filter((entry) => entry.task_id === id)
            .map(({ at, action, before, after }) => ({
              at,
              action,
              before,
              after,
            }))
            .reverse(),
        false,
      );
    },
    readNotice(id: string) {
      return exclusive((doc) => {
        manageNotices(doc, "read", [id], now());
      }, true);
    },
    manageNotifications(action: string, ids: string[]) {
      return exclusive((doc) => {
        manageNotices(doc, action, ids, now());
      }, true);
    },
    notificationPanelPreferences(pinned: boolean) {
      return exclusive((doc) => {
        doc.settings.notification_panel_pinned = pinned;
      }, true);
    },
    sidebarPreferences(input: SidebarPreferencesInput) {
      return exclusive((doc) => {
        if (input.width != null) {
          doc.settings.sidebar_width = Math.min(340, Math.max(190, input.width));
        }
        if (input.collapsed != null) {
          doc.settings.sidebar_collapsed = input.collapsed;
        }
        if (input.groups) {
          const current = { ...(doc.settings.sidebar_groups ?? {}) };
          for (const [id, expanded] of Object.entries(input.groups)) {
            if (!groups.includes(id as (typeof groups)[number])) {
              throw new Error("Unknown navigation group");
            }
            current[id as (typeof groups)[number]] = expanded;
          }
          doc.settings.sidebar_groups = current;
        }
      }, true);
    },
    acknowledgeRelease(version: string) {
      return exclusive((doc) => {
        if (version !== options.version) {
          throw new Error("Only the installed release can be acknowledged");
        }
        doc.settings.last_seen_release = version;
      }, true);
    },
    deleteTask(id: string, expectedUpdatedAt: number) {
      const token = crypto.randomUUID();
      return exclusive((doc) => {
        const task = doc.tasks.find((item) => item.id === id);
        if (!task) throw new Error("This task no longer exists.");
        if (task.updated_at !== expectedUpdatedAt) {
          throw new Error(
            "This task changed elsewhere. Reload it before deleting.",
          );
        }
        const at = now();
        const children = doc.tasks
          .filter((item) => item.parent_task_id === id)
          .map((item) => ({ before: JSON.stringify(item) }));
        for (const child of doc.tasks) {
          if (child.parent_task_id === id) {
            child.parent_task_id = null;
            child.updated_at = Math.max(child.updated_at + 1, at);
          }
        }
        const receipt: DeletionReceipt = {
          task: { ...task },
          history: doc.history
            .filter((entry) => entry.task_id === id)
            .map((entry) => ({ ...entry })),
          events: doc.events
            .filter((event) => event.task_id === id)
            .map((event) => ({ ...event })),
          notifications: doc.notifications
            .filter((notice) => notice.task_id === id)
            .map((notice) => ({ ...notice })),
          children: children.map((child) => {
            const parsed = JSON.parse(child.before) as Task;
            const current = doc.tasks.find((item) => item.id === parsed.id)!;
            return { before: child.before, after: JSON.stringify(current) };
          }),
        };
        doc.tasks = doc.tasks.filter((item) => item.id !== id);
        doc.history = doc.history.filter((entry) => entry.task_id !== id);
        doc.events = doc.events.filter((event) => event.task_id !== id);
        doc.notifications = doc.notifications.filter(
          (notice) => notice.task_id !== id,
        );
        return receipt;
      }, true).then((receipt) => {
        receipts.set(token, receipt);
        return token;
      });
    },
    undoDeletion(token: string) {
      const receipt = receipts.get(token);
      if (!receipt) {
        return Promise.reject(new Error("Deletion can no longer be undone."));
      }
      receipts.delete(token);
      return exclusive((doc) => {
        const at = now();
        const retired = new Set(doc.retired.map((item) => item.id));
        doc.tasks.push({
          ...receipt.task,
          updated_at: Math.max(receipt.task.updated_at + 1, at),
        });
        doc.history.push(...receipt.history.map((entry) => ({ ...entry })));
        doc.events.push(...receipt.events.map((event) => ({ ...event })));
        for (const notice of receipt.notifications) {
          if (!retired.has(notice.id)) {
            doc.notifications.push({ ...notice });
          }
        }
        for (const child of receipt.children) {
          const index = doc.tasks.findIndex(
            (item) => JSON.stringify(item) === child.after,
          );
          if (index < 0) continue;
          const restored = JSON.parse(child.before) as Task;
          restored.updated_at = Math.max(doc.tasks[index].updated_at + 1, at);
          doc.tasks[index] = restored;
        }
      }, true).catch((error) => {
        receipts.set(token, receipt);
        throw error;
      });
    },
    finalizeDeletion(token: string) {
      receipts.delete(token);
      return Promise.resolve();
    },
    taskAction(id: string, revision: number, action: string) {
      return exclusive((doc) => {
        const at = now();
        if (action === "Resume") return resume(doc, id, revision, at);
        if (action === "Surface") return surface(doc, id, revision, at);
        throw new Error("Unknown task action");
      }, true);
    },
    undoTask(id: string, revision: number) {
      return exclusive((doc) => undo(doc, id, revision, now()), true);
    },
    saveAvatar(pngBase64: string | null) {
      return exclusive((doc) => {
        if (pngBase64 == null) {
          doc.avatar = null;
          doc.settings.profile_image = null;
          return;
        }
        if (
          pngBase64.length > 2_000_000 ||
          !pngBase64.startsWith("iVBORw0KGgo")
        ) {
          throw new Error("Use a PNG avatar.");
        }
        doc.avatar = `data:image/png;base64,${pngBase64}`;
        doc.settings.profile_image = "web-avatar.png";
      }, true);
    },
    diagnostics(): Promise<DiagnosticsReport> {
      return exclusive((doc) => {
        const state = permission();
        const registration =
          state === "granted"
            ? "Browser notifications are allowed while this page is open. This does not schedule a reminder after Reprise is closed."
            : state === "denied"
              ? "Browser notifications are blocked."
              : state === "default"
                ? "Browser notifications are not allowed yet. Use Allow notifications in Settings. iOS only asks from that tap."
                : "This browser has no Notification API.";
        const errors = doc.notifications
          .filter((notice) => notice.error)
          .slice(0, 5)
          .map((notice) => ({
            at: notice.created_at,
            message: notice.error ?? "",
          }));
        return {
          health: {
            heartbeat,
            scheduler_error: schedulerError,
            tray_running: false,
            shortcut_error:
              "Quick Capture's global shortcut is not available in the browser.",
          },
          application_id: "com.reprise.nightly",
          registration,
          last_submission: doc.notifications.reduce<number | null>(
            (max, notice) =>
              notice.submitted_at == null
                ? max
                : max == null
                  ? notice.submitted_at
                  : Math.max(max, notice.submitted_at),
            null,
          ),
          errors,
        };
      }, false);
    },
    prepareTestNotification(): Promise<LocalNotification> {
      if (permission() !== "granted") {
        return Promise.reject(
          new Error(
            "Allow notifications from Settings before sending a test. iOS only asks from a tap.",
          ),
        );
      }
      return exclusive((doc) => {
        const at = now();
        const id = `test:${crypto.randomUUID()}`;
        const title = "Reprise reminder test";
        const body =
          "This alert is shown while Reprise is open. It is not a Windows toast and it is not scheduled for later.";
        doc.notifications.push({
          id,
          task_id: null,
          category: "Diagnostic",
          title,
          message: body,
          created_at: at,
          scheduled_at: at,
          submitted_at: null,
          state: "Pending",
          read: false,
        });
        return { title, body, tag: id, taskId: null, review: false };
      }, true);
    },
    markDelivered(ids: string[]) {
      return exclusive((doc) => {
        const at = now();
        for (const notice of doc.notifications) {
          if (ids.includes(notice.id) && notice.state === "Pending") {
            notice.state = "Submitted";
            notice.submitted_at = at;
          }
        }
      }, true);
    },
    markFailed(id: string, message: string) {
      return exclusive((doc) => {
        const notice = doc.notifications.find((item) => item.id === id);
        if (!notice) return;
        notice.state = "Failed";
        notice.error = message;
      }, true);
    },
    async tick(): Promise<ReminderPass> {
      const run = chain.then(async () => {
        const at = now();
        heartbeat = at;
        const doc = await load();
        const before = JSON.stringify(doc);
        try {
          reconcile(doc, at);
          dailyReview(doc, at);
          cancelStaleDaily(doc, at);
          schedulerError = null;
        } catch (error) {
          schedulerError = String(error);
          return { changed: false, deliver: [], reminders: [] };
        }
        const changed = JSON.stringify(doc) !== before;
        if (changed) await options.storage.write(doc);
        return {
          changed,
          deliver: eligible(doc, at),
          reminders: doc.events
            .filter((event) => !event.processed)
            .map((event) => ({
              id: event.id,
              at: event.at,
              category: event.category,
            })),
        };
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

export type WebSession = ReturnType<typeof createWebSession>;

function emptyDocument(version: string): StoredDocument {
  const settings = defaultSettings();
  if (!settings.onboarded && !settings.last_seen_release) {
    settings.last_seen_release = version;
  }
  return {
    version: 1,
    settings,
    tasks: [],
    history: [],
    notifications: [],
    retired: [],
    events: [],
    avatar: null,
  };
}

function defaultSettings(): Settings {
  return {
    name: "",
    workspace: "",
    theme: "system",
    density: "comfortable",
    onboarded: false,
    settlement_mode: "next_day",
    return_time: "09:00",
    review_time: "09:00",
    daily_review: true,
    quiet_start: "22:00",
    quiet_end: "08:00",
    notifications: true,
    close_to_tray: true,
    startup: false,
    shortcut: "Ctrl+Shift+Space",
    paused: false,
    categories: [
      "Scheduled",
      "Deadline",
      "Snoozed",
      "Settled",
      "Waiting",
      "DailyReview",
    ],
    profile_image: null,
    sidebar_width: 224,
    sidebar_collapsed: false,
    sidebar_groups: {},
    command_shortcut: "Ctrl+K",
    theme_family: "classic",
    material: "flat",
    glass_coverage: "menus",
    blur_intensity: 12,
    modal_backdrop: "dim",
    scrollbars: "system",
    last_seen_release: null,
    notification_panel_pinned: false,
    accent: "theme",
    animation: "subtle",
    desktop_glass: false,
    desktop_material: "clear",
    desktop_tint: 65,
  };
}

function toSnapshot(
  doc: StoredDocument,
  version: string,
  system: Snapshot["system_visuals"],
): Snapshot {
  const retired = new Set(doc.retired.map((item) => item.id));
  return {
    tasks: doc.tasks
      .slice()
      .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
      .map((task) => ({ ...task })),
    settings: { ...doc.settings },
    notifications: doc.notifications
      .filter((notice) => !retired.has(notice.id))
      .map((notice) => ({ ...notice }))
      .sort(
        (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
      ),
    avatar: doc.avatar,
    system_visuals: system,
    release: {
      version,
      acknowledged: doc.settings.last_seen_release ?? null,
      should_show: shouldShowRelease(
        version,
        doc.settings.last_seen_release ?? null,
      ),
    },
  };
}

export function shouldShowRelease(
  current: string,
  acknowledged: string | null,
): boolean {
  const next = parseVersion(current);
  if (!next) return false;
  if (!acknowledged) return true;
  const previous = parseVersion(acknowledged);
  if (!previous) return true;
  if (next.major !== previous.major) return next.major > previous.major;
  if (next.minor !== previous.minor) return next.minor > previous.minor;
  if (next.patch !== previous.patch) return next.patch > previous.patch;
  if (next.pre === previous.pre) return false;
  if (next.pre === null) return true;
  if (previous.pre === null) return false;
  return next.pre > previous.pre;
}

function parseVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
  };
}

function newTask(title: string, at: number): Task {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    status: "Inbox",
    priority: 0,
    energy: "",
    created_at: at,
    updated_at: at,
    scheduled_at: null,
    due_at: null,
    wake_at: null,
    completed_at: null,
    project: "",
    tags: "",
    recurrence: "",
    reason: "",
    review_at: null,
    review_reason: null,
    parent_task_id: null,
    settled_at: null,
    settlement_mode: null,
  };
}

function commitSave(
  doc: StoredDocument,
  task: Task,
  action: string,
  at: number,
): Task {
  const next: Task = { ...task, title: task.title.trim() };
  validateTask(next);
  const before = doc.tasks.find((item) => item.id === next.id) ?? null;
  if (before && before.updated_at !== task.updated_at) {
    throw new Error("This task changed elsewhere. Reload and try again.");
  }
  if (before) next.created_at = before.created_at;
  next.updated_at = before ? Math.max(before.updated_at + 1, at) : at;
  if (action === "Settled") next.settled_at = at;
  else if (action !== "Undone" && before) {
    next.settled_at = before.settled_at ?? null;
    next.settlement_mode = before.settlement_mode ?? null;
  }
  if (action !== "Undone") {
    next.completed_at =
      next.status === "Finished" ? (before?.completed_at ?? at) : null;
  }
  if (action !== "Edited" && action !== "Undone") {
    next.review_at = null;
    next.review_reason = null;
  }
  if (!["Settled", "Snoozed", "Waiting"].includes(next.status)) {
    next.wake_at = null;
  }
  const previous = doc.history.filter((entry) => entry.task_id === next.id).at(-1);
  const restoreIds =
    action === "Undone" && previous
      ? cancelledIds(previous.after)
      : [];
  const closing = next.status === "Finished" || next.status === "Dropped";
  const cancelled = doc.notifications.filter(
    (notice) =>
      notice.task_id === next.id &&
      notice.state === "Pending" &&
      (closing ||
        notice.category === "Snoozed" ||
        notice.category === "Settled" ||
        notice.category === "Waiting" ||
        (notice.category === "Scheduled" &&
          notice.scheduled_at !== next.scheduled_at) ||
        (notice.category === "Deadline" &&
          notice.scheduled_at !== next.due_at)),
  );
  for (const notice of cancelled) notice.state = "Cancelled";
  doc.history.push({
    task_id: next.id,
    at,
    action,
    before: before ? JSON.stringify(before) : null,
    after: JSON.stringify({
      ...next,
      _cancelled_notice_ids: cancelled.map((notice) => notice.id),
    }),
  });
  doc.events = doc.events.filter(
    (event) => !(event.task_id === next.id && !event.processed),
  );
  if (action === "Undone") {
    const retired = new Set(doc.retired.map((item) => item.id));
    for (const id of restoreIds) {
      const notice = doc.notifications.find(
        (item) =>
          item.id === id &&
          item.task_id === next.id &&
          item.state === "Cancelled",
      );
      if (notice && !retired.has(id)) notice.state = "Pending";
    }
  }
  if (!closing) {
    const wakeCategory =
      next.status === "Settled"
        ? "Settled"
        : next.status === "Waiting"
          ? "Waiting"
          : "Snoozed";
    const pairs: [string, number | null][] = [
      ["Scheduled", next.scheduled_at],
      ["Deadline", next.due_at],
      [wakeCategory, next.review_at == null ? next.wake_at : null],
    ];
    for (const [category, when] of pairs) {
      if (when == null) continue;
      const id = ["Settled", "Snoozed", "Waiting"].includes(category)
        ? `${next.id}:${category}:${when}:${next.updated_at}`
        : `${next.id}:${category}:${when}`;
      if (!doc.events.some((event) => event.id === id)) {
        doc.events.push({
          id,
          task_id: next.id,
          category,
          at: when,
          processed: false,
        });
      }
    }
  }
  const index = doc.tasks.findIndex((item) => item.id === next.id);
  if (index >= 0) doc.tasks[index] = next;
  else doc.tasks.push(next);
  return { ...next };
}

function cancelledIds(after: string): string[] {
  try {
    const parsed = JSON.parse(after) as { _cancelled_notice_ids?: unknown };
    return Array.isArray(parsed._cancelled_notice_ids)
      ? parsed._cancelled_notice_ids.filter(
          (id): id is string => typeof id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function validateTask(task: Task) {
  if (!task.title || [...task.title].length > 500) {
    throw new Error("Title must contain 1–500 characters");
  }
  if (task.description.length > 100_000 || task.priority > 3) {
    throw new Error("Invalid task fields");
  }
  if (task.status === "Scheduled" && task.scheduled_at == null) {
    throw new Error("Choose a scheduled date");
  }
  if (
    (task.status === "Snoozed" || task.status === "Settled") &&
    task.wake_at == null &&
    task.review_at == null
  ) {
    throw new Error("Choose a return time");
  }
  if (!["", "daily", "weekly"].includes(task.recurrence)) {
    throw new Error("Unsupported recurrence");
  }
}

function resume(
  doc: StoredDocument,
  id: string,
  revision: number,
  at: number,
): Task {
  const current = requireTask(doc, id);
  if (current.updated_at !== revision) {
    throw new Error("Task changed. Reopen it and try again.");
  }
  if (current.status !== "Settled" && current.status !== "Waiting") {
    throw new Error("Only Settled and Waiting tasks can be resumed.");
  }
  const task = { ...current, status: "Inbox" as Status };
  for (const entry of doc.history
    .filter((item) => item.task_id === id)
    .slice()
    .reverse()) {
    if (!entry.before) continue;
    try {
      const old = JSON.parse(entry.before) as Task;
      if (["Inbox", "DoNow", "Scheduled"].includes(old.status)) {
        task.status =
          old.status === "Scheduled" && task.scheduled_at == null
            ? "Inbox"
            : old.status;
        break;
      }
    } catch {
      /* skip a history row that is not a task */
    }
  }
  return commitSave(doc, task, "Resumed", at);
}

function surface(
  doc: StoredDocument,
  id: string,
  revision: number,
  at: number,
): Task {
  const task = { ...requireTask(doc, id) };
  if (task.updated_at !== revision) {
    throw new Error("Task changed. Reopen it and try again.");
  }
  if (
    (task.status !== "Settled" && task.status !== "Snoozed") ||
    task.review_at != null
  ) {
    throw new Error("This task is not awaiting a return time.");
  }
  const before = JSON.stringify(task);
  const category = task.status === "Settled" ? "Settled" : "Snoozed";
  task.wake_at = null;
  task.review_at = at;
  task.review_reason =
    category === "Settled"
      ? "Returned early from settlement"
      : "Woken early from snooze";
  task.updated_at = Math.max(task.updated_at + 1, at);
  const index = doc.tasks.findIndex((item) => item.id === id);
  doc.tasks[index] = task;
  for (const event of doc.events) {
    if (event.task_id === id && event.category === category && !event.processed) {
      event.processed = true;
    }
  }
  for (const notice of doc.notifications) {
    if (
      notice.task_id === id &&
      notice.category === category &&
      notice.state === "Pending"
    ) {
      notice.state = "Cancelled";
    }
  }
  doc.history.push({
    task_id: id,
    at,
    action: category === "Settled" ? "ResurfaceNow" : "WakeNow",
    before,
    after: JSON.stringify(task),
  });
  return { ...task };
}

function undo(doc: StoredDocument, id: string, revision: number, at: number) {
  const current = requireTask(doc, id);
  if (current.updated_at !== revision) {
    throw new Error("This task changed again; undo is no longer available.");
  }
  const latest = doc.history.filter((entry) => entry.task_id === id).at(-1);
  if (
    !latest ||
    at < latest.at ||
    ["Edited", "Created", "Undone", "Resurfaced"].includes(latest.action)
  ) {
    throw new Error("Undo is no longer available.");
  }
  if (!latest.before) throw new Error("No previous task state");
  const old = JSON.parse(latest.before) as Task;
  old.updated_at = revision;
  return commitSave(doc, old, "Undone", at);
}

function requireTask(doc: StoredDocument, id: string) {
  const task = doc.tasks.find((item) => item.id === id);
  if (!task) throw new Error("This task no longer exists.");
  return task;
}

function reconcile(doc: StoredDocument, at: number) {
  for (const event of doc.events) {
    if (event.processed || event.at > at) continue;
    const task = doc.tasks.find((item) => item.id === event.task_id);
    event.processed = true;
    if (!task) continue;
    if (["Snoozed", "Settled", "Waiting"].includes(event.category)) {
      const before = JSON.stringify(task);
      task.review_at = at;
      task.review_reason = `${event.category} reminder`;
      task.updated_at = Math.max(task.updated_at + 1, at);
      doc.history.push({
        task_id: task.id,
        at,
        action: "Resurfaced",
        before,
        after: JSON.stringify(task),
      });
    }
    if (!doc.notifications.some((notice) => notice.id === event.id)) {
      doc.notifications.push({
        id: event.id,
        task_id: event.task_id,
        category: event.category,
        title: task.title,
        message: "Your intention is ready for another look.",
        created_at: at,
        scheduled_at: event.at,
        submitted_at: null,
        state: "Pending",
        read: false,
      });
    }
  }
}

function dailyReview(doc: StoredDocument, at: number) {
  if (!doc.settings.daily_review) return;
  if (!validTime(doc.settings.review_time)) return;
  const when = localClock(at, doc.settings.review_time);
  if (at < when) return;
  const id = `review:${localDateKey(at)}`;
  if (
    doc.retired.some((item) => item.id === id) ||
    doc.notifications.some((notice) => notice.id === id)
  ) {
    return;
  }
  const count = doc.tasks.filter((task) => openForReview(task, at)).length;
  if (count === 0) {
    doc.retired.push({ id, at });
    return;
  }
  const noun = count === 1 ? "task" : "tasks";
  doc.notifications.push({
    id,
    task_id: null,
    category: "DailyReview",
    title: "A moment to return",
    message: `You have ${count} ${noun} waiting for your attention.`,
    created_at: at,
    scheduled_at: when,
    submitted_at: null,
    state: "Pending",
    read: false,
  });
}

function openForReview(task: Task, at: number) {
  if (task.status === "Finished" || task.status === "Dropped") return false;
  return (
    task.status === "Inbox" ||
    task.review_at != null ||
    (task.due_at != null && task.due_at < at) ||
    (task.status === "Waiting" && task.wake_at != null && task.wake_at <= at) ||
    (task.scheduled_at != null && localDateKey(task.scheduled_at) === localDateKey(at))
  );
}

function cancelStaleDaily(doc: StoredDocument, at: number) {
  const today = localDateKey(at);
  for (const notice of doc.notifications) {
    if (
      notice.state === "Pending" &&
      notice.category === "DailyReview" &&
      localDateKey(notice.scheduled_at) !== today
    ) {
      notice.state = "Cancelled";
    }
  }
}

function eligible(doc: StoredDocument, at: number): LocalNotification[] {
  if (
    !doc.settings.notifications ||
    doc.settings.paused ||
    isQuiet(clock(at), doc.settings.quiet_start, doc.settings.quiet_end)
  ) {
    return [];
  }
  const allowed = new Set(doc.settings.categories);
  const retired = new Set(doc.retired.map((item) => item.id));
  return doc.notifications
    .filter(
      (notice) =>
        notice.state === "Pending" &&
        allowed.has(notice.category) &&
        !retired.has(notice.id),
    )
    .map((notice) => ({
      title: notice.title,
      body: notice.message,
      tag: notice.id,
      taskId: notice.task_id,
      review: notice.category === "DailyReview",
    }));
}

function manageNotices(
  doc: StoredDocument,
  action: string,
  ids: string[],
  at: number,
) {
  if (!["read", "dismiss", "clear_read", "clear_all"].includes(action)) {
    throw new Error("Unknown notification action");
  }
  for (const id of ids) {
    const notice = doc.notifications.find((item) => item.id === id);
    if (!notice) continue;
    if (action === "read") {
      if (doc.retired.some((item) => item.id === id)) continue;
      notice.read = true;
      notice.interaction_at = at;
      notice.action = "Read";
      continue;
    }
    if (action === "clear_read" && !notice.read) continue;
    if (
      notice.state === "UpdateDownloading" ||
      notice.state === "UpdateInstalling"
    ) {
      throw new Error(
        "Wait for the update operation to finish before removing its notification.",
      );
    }
    if (!doc.retired.some((item) => item.id === id)) {
      doc.retired.push({ id, at });
    }
    if (action !== "dismiss") {
      doc.notifications = doc.notifications.filter((item) => item.id !== id);
    }
  }
}

function applyVisual(settings: Settings, patch: Partial<VisualPreferences>) {
  const allowed = new Set([
    "theme",
    "theme_family",
    "density",
    "modal_backdrop",
    "scrollbars",
    "accent",
    "animation",
    "desktop_glass",
    "desktop_material",
    "desktop_tint",
  ]);
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) throw new Error(`Invalid ${key}`);
  }
  const choice = (
    key: keyof VisualPreferences,
    values: readonly string[],
  ) => {
    const value = patch[key];
    if (value == null) return;
    if (typeof value !== "string" || !values.includes(value)) {
      throw new Error(`Invalid ${key}`);
    }
    Object.assign(settings, { [key]: value });
  };
  if (patch.desktop_glass != null) {
    if (typeof patch.desktop_glass !== "boolean") {
      throw new Error("Invalid desktop_glass");
    }
    settings.desktop_glass = patch.desktop_glass;
  }
  if (patch.desktop_tint != null) {
    if (
      typeof patch.desktop_tint !== "number" ||
      patch.desktop_tint < 35 ||
      patch.desktop_tint > 90
    ) {
      throw new Error("Tint must be between 35 and 90");
    }
    settings.desktop_tint = patch.desktop_tint;
  }
  choice("desktop_material", ["clear", "acrylic"]);
  choice("theme", ["system", "light", "dark"]);
  choice("accent", ["theme", "lavender", "sage", "icy-blue", "rose", "neutral"]);
  choice("animation", ["off", "subtle", "expressive"]);
  choice("theme_family", ["classic", "pitch-black", "ashen-white", "peach"]);
  choice("density", ["comfortable", "compact"]);
  choice("modal_backdrop", ["dim", "blur", "none"]);
  choice("scrollbars", ["system", "always"]);
}

const reservedShortcuts = [
  "Ctrl+A",
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+X",
  "Ctrl+Z",
  "Ctrl+Y",
  "Ctrl+Shift+Z",
  "Ctrl+F",
  "Ctrl+Shift+N",
  "Ctrl+Shift+Space",
  "Ctrl+W",
  "Ctrl+T",
  "Ctrl+N",
  "Ctrl+L",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "Ctrl+F5",
  "Alt+F4",
];

function validateCommandShortcut(value: string) {
  const parts = value.split("+");
  let index = 0;
  const control = parts[index] === "Ctrl";
  if (control) index += 1;
  const alt = parts[index] === "Alt";
  if (alt) index += 1;
  if (parts[index] === "Shift") index += 1;
  const key = parts[index] ?? "";
  const validKey =
    (key.length === 1 && /[A-Z0-9]/.test(key)) ||
    key === "Space" ||
    /^F([1-9]|1[0-2])$/.test(key);
  if ((!control && !alt) || !validKey || parts.length !== index + 1) {
    throw new Error(
      "Use Ctrl or Alt with a letter, number, F1-F12 or Space",
    );
  }
  if (reservedShortcuts.includes(value)) {
    throw new Error("That shortcut is reserved for another command");
  }
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function settlement(at: number, mode: string, time: string) {
  if (mode === "24h") return at + 86400;
  if (!validTime(time)) throw new Error("Invalid local time");
  const [hours, minutes] = time.split(":").map(Number);
  const local = new Date(at * 1000);
  const next = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + 1,
    hours,
    minutes,
    0,
    0,
  );
  return Math.floor(next.getTime() / 1000);
}

function localClock(at: number, time: string) {
  if (!validTime(time)) throw new Error("Invalid local time");
  const [hours, minutes] = time.split(":").map(Number);
  const local = new Date(at * 1000);
  const next = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  return Math.floor(next.getTime() / 1000);
}

function clock(at: number) {
  const local = new Date(at * 1000);
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
}

function localDateKey(at: number) {
  const local = new Date(at * 1000);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function isQuiet(time: string, start: string, end: string) {
  if (start === end) return false;
  if (start < end) return time >= start && time < end;
  return time >= start || time < end;
}
