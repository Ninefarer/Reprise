import { TextContextMenus } from "./TextContextMenu";
import { trace, traceSnapshot, traceStart } from "./performance";
import { isNightly, NightlyDisclosure } from "./Nightly";
import { Onboarding, RedoOnboardingDialog } from "./Onboarding";
import { QuickCapture } from "./QuickCapture";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  date,
  isOpen,
  label,
  matches,
  remaining,
  reviewGroups,
  tasksForView,
  type History,
  type Settings,
  type Snapshot,
  type Status,
  type Task,
  type VisualPreferences,
  type View,
} from "./model";
import { Icon } from "./navigation";
import { TaskDialog, type TaskIntent } from "./TaskDialog";
import { Preferences, type SettingsEditor } from "./Preferences";
import { UnsavedSettingsDialog } from "./UnsavedSettingsDialog";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { Sidebar } from "./Sidebar";
import { NotificationSidebar } from "./NotificationSidebar";
import { TaskMenu } from "./TaskMenu";
import { CommandPalette } from "./CommandPalette";
import type { ActionId } from "./taskActions";
import { useTheme } from "./theme";
import { useScrollActivity } from "./scrollbars";
import { ReleaseDialog } from "./ReleaseNotes";
import { releaseFor, releases } from "./changelog";
import "./style.css";
import "./task-colors.css";
import "./visual-system.css";
import "./notification-sidebar.css";
import "./accents.css";
import "./motion.css";
import "./desktop-glass.css";
import "./density.css";
import "./context-menu.css";
import { taskCategory, reviewCategory } from "./taskColors";
import type { UpdateActivity } from "./updates";
const captureWindowMode = new URLSearchParams(location.search).has("capture");
function Application({
  captureMode = captureWindowMode,
}: { captureMode?: boolean } = {}) {
  const quick = captureMode;
  const snapshotStarted = useRef<number | null>(null);
  const searchStarted = useRef<number | null>(null);
  const firstRender = useRef(traceStart());
  const [data, setData] = useState<Snapshot | null>(null),
    [view, setView] = useState<View>("Home"),
    [query, setQuery] = useState(""),
    [title, setTitle] = useState(""),
    [captureError, setCaptureError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [palette, setPalette] = useState(false),
    [releaseDialog, setReleaseDialog] = useState<"new" | "history" | null>(
      null,
    ),
    [context, setContext] = useState<{
      task: Task;
      x: number;
      y: number;
    } | null>(null),
    [undo, setUndo] = useState<{
      id: string;
      revision: number;
      title: string;
    } | null>(null),
    [deleting, setDeleting] = useState<Task | null>(null),
    [editor, setEditor] = useState<{ task: Task; intent: TaskIntent } | null>(
      null,
    ),
    [now, setNow] = useState(Math.floor(Date.now() / 1000)),
    [notificationsOpen, setNotificationsOpen] = useState(false);
  const [replayingSetup, setReplayingSetup] = useState(false);
  const [confirmSetup, setConfirmSetup] = useState(false);
  const settingsEditor = useRef<SettingsEditor | null>(null);
  const registerSettingsEditor = useCallback(
    (editor: SettingsEditor | null) => {
      settingsEditor.current = editor;
    },
    [],
  );
  const [settingsLeave, setSettingsLeave] = useState<(() => void) | null>(null);
  const setupActive = !data?.settings.onboarded || replayingSetup;
  const setupCaptured = useRef(false);
  const [nightlySeen, setNightlySeen] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState("");
  const [nativeTaskId, setNativeTaskId] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false),
    [updateActivity, setUpdateActivity] = useState<UpdateActivity | null>(null);
  const updateOperation = useRef(false);
  const [completionFeedback, setCompletionFeedback] = useState<
      { task: Task; view: View; until: number }[]
    >([]),
    [returnHighlights, setReturnHighlights] = useState<Record<string, number>>(
      {},
    );
  const reviewSeen = useRef<Map<string, number | null>>(new Map()),
    fetchedOnce = useRef(false);
  useEffect(() => {
    if (!completionFeedback.length) return;
    const timer = setTimeout(
      () =>
        setCompletionFeedback((entries) =>
          entries.filter((entry) => entry.until > Date.now()),
        ),
      Math.max(
        0,
        Math.min(...completionFeedback.map((entry) => entry.until)) -
          Date.now(),
      ),
    );
    return () => clearTimeout(timer);
  }, [completionFeedback]);
  useEffect(() => {
    const expiry = Object.values(returnHighlights);
    if (!expiry.length) return;
    const timer = setTimeout(
      () =>
        setReturnHighlights((entries) =>
          Object.fromEntries(
            Object.entries(entries).filter(([, until]) => until > Date.now()),
          ),
        ),
      Math.max(0, Math.min(...expiry) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [returnHighlights]);
  const captureSaving = useRef(false);
  const captureRef = useRef<HTMLInputElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    loading = useRef(false),
    reloadRequested = useRef<string | null>(null),
    legacy = useRef(new Map<string, number>());
  const suspended = useRef(false),
    mounted = useRef(true);
  const themeReady = useTheme(data?.settings, data?.system_visuals);
  useScrollActivity();
  const windowShown = useRef(false),
    lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!windowShown.current && ((data && themeReady) || error)) {
      windowShown.current = true;
      void invoke("window_ready").catch(() => {
        windowShown.current = false;
      });
    }
  }, [data, themeReady, error]);
  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("keydown", mark);
    window.addEventListener("pointerdown", mark);
    return () => {
      window.removeEventListener("keydown", mark);
      window.removeEventListener("pointerdown", mark);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.modalDepth = String(
      Number(!!editor) +
        Number(!!deleting) +
        Number(palette) +
        Number(!!releaseDialog) +
        Number(confirmSetup),
    );
  }, [editor, deleting, palette, releaseDialog, confirmSetup]);
  useEffect(() => {
    if (
      quick ||
      isNightly(data?.release?.version) ||
      setupActive ||
      !data.release?.should_show ||
      !releaseFor(data.release.version) ||
      view !== "Home" ||
      title ||
      query ||
      editor ||
      deleting ||
      palette ||
      context ||
      undo ||
      busy ||
      error ||
      releaseDialog ||
      notificationsOpen
    )
      return;
    const timer = setInterval(() => {
      const active = document.activeElement;
      if (
        Date.now() - lastActivity.current < 1500 ||
        !document.hasFocus() ||
        document.visibilityState !== "visible" ||
        document.querySelector(
          "dialog[open], .profile-footer[open], .context-menu",
        ) ||
        active?.matches("input,textarea,select,[contenteditable=true]")
      )
        return;
      setReleaseDialog("new");
    }, 750);
    return () => clearInterval(timer);
  }, [
    data?.release?.should_show,
    data?.release?.version,
    setupActive,
    view,
    title,
    query,
    editor,
    deleting,
    palette,
    context,
    undo,
    busy,
    error,
    releaseDialog,
    notificationsOpen,
  ]);
  useEffect(() => {
    if (
      quick ||
      nightlySeen ||
      setupActive ||
      !data ||
      !themeReady ||
      !isNightly(data.release?.version) ||
      editor ||
      deleting ||
      palette ||
      releaseDialog ||
      busy ||
      error
    )
      return;
    setNightlySeen(true);
    setReleaseDialog("new");
  }, [
    quick,
    nightlySeen,
    setupActive,
    data,
    themeReady,
    editor,
    deleting,
    palette,
    releaseDialog,
    busy,
    error,
  ]);
  const load = useCallback(async (reason = "explicit"): Promise<void> => {
    if (!mounted.current) return;
    if (loading.current) {
      // Retain request priority: a queued worker refresh must not bypass the visibility gate.
      if (
        !reloadRequested.current ||
        !["timer", "event", "focus", "resume"].includes(reason)
      )
        reloadRequested.current = reason;
      return;
    }
    loading.current = true;
    const started = traceStart();
    try {
      const background = ["timer", "event", "focus", "resume"].includes(reason);
      const args = {
        ...(background ? { background: true } : {}),
        ...(started === null
          ? {}
          : { measure: true, probe: `${reason}:${document.visibilityState}` }),
      };
      const next = await (Object.keys(args).length
        ? invoke<Snapshot | null>("snapshot", args)
        : invoke<Snapshot | null>("snapshot"));
      if (!mounted.current) return;
      if (!next) {
        suspended.current = true;
        return;
      }
      suspended.current = false;
      traceSnapshot(`snapshot.${reason}`, started, next);
      await Promise.all(
        next.tasks
          .filter((t) => t.status === "Settled" && !t.settled_at)
          .map(async (t) => {
            if (!legacy.current.has(t.id)) {
              const h = await invoke<History[]>("task_history", { id: t.id });
              const entry = h.find((e) => e.action === "Settled");
              if (entry) legacy.current.set(t.id, entry.at);
            }
            t.settled_at = legacy.current.get(t.id) ?? null;
          }),
      );
      if (!mounted.current) return;
      const fresh = next.tasks.filter(
        (t) =>
          fetchedOnce.current &&
          t.review_at !== null &&
          reviewSeen.current.get(t.id) !== t.review_at,
      );
      reviewSeen.current = new Map(next.tasks.map((t) => [t.id, t.review_at]));
      fetchedOnce.current = true;
      if (
        fresh.length &&
        document.visibilityState !== "hidden" &&
        document.documentElement.dataset.motion !== "off" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const until = Date.now() + 900;
        setReturnHighlights((previous) => ({
          ...previous,
          ...Object.fromEntries(fresh.map((t) => [t.id, until])),
        }));
      }
      snapshotStarted.current = started;
      setNow(Math.floor(Date.now() / 1000));
      setData(next);
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      loading.current = false;
      if (reloadRequested.current && mounted.current) {
        const reason = reloadRequested.current;
        reloadRequested.current = null;
        queueMicrotask(() => {
          if (mounted.current) void load(reason);
        });
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load("initial");
    const timer = setInterval(() => {
      if (!dead) void load("timer");
    }, 15000);
    let off: (() => void) | undefined, offResize: (() => void) | undefined;
    let dead = false;
    void listen("refresh", () => {
      if (!dead) void load("event");
    })
      .then((f) => {
        if (dead) f();
        else off = f;
      })
      .catch((error) => {
        if (!dead) setError(String(error));
      });
    const focus = () => {
      void load("focus").then(() => {
        if (!dead && quick) captureRef.current?.focus();
      });
    };
    void getCurrentWindow()
      .onResized(() => {
        if (!dead && suspended.current) void load("resume");
      })
      .then((f) => {
        if (dead) f();
        else offResize = f;
      })
      .catch((error) => {
        if (!dead) setError(String(error));
      });
    window.addEventListener("focus", focus);
    return () => {
      dead = true;
      mounted.current = false;
      off?.();
      offResize?.();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(() => {
    if (quick || setupActive) return;
    let disposed = false;
    const check = async () => {
      if (updateOperation.current) return;
      updateOperation.current = true;
      try {
        const result = await invoke<{
          notice_id: string | null;
          message?: string;
        }>("check_updates", { automatic: true });
        if (!disposed) {
          if (result?.message) setUpdateCheckMessage(result.message);
          if (result?.notice_id) await load("event");
        }
      } catch (error) {
        if (!disposed)
          setUpdateCheckMessage(
            `Automatic update check couldn't finish: ${String(error)}`,
          );
      } finally {
        updateOperation.current = false;
      }
    };
    const first = setTimeout(() => void check(), 30000);
    const interval = setInterval(() => void check(), 6 * 3600000);
    return () => {
      disposed = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [quick, setupActive, load]);
  useLayoutEffect(() => {
    if (!data) return;
    trace("snapshot.commit", snapshotStarted.current);
    snapshotStarted.current = null;
    if (firstRender.current !== null) {
      trace("startup.webview-first-data-commit", firstRender.current);
      firstRender.current = null;
    }
  }, [data]);
  useLayoutEffect(() => {
    trace("search.commit", searchStarted.current);
    searchStarted.current = null;
  }, [query]);

  useEffect(() => {
    if (quick) return;
    let off: (() => void) | undefined,
      disposed = false;
    void listen<UpdateActivity>("update-progress", (event) =>
      setUpdateActivity(event.payload),
    )
      .then((unlisten) => {
        if (disposed) unlisten();
        else off = unlisten;
      })
      .catch((error) => {
        if (!disposed) setError(String(error));
      });
    return () => {
      disposed = true;
      off?.();
    };
  }, []);
  useEffect(() => {
    if (quick) return;
    let disposed = false,
      off: (() => void) | undefined;
    void listen<{ review: boolean; task_id: string | null }>(
      "notification-route",
      (event) => {
        if (event.payload.review) {
          setNativeTaskId(null);
          setView("Daily Review");
          setQuery("");
        } else if (event.payload.task_id)
          setNativeTaskId(event.payload.task_id);
        else {
          setNativeTaskId(null);
          setNotificationsOpen(true);
        }
      },
    )
      .then((unlisten) => {
        if (disposed) unlisten();
        else off = unlisten;
      })
      .catch((error) => setError(String(error)));
    return () => {
      disposed = true;
      off?.();
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const content = document.querySelector<HTMLElement>("main.content");
    if (content) content.scrollTop = 0;
  }, [view]);
  useEffect(() => {
    // Fetch on dequeue, after existing edits finish; never retain a stale Task copy.
    if (
      setupActive ||
      !nativeTaskId ||
      editor ||
      deleting ||
      palette ||
      releaseDialog ||
      busy
    )
      return;
    let cancelled = false;
    void invoke<Snapshot>("snapshot")
      .then((snapshot) => {
        if (cancelled) return;
        setNativeTaskId(null);
        const task = snapshot.tasks.find((task) => task.id === nativeTaskId);
        if (task) {
          setNotificationsOpen(false);
          open(task);
        } else setNotificationsOpen(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setNativeTaskId(null);
          setError(String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    setupActive,
    nativeTaskId,
    editor,
    deleting,
    palette,
    releaseDialog,
    busy,
  ]);
  async function checkUpdates() {
    if (setupActive || updateOperation.current) return;
    updateOperation.current = true;
    setCheckingUpdates(true);
    setUpdateActivity(null);
    try {
      const result = await invoke<{
        notice_id: string | null;
        message?: string;
      }>("check_updates");
      setUpdateCheckMessage(result?.message ?? "");
      await load();
      if (result?.notice_id) setNotificationsOpen(true);
    } catch (error) {
      setError(String(error));
    } finally {
      updateOperation.current = false;
      setCheckingUpdates(false);
    }
  }
  async function installUpdate(noticeId: string) {
    if (updateOperation.current || editor || deleting || palette) return;
    updateOperation.current = true;
    setUpdateActivity({
      notice_id: noticeId,
      stage: "checking",
      downloaded: 0,
      total: null,
    });
    try {
      await invoke("install_update", { noticeId });
    } catch (error) {
      setUpdateActivity({
        notice_id: noticeId,
        stage: "error",
        downloaded: 0,
        total: null,
        message: String(error),
      });
    } finally {
      updateOperation.current = false;
      await load();
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const shortcut = data?.settings.command_shortcut ?? "Ctrl+K";
      if (
        !quick &&
        !setupActive &&
        (e.ctrlKey || e.metaKey) &&
        (shortcut === "Ctrl+K"
          ? e.key.toLowerCase() === "k" && !e.shiftKey
          : e.key.toLowerCase() === "p" && e.shiftKey)
      ) {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (quick && e.key === "Escape" && !captureSaving.current)
        void getCurrentWindow()
          .hide()
          .catch((error) => setError(String(error)));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [data?.settings.command_shortcut, setupActive]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 30000);
    return () => clearTimeout(timer);
  }, [undo]);
  async function run(f: () => Promise<unknown>) {
    setBusy(true);
    try {
      await f();
      setError("");
      await load();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(t: Task, action: string) {
    return run(async () => {
      const saved = await invoke<Task>("save_task", { task: t, action });
      const previous = data?.tasks.find((task) => task.id === t.id);
      if (
        saved?.status === "Finished" &&
        previous &&
        previous.status !== "Finished" &&
        tasksForView([previous], view, now).length &&
        matches(previous, query) &&
        document.visibilityState !== "hidden" &&
        document.documentElement.dataset.motion !== "off" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setCompletionFeedback((entries) => [
          ...entries.filter((entry) => entry.task.id !== t.id),
          {
            task: previous,
            view,
            until:
              Date.now() +
              (document.documentElement.dataset.motion === "expressive"
                ? 240
                : 220),
          },
        ]);
      }
      if (action !== "Edited" && saved?.id)
        setUndo({
          id: saved.id,
          revision: saved.updated_at,
          title: saved.title,
        });
    });
  }
  async function transition(t: Task, status: Status) {
    return save({ ...t, status }, status);
  }
  function open(t: Task, intent: TaskIntent = "edit") {
    document
      .querySelectorAll<HTMLDetailsElement>(".action-menu[open]")
      .forEach((menu) => {
        menu.open = false;
      });
    setError("");
    setEditor({
      task: t,
      intent: !isOpen(t) && intent === "edit" ? "history" : intent,
    });
  }
  async function add() {
    if (!title.trim() || busy || captureSaving.current) return;
    captureSaving.current = true;
    const started = traceStart();
    try {
      const ok = await run(async () => {
        const saving = traceStart();
        await invoke("capture", { title: title.trim() });
        trace("capture.persist", saving);
      });
      if (ok) {
        setTitle("");
        if (quick) await getCurrentWindow().hide();
        trace("capture.submit-to-complete", started);
      }
    } catch (error) {
      setError(String(error));
    } finally {
      captureSaving.current = false;
    }
  }
  async function preferences(s: Settings) {
    return run(() =>
      invoke("save_settings", {
        settings: { ...s, theme: data!.settings.theme },
      }),
    );
  }
  async function visual(patch: Partial<VisualPreferences>) {
    await run(() => invoke("visual_preferences", { patch }));
  }
  function afterSettings(action: () => void) {
    if (
      view === "Settings" &&
      (settingsEditor.current?.dirty || settingsEditor.current?.busy)
    )
      setSettingsLeave(() => action);
    else action();
  }
  function navigate(v: View, anchor?: string) {
    if (v === "Notification History") {
      setNotificationsOpen(true);
      requestAnimationFrame(() =>
        document.getElementById("notification-panel")?.focus(),
      );
      return;
    }
    const go = () => {
      setView(v);
      setQuery("");
      if (anchor)
        requestAnimationFrame(() =>
          document
            .getElementById(anchor)
            ?.scrollIntoView?.({ block: "center" }),
        );
    };
    if (v === "Settings") go();
    else afterSettings(go);
  }
  async function special(t: Task, action: string) {
    return run(async () => {
      const saved = await invoke<Task>("task_action", {
        id: t.id,
        revision: t.updated_at,
        action,
      });
      if (saved?.id)
        setUndo({
          id: saved.id,
          revision: saved.updated_at,
          title: saved.title,
        });
    });
  }
  function act(t: Task, id: ActionId) {
    if (id === "delete") {
      requestDelete(t);
      return;
    }
    if (id === "resume" || id === "surface") {
      void special(t, id === "resume" ? "Resume" : "Surface");
      return;
    }
    if (id === "review") {
      navigate("Resurfaced");
      open(t);
      return;
    }
    if (
      id === "edit" ||
      id === "history" ||
      id === "schedule" ||
      id === "snooze" ||
      id === "return" ||
      id === "followup"
    ) {
      open(
        t,
        id === "schedule"
          ? "schedule"
          : id === "snooze"
            ? "snooze"
            : id === "history"
              ? "history"
              : id === "return"
                ? "return"
                : id === "followup"
                  ? "followup"
                  : "edit",
      );
      return;
    }
    void transition(
      t,
      (
        {
          start: "DoNow",
          inbox: "Inbox",
          finish: "Finished",
          drop: "Dropped",
          settle: "Settled",
        } as const
      )[id],
    );
  }
  function requestDelete(task: Task) {
    document
      .querySelectorAll<HTMLDetailsElement>(".action-menu[open]")
      .forEach((menu) => {
        menu.open = false;
      });
    setError("");
    setDeleting(task);
  }
  const capture = (
    <>
    <form
      className="capture"
      noValidate
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) { setCaptureError("Enter a task title."); captureRef.current?.focus(); return; }
        setCaptureError("");
        void add();
      }}
    >
      <span aria-hidden="true">＋</span>
      <input
        ref={captureRef}
        autoFocus={quick}
        disabled={busy}
        required
        maxLength={500}
        aria-invalid={!!captureError}
        aria-describedby={captureError ? "capture-error" : undefined}
        aria-label="Capture a task"
        placeholder="What would you like to come back to?"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setCaptureError(""); }}
      />
      <button disabled={busy} className="primary">
        {busy ? "Saving..." : quick ? "Save" : "Add to Inbox"}{" "}
        <span aria-hidden="true">↵</span>
      </button>
    </form>
    {captureError && <p id="capture-error" className="capture-validation" role="alert">{captureError}</p>}
    </>
  );
  if (quick)
    return (
      <QuickCapture error={error} busy={busy} onError={setError}>
        {capture}
      </QuickCapture>
    );
  if (!data)
    return (
      <main className="loading">
        <h1>Reprise</h1>
        <p role="status">{error || "Opening Reprise…"}</p>
        <button onClick={() => void load()}>Try again</button>
      </main>
    );
  const { tasks, settings, notifications } = data;
  const presenting = tasks.map(
    (task) =>
      completionFeedback.find(
        (entry) => entry.view === view && entry.task.id === task.id,
      )?.task ?? task,
  );
  const visible = tasksForView(presenting, view, now).filter((t) =>
    matches(t, query),
  );
  const groups = reviewGroups(
    presenting.filter((t) => matches(t, query)),
    now,
  );
  const count = (v: View) =>
    v === "Home" || v === "Settings"
      ? null
      : v === "Notification History"
        ? notifications.filter((n) => !n.read).length
        : tasksForView(tasks, v, now).length;
  function taskCard(t: Task) {
    if (
      completionFeedback.some(
        (entry) => entry.view === view && entry.task.id === t.id,
      )
    )
      return (
        <article
          key={t.id}
          className="task-card completion-feedback"
          role="status"
          aria-label={`Finished ${t.title}`}
        >
          <span className="completion-check" aria-hidden="true">
            ✓
          </span>
          <span>{t.title}</span>
          <span className="status">Finished</span>
        </article>
      );
    const paused =
      (t.status === "Settled" || t.status === "Snoozed") &&
      t.review_at === null;
    return (
      <article
        className={`task-card${returnHighlights[t.id] && t.review_at !== null ? " newly-resurfaced" : ""}`}
        data-status={t.status}
        key={t.id}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            setContext({ task: t, x: r.left + 40, y: r.top + 30 });
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setContext({ task: t, x: e.clientX, y: e.clientY });
        }}
      >
        {isOpen(t) ? (
          <button
            disabled={busy}
            className="finish"
            aria-label={
              t.status === "Finished"
                ? `Reopen ${t.title}`
                : `Finish ${t.title}`
            }
            onClick={() =>
              void transition(t, t.status === "Finished" ? "Inbox" : "Finished")
            }
          >
            ○
          </button>
        ) : (
          <span className="finish" aria-label={`${label(t.status)} task`}>
            {t.status === "Finished" ? "✓" : "×"}
          </span>
        )}
        <div className="task-body">
          <div className="task-top">
            <button className="task-title" onClick={() => open(t)}>
              {t.title}
            </button>
            <span className="status" data-status={t.status}>
              {label(t.status)}
            </span>
          </div>
          {t.description && <p className="task-excerpt">{t.description}</p>}
          <div className="task-meta">
            {t.project && <span>{t.project}</span>}
            {t.review_at !== null && (
              <span className="queue-indicator" data-status="Resurfaced">
                Resurfaced · {t.review_reason} · {date(t.review_at)}
              </span>
            )}
            {t.scheduled_at !== null && (
              <span>Planned {date(t.scheduled_at)}</span>
            )}
            {t.due_at !== null && (
              <span className={t.due_at < now && isOpen(t) ? "attention" : ""}>
                Due {date(t.due_at)}
              </span>
            )}
          </div>
          {paused && (
            <div className="pause-info">
              {t.status === "Settled" && (
                <>
                  <span>
                    <b>Settled</b>
                    {date(t.settled_at)}
                  </span>
                  <span>
                    <b>Mode</b>
                    {t.settlement_mode === "24h"
                      ? "24 hours"
                      : t.settlement_mode === "next_day"
                        ? "Next calendar day"
                        : "Not recorded for this older task"}
                  </span>
                </>
              )}
              <span>
                <b>
                  {t.status === "Settled" ? "Resurfaces" : "Snooze expires"}
                </b>
                {date(t.wake_at)}
              </span>
              <span className="remaining">{remaining(t.wake_at, now)}</span>
            </div>
          )}
        </div>
        <div className="task-actions">
          <button
            disabled={busy}
            onClick={() =>
              act(
                t,
                t.status === "Finished" || t.status === "Dropped"
                  ? "inbox"
                  : t.review_at !== null
                    ? "review"
                    : t.status === "Settled" || t.status === "Waiting"
                      ? "resume"
                      : t.status === "Snoozed"
                        ? "surface"
                        : t.status === "DoNow"
                          ? "settle"
                          : "start",
              )
            }
          >
            {t.status === "Finished"
              ? "Reopen"
              : t.status === "Dropped"
                ? "Restore"
                : t.review_at !== null
                  ? "Review"
                  : t.status === "Settled" || t.status === "Waiting"
                    ? "Resume"
                    : t.status === "Snoozed"
                      ? "Wake Now"
                      : t.status === "DoNow"
                        ? "Settle"
                        : "Start Now"}
          </button>
          <button
            aria-label={`More actions for ${t.title}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setContext({ task: t, x: rect.right, y: rect.bottom });
            }}
          >
            •••
          </button>
        </div>
      </article>
    );
  }
  function empty(text = "Nothing here needs your attention right now.") {
    return (
      <div className="empty" data-status={taskCategory(view)}>
        <Icon name={view} />
        <h3>{query ? "No matching tasks." : "No tasks here yet."}</h3>
        <p>{query ? "Try another title, note, project, or tag." : text}</p>
      </div>
    );
  }
  if (setupActive)
    return (
      <Onboarding
        settings={settings}
        avatar={data.avatar}
        nightlyVersion={
          isNightly(data.release?.version) ? data.release!.version : undefined
        }
        replay={replayingSetup}
        busy={busy}
        error={error}
        onRefresh={load}
        onVisual={visual}
        onCancel={() => {
          setReplayingSetup(false);
          setError("");
        }}
        onFinish={async (patch, firstTitle) => {
          const ok = await run(async () => {
            if (firstTitle && !setupCaptured.current) {
              await invoke("capture", { title: firstTitle });
              setupCaptured.current = true;
            }
            await invoke("save_settings", {
              settings: { ...settings, ...patch, onboarded: true },
            });
          });
          if (ok) {
            setView("Home");
            setQuery("");
            setReplayingSetup(false);
          }
        }}
      />
    );
  const pageTitle =
    view === "Home"
      ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}${settings.name ? ", " + settings.name : ""}.`
      : label(view);
  return (
    <div className="app" data-density={settings.density}>
      <Sidebar
        version={data.release?.version}
        settings={settings}
        avatar={data.avatar}
        view={view}
        count={count}
        onNavigate={navigate}
        onQuit={() =>
          afterSettings(() => {
            void run(() => invoke("quit_app"));
          })
        }
        onPatch={async (p) => {
          await run(() =>
            invoke("sidebar_preferences", {
              width: p.sidebar_width ?? null,
              collapsed: p.sidebar_collapsed ?? null,
              groups: p.sidebar_groups ?? null,
            }),
          );
        }}
      />
      <main className="content" tabIndex={-1}>
        {view !== "Settings" && view !== "Notification History" && (
          <header className="topbar">
            <div className="search">
              <input
                ref={searchRef}
                aria-label="Search tasks"
                placeholder="Search tasks…"
                value={query}
                onChange={(e) => {
                  searchStarted.current = traceStart();
                  setQuery(e.target.value);
                }}
              />
              {query && (
                <button
                  className="clear-search"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  ×
                </button>
              )}
            </div>
          </header>
        )}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        <>
          <div className="page-heading">
            <h1>{pageTitle}{!["Home", "Settings", "Daily Review"].includes(view) && <span aria-hidden="true" className="count-badge">{visible.length}</span>}</h1>
          </div>
          {view === "Settings" ? (
            <Preferences
              settings={settings}
              avatar={data.avatar}
              onRefresh={load}
              onRedoOnboarding={() =>
                afterSettings(() => setConfirmSetup(true))
              }
              onEditor={registerSettingsEditor}
              onSave={preferences}
              onVisual={visual}
              system={data.system_visuals}
              version={data.release?.version ?? releases[0].version}
              onReleaseNotes={setReleaseDialog}
              updateCheckMessage={updateCheckMessage}
              onCheckUpdates={checkUpdates}
              checkingUpdates={
                checkingUpdates ||
                (!!updateActivity && updateActivity.stage !== "error")
              }
            />
          ) : (
            <>
              {(view === "Home" || view === "Inbox") && capture}
              {view === "Home" && (
                <div className="overview">
                  {(
                    ["DoNow", "Resurfaced", "Inbox", "Scheduled"] as View[]
                  ).map((v) => (
                    <button
                      key={v}
                      data-status={taskCategory(v)}
                      onClick={() => setView(v)}
                    >
                      <Icon name={v} />
                      <span>{label(v)}</span>
                      <strong>{count(v)}</strong>
                    </button>
                  ))}
                </div>
              )}
              {view === "Daily Review" ? (
                <div className="review-groups">
                  {groups.map((g) => (
                    <section className="review-section" key={g.title}>
                      <div
                        className="section-heading"
                        data-status={reviewCategory(g.title)}
                      >
                        <div>
                          <h2>
                            {g.title}
                            <span className="count-badge">
                              {g.tasks.length}
                            </span>
                          </h2>
                        </div>
                      </div>
                      {g.tasks.length ? (
                        g.tasks.map(taskCard)
                      ) : (
                        <p className="group-empty">
                          {query
                            ? "No matches in this section."
                            : "All clear here."}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <>
                  <div
                    className="section-heading"
                    hidden={view !== "Home"}
                    data-status={taskCategory(view)}
                  >
                    <h2>
                      {view === "Home" ? "In focus" : null}
                      <span className="count-badge">
                        {
                          tasksForView(tasks, view, now).filter((t) =>
                            matches(t, query),
                          ).length
                        }
                      </span>
                    </h2>
                  </div>
                  {visible.length
                    ? visible
                        .sort((a, b) =>
                          view === "Settled" || view === "Snoozed"
                            ? (a.wake_at ?? Infinity) - (b.wake_at ?? Infinity)
                            : 0,
                        )
                        .map(taskCard)
                    : empty(
                        view === "Settled"
                          ? "Settled tasks wait here until their return time."
                          : view === "Snoozed"
                            ? "Choose Snooze from a task’s actions menu to set a return time."
                            : undefined,
                      )}
                </>
              )}
            </>
          )}
        </>
      </main>
      {settingsLeave && (
        <UnsavedSettingsDialog
          onStay={() => setSettingsLeave(null)}
          onDiscard={() => {
            settingsEditor.current?.discard();
            const go = settingsLeave;
            setSettingsLeave(null);
            go();
          }}
          onSave={async () => {
            if (!(await settingsEditor.current?.save())) return false;
            const go = settingsLeave;
            setSettingsLeave(null);
            go();
            return true;
          }}
        />
      )}
      {confirmSetup && (
        <RedoOnboardingDialog
          onCancel={() => setConfirmSetup(false)}
          onConfirm={() => {
            setConfirmSetup(false);
            setupCaptured.current = false;
            setReleaseDialog(null);
            setPalette(false);
            setContext(null);
            setNotificationsOpen(false);
            setError("");
            setReplayingSetup(true);
          }}
        />
      )}
      {releaseDialog === "new" && isNightly(data.release?.version) ? (
        <NightlyDisclosure
          version={data.release!.version}
          onClose={() => setReleaseDialog(null)}
        />
      ) : (
        releaseDialog && (
          <ReleaseDialog
            current={data.release?.version ?? releases[0].version}
            mode={releaseDialog}
            pending={data.release?.should_show ?? false}
            onClose={() => setReleaseDialog(null)}
            onAcknowledge={() =>
              run(() =>
                invoke("acknowledge_release", {
                  version: data.release!.version,
                }),
              )
            }
          />
        )
      )}
      {settings.onboarded && (
        <NotificationSidebar
          open={notificationsOpen}
          pinned={!!settings.notification_panel_pinned}
          notices={notifications}
          tasks={tasks}
          busy={busy}
          onOpenChange={setNotificationsOpen}
          onPin={(pinned) =>
            run(() => invoke("notification_panel_preferences", { pinned }))
          }
          onRead={(id) => void run(() => invoke("read_notice", { id }))}
          onTask={(task) => open(task)}
          onReview={() => {
            setNotificationsOpen(false);
            navigate("Daily Review");
          }}
          onManage={(action, ids) =>
            run(() => invoke("manage_notifications", { action, ids }))
          }
          onUpdate={async (id) => afterSettings(() => void installUpdate(id))}
          updateActivity={updateActivity}
        />
      )}
      {editor && (
        <TaskDialog
          externalError={error}
          key={editor.task.id}
          task={editor.task}
          intent={editor.intent}
          onClose={() => setEditor(null)}
          onTransition={transition}
          onDelete={() => requestDelete(editor.task)}
          onSave={(t) =>
            save(
              t,
              t.status === editor.task.status
                ? t.status === "Snoozed" && t.wake_at !== editor.task.wake_at
                  ? "Snoozed"
                  : "Edited"
                : t.status,
            )
          }
        />
      )}
      {context && data.tasks.some((t) => t.id === context.task.id) && (
        <TaskMenu
          request={context}
          task={data.tasks.find((t) => t.id === context.task.id)!}
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          onAction={(id) =>
            act(
              data.tasks.find((t) => t.id === context.task.id)!,
              id,
            )
          }
        />
      )}
      {palette && (
        <CommandPalette
          tasks={tasks}
          shortcut={settings.command_shortcut ?? "Ctrl+K"}
          onClose={() => setPalette(false)}
          onNavigate={navigate}
          onTask={(t) => open(t)}
          onAction={act}
          onCreate={async (title) => {
            await run(() => invoke("capture", { title }));
          }}
        />
      )}
      {undo && (
        <div
          className="undo-toast"
          role="status"
          key={`${undo.id}/${undo.revision}`}
        >
          <span>Updated “{undo.title}”</span>
          <button
            onClick={() =>
              void run(async () => {
                await invoke("undo_task", {
                  id: undo.id,
                  revision: undo.revision,
                });
                setUndo(null);
                setCompletionFeedback([]);
              })
            }
          >
            Undo
          </button>
          <button aria-label="Dismiss undo" onClick={() => setUndo(null)}>
            ×
          </button>
          <small>
            Notifications already submitted to Windows are not recalled.
          </small>
        </div>
      )}
      {deleting && (
        <DeleteTaskDialog
          task={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const ok = await run(() =>
              invoke("delete_task", {
                id: deleting.id,
                expectedUpdatedAt: deleting.updated_at,
              }),
            );
            if (ok) {
              setDeleting(null);
              setEditor(null);
            }
            return ok;
          }}
          error={error}
        />
      )}
    </div>
  );
}

export function App(props: { captureMode?: boolean } = {}) {
  return (
    <>
      <Application {...props} />
      <TextContextMenus />
    </>
  );
}
