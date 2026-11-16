import type {
  History,
  Settings,
  Snapshot,
  Task,
  VisualPreferences,
} from "../model";
import type {
  PushClient,
  PushSubscriptionState,
  ReminderSyncResult,
  ReminderTime,
} from "./push";

export type { PushClient, PushSubscriptionState, ReminderSyncResult, ReminderTime };

/**
 * Platform seam for Reprise.
 *
 * Windows Tauri keeps using `src/platform/tauri.ts`, which forwards every
 * call to the existing invoke, window, and clipboard APIs. The Nightly web
 * build uses `src/platform/web.ts`. UI code imports the active implementation
 * from `reprise:platform` (selected in `vite.config.ts`). Import these types
 * from `src/platform/types.ts`.
 *
 * Web persistence is `src/platform/storage.ts`. IndexedDB, durable-storage
 * permission, and JSON backup belong on `feature/pwa-storage` and should
 * replace the placeholder without changing this interface.
 *
 * Closed-app reminder delivery is `src/platform/push.ts`. The worker and
 * HTTP API belong in `docs/PWA-PUSH.md` and are not called from here.
 */
export type PlatformKind = "tauri" | "web";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export interface SnapshotQuery {
  background?: boolean;
  measure?: boolean;
  probe?: string;
}

export interface CheckUpdatesResult {
  notice_id: string | null;
  message?: string;
}

export interface NativeGlassResult {
  mode: string;
  error: string | null;
}

export interface DiagnosticsReport {
  health: {
    heartbeat: number | null;
    scheduler_error: string | null;
    tray_running: boolean;
    shortcut_error: string | null;
  };
  application_id: string;
  registration: string;
  last_submission: number | null;
  errors: { at: number; message: string }[];
}

export interface SidebarPreferencesInput {
  width: number | null;
  collapsed: boolean | null;
  groups: Settings["sidebar_groups"] | null;
}

export interface PlatformClipboard {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface PlatformWindow {
  hide(): Promise<void>;
  setSize(size: { width: number; height: number }): Promise<void>;
  startDragging(): Promise<void>;
  setTheme(theme: "light" | "dark" | null): Promise<void>;
  theme(): Promise<"light" | "dark" | null>;
  onThemeChanged(
    handler: (event: { payload: "light" | "dark" }) => void,
  ): Promise<() => void>;
  onResized(handler: () => void): Promise<() => void>;
}

export interface LocalNotification {
  title: string;
  body: string;
  tag: string;
  taskId: string | null;
  review: boolean;
}

export interface PlatformNotifications {
  /** Desktop returns "unsupported". Windows toasts are native, not this API. */
  permission(): BrowserNotificationPermission;
  /**
   * Must run inside the click or tap that requested it. iOS drops the prompt
   * if it is started from a timer or an effect.
   */
  requestPermission(): Promise<BrowserNotificationPermission>;
  /** Show a notification while this page is open. This does not schedule a later alert. */
  notify(input: LocalNotification): Promise<void>;
}

export interface Platform {
  readonly kind: PlatformKind;
  /**
   * Tauri: no-op. Web: register the service worker and start the open-page
   * reminder pass. Safe to call once from the entry point.
   */
  start(): void;
  /**
   * Tauri resolves true because tasks live in a SQLite file.
   * Web delegates to `WebStorage.requestPersistence()`. The placeholder
   * resolves false and does not call `navigator.storage.persist()`.
   * Call this from a user gesture.
   */
  requestDurableStorage(): Promise<boolean>;
  snapshot(query?: SnapshotQuery): Promise<Snapshot | null>;
  capture(title: string): Promise<Task>;
  saveTask(task: Task, action: string): Promise<Task>;
  saveSettings(settings: Settings): Promise<void>;
  savePreferencePatch(patch: Partial<Settings>): Promise<void>;
  visualPreferences(patch: Partial<VisualPreferences>): Promise<void>;
  taskHistory(id: string): Promise<History[]>;
  readNotice(id: string): Promise<void>;
  manageNotifications(action: string, ids: string[]): Promise<void>;
  notificationPanelPreferences(pinned: boolean): Promise<void>;
  sidebarPreferences(input: SidebarPreferencesInput): Promise<void>;
  acknowledgeRelease(version: string): Promise<void>;
  deleteTask(id: string, expectedUpdatedAt: number): Promise<string>;
  undoDeletion(token: string): Promise<void>;
  finalizeDeletion(token: string): Promise<void>;
  taskAction(id: string, revision: number, action: string): Promise<Task>;
  undoTask(id: string, revision: number): Promise<Task>;
  quit(): Promise<void>;
  saveAvatar(pngBase64: string | null): Promise<void>;
  diagnostics(): Promise<DiagnosticsReport>;
  testNotification(): Promise<void>;
  windowReady(): Promise<void>;
  openIssueReport(): Promise<void>;
  checkUpdates(automatic?: boolean): Promise<CheckUpdatesResult>;
  installUpdate(noticeId: string): Promise<void>;
  nativeGlass(dark: boolean, allow: boolean): Promise<NativeGlassResult>;
  listen<T>(
    name: string,
    handler: (event: { payload: T }) => void,
  ): Promise<() => void>;
  clipboard: PlatformClipboard;
  window: PlatformWindow;
  notifications: PlatformNotifications;
  push: PushClient;
}
