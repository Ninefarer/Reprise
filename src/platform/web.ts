import "../pwa-phone.css";
import { createPushStub, syncReminderTimes } from "./push";
import { registerServiceWorker } from "./registerServiceWorker";
import {
  WEB_STORAGE_KEY,
  browserIndexedDbStorage,
  type WebStorage,
} from "./storage";
import type { Platform } from "./types";
import { createWebSession } from "./webStore";

/**
 * Nightly web implementation. Tracks the current Nightly package version so
 * release notes and the nightly badge stay aligned with this source tree.
 * This file does not publish a release.
 */
export const WEB_RELEASE_VERSION = "3.4.4-nightly.20261116.1";
if (typeof document !== "undefined") {
  document.documentElement.dataset.platform = "web";
}
const issueUrl = "https://github.com/Ninefarer/Reprise/issues/new";

type Handler = (event: { payload: unknown }) => void;

export interface WebPlatformOptions {
  storage?: WebStorage;
  now?: () => number;
  version?: string;
  permission?: () => NotificationPermission | "unsupported";
}

export function createWebPlatform(options: WebPlatformOptions = {}): Platform {
  const listeners = new Map<string, Set<Handler>>();
  let storage = options.storage;
  const store = () => (storage ??= browserIndexedDbStorage());
  const permission =
    options.permission ??
    ((): NotificationPermission | "unsupported" => {
      if (typeof Notification === "undefined") return "unsupported";
      return Notification.permission;
    });
  const session = createWebSession({
    storage: {
      key: options.storage?.key ?? WEB_STORAGE_KEY,
      read: () => store().read(),
      write: (document) => store().write(document),
      requestPersistence: () => store().requestPersistence(),
      exportBackup: () => store().exportBackup(),
      importBackup: (json) => store().importBackup(json),
    },
    version: options.version ?? WEB_RELEASE_VERSION,
    now: options.now,
    permission,
    systemVisuals: browserVisuals,
  });
  let started = false;

  function emit(name: string, payload: unknown) {
    for (const handler of listeners.get(name) ?? []) handler({ payload });
  }

  async function refreshAfter<T>(work: Promise<T>): Promise<T> {
    const result = await work;
    emit("refresh", null);
    return result;
  }

  const platform: Platform = {
    kind: "web",
    start() {
      if (started || typeof window === "undefined") return;
      started = true;
      registerServiceWorker();
      const worker = navigator.serviceWorker;
      worker?.addEventListener("message", (event: MessageEvent) => {
        const data = event.data as
          | { type?: string; review?: boolean; taskId?: string | null }
          | undefined;
        if (data?.type !== "reprise-notification-click") return;
        emit("notification-route", {
          review: !!data.review,
          task_id: data.taskId ?? null,
        });
      });
      const pass = () => {
        void session
          .tick()
          .then(async (result) => {
            const shown: string[] = [];
            if (permission() === "granted") {
              for (const item of result.deliver) {
                try {
                  await platform.notifications.notify(item);
                  shown.push(item.tag);
                } catch {
                  /* Leave the in-app notice pending and try on a later pass. */
                }
              }
            }
            if (shown.length) await session.markDelivered(shown);
            await syncReminderTimes(result.reminders);
            if (result.changed || shown.length) emit("refresh", null);
          })
          .catch(() => {
            /* The open-page pass must not take down the UI. */
          });
      };
      window.setInterval(pass, 15000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") pass();
      });
      pass();
    },
    requestDurableStorage: () => store().requestPersistence(),
    snapshot: () => session.snapshot(),
    capture: (title) => refreshAfter(session.capture(title)),
    saveTask: (task, action) => refreshAfter(session.saveTask(task, action)),
    saveSettings: (settings) => refreshAfter(session.saveSettings(settings)),
    savePreferencePatch: (patch) =>
      refreshAfter(session.savePreferencePatch(patch)),
    visualPreferences: (patch) => refreshAfter(session.visualPreferences(patch)),
    taskHistory: (id) => session.taskHistory(id),
    readNotice: (id) => refreshAfter(session.readNotice(id)),
    manageNotifications: (action, ids) =>
      refreshAfter(session.manageNotifications(action, ids)),
    notificationPanelPreferences: (pinned) =>
      refreshAfter(session.notificationPanelPreferences(pinned)),
    sidebarPreferences: (input) => refreshAfter(session.sidebarPreferences(input)),
    acknowledgeRelease: (version) =>
      refreshAfter(session.acknowledgeRelease(version)),
    acknowledgeNightlyWelcome: (version) =>
      refreshAfter(session.acknowledgeNightlyWelcome(version)),
    deleteTask: (id, expectedUpdatedAt) =>
      refreshAfter(session.deleteTask(id, expectedUpdatedAt)),
    undoDeletion: (token) => refreshAfter(session.undoDeletion(token)),
    finalizeDeletion: (token) => session.finalizeDeletion(token),
    taskAction: (id, revision, action) =>
      refreshAfter(session.taskAction(id, revision, action)),
    undoTask: (id, revision) => refreshAfter(session.undoTask(id, revision)),
    quit: async () => {
      window.close();
    },
    saveAvatar: (pngBase64) => refreshAfter(session.saveAvatar(pngBase64)),
    diagnostics: () => session.diagnostics(),
    testNotification: async () => {
      const note = await session.prepareTestNotification();
      try {
        await platform.notifications.notify(note);
        await session.markDelivered([note.tag]);
      } catch (error) {
        await session.markFailed(note.tag, String(error));
        throw error;
      }
      emit("refresh", null);
    },
    windowReady: async () => {},
    openIssueReport: async () => {
      const opened = window.open(issueUrl, "_blank", "noopener");
      if (!opened) {
        throw new Error("Open the project issues page in your browser.");
      }
    },
    checkUpdates: async () => ({
      notice_id: null,
      message:
        "This Nightly web app updates when GitHub Pages publishes a new build. It does not install Windows packages.",
    }),
    installUpdate: async () => {
      throw new Error(
        "Web Nightly updates with the site. There is no Windows installer to run here.",
      );
    },
    nativeGlass: async () => ({ mode: "off", error: null }),
    listen: (name, handler) => {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      const wrapped = handler as Handler;
      set.add(wrapped);
      return Promise.resolve(() => {
        set?.delete(wrapped);
      });
    },
    clipboard: {
      async readText() {
        if (!navigator.clipboard?.readText) {
          throw new Error("Clipboard reading isn't available in this browser.");
        }
        return navigator.clipboard.readText();
      },
      async writeText(text) {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard writing isn't available in this browser.");
        }
        await navigator.clipboard.writeText(text);
      },
    },
    window: {
      hide: async () => {},
      setSize: async () => {},
      startDragging: async () => {},
      setTheme: async () => {},
      theme: async () =>
        matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      onThemeChanged: (handler) => {
        const media = matchMedia("(prefers-color-scheme: dark)");
        const listener = () =>
          handler({ payload: media.matches ? "dark" : "light" });
        media.addEventListener("change", listener);
        return Promise.resolve(() => media.removeEventListener("change", listener));
      },
      onResized: (handler) => {
        const listener = () => handler();
        window.addEventListener("resize", listener);
        return Promise.resolve(() => window.removeEventListener("resize", listener));
      },
    },
    notifications: {
      permission,
      requestPermission: async () => {
        if (typeof Notification === "undefined") return "unsupported";
        return Notification.requestPermission();
      },
      notify: async (input) => {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") {
          throw new Error("Notifications are not allowed.");
        }
        const shown = new Notification(input.title, {
          body: input.body,
          tag: input.tag,
        });
        shown.onclick = () => {
          window.focus();
          emit("notification-route", {
            review: input.review,
            task_id: input.taskId,
          });
        };
      },
    },
    push: createPushStub(),
  };
  return platform;
}

function browserVisuals() {
  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    auto_hide_scrollbars: null,
    advanced_effects: null,
    animations_enabled: reduceMotion ? false : null,
  };
}

export const platform = createWebPlatform();
