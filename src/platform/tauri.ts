import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen as listenEvent } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Platform } from "./types";

/**
 * Windows implementation. Argument names match the existing invoke payloads.
 * Tauri converts camelCase to snake_case at the Rust boundary. Do not rename
 * those keys or the desktop tests and commands will diverge.
 */
export const platform: Platform = {
  kind: "tauri",
  start() {},
  requestDurableStorage: async () => true,
  snapshot(query) {
    return query && Object.keys(query).length
      ? invoke("snapshot", { ...query })
      : invoke("snapshot");
  },
  capture: (title) => invoke("capture", { title }),
  saveTask: (task, action) => invoke("save_task", { task, action }),
  saveSettings: (settings) => invoke("save_settings", { settings }),
  savePreferencePatch: (patch) => invoke("save_preference_patch", { patch }),
  visualPreferences: (patch) => invoke("visual_preferences", { patch }),
  taskHistory: (id) => invoke("task_history", { id }),
  readNotice: (id) => invoke("read_notice", { id }),
  manageNotifications: (action, ids) =>
    invoke("manage_notifications", { action, ids }),
  notificationPanelPreferences: (pinned) =>
    invoke("notification_panel_preferences", { pinned }),
  sidebarPreferences: (input) => invoke("sidebar_preferences", { ...input }),
  acknowledgeRelease: (version) => invoke("acknowledge_release", { version }),
  deleteTask: (id, expectedUpdatedAt) =>
    invoke("delete_task", { id, expectedUpdatedAt }),
  undoDeletion: (token) => invoke("undo_deletion", { token }),
  finalizeDeletion: (token) => invoke("finalize_deletion", { token }),
  taskAction: (id, revision, action) =>
    invoke("task_action", { id, revision, action }),
  undoTask: (id, revision) => invoke("undo_task", { id, revision }),
  quit: () => invoke("quit_app"),
  saveAvatar: (pngBase64) => invoke("save_avatar", { pngBase64 }),
  diagnostics: () => invoke("diagnostics"),
  testNotification: () => invoke("test_notification"),
  windowReady: () => invoke("window_ready"),
  openIssueReport: () => invoke("open_issue_report"),
  checkUpdates: (automatic) =>
    automatic ? invoke("check_updates", { automatic: true }) : invoke("check_updates"),
  installUpdate: (noticeId) => invoke("install_update", { noticeId }),
  nativeGlass: (dark, allow) => invoke("native_glass", { dark, allow }),
  listen: (name, handler) => listenEvent(name, handler),
  clipboard: { readText, writeText },
  window: {
    hide: () => getCurrentWindow().hide(),
    setSize: (size) =>
      getCurrentWindow().setSize(new LogicalSize(size.width, size.height)),
    startDragging: () => getCurrentWindow().startDragging(),
    setTheme: (theme) => getCurrentWindow().setTheme(theme),
    theme: () => getCurrentWindow().theme(),
    onThemeChanged: (handler) =>
      getCurrentWindow().onThemeChanged((event) => handler(event)),
    onResized: (handler) =>
      getCurrentWindow().onResized(() => {
        handler();
      }),
  },
  notifications: {
    permission: () => "unsupported",
    requestPermission: async () => "unsupported",
    notify: async () => {},
  },
  push: {
    subscribe: async () => ({ status: "unsupported" }),
    syncReminderTimes: async (reminders) => ({
      status: "unsupported",
      count: reminders.length,
    }),
  },
};
