import { Select } from "./Select";
import {
  categoryLabel,
  filterNotices,
  type NoticeAction,
} from "./notifications";
import { NotificationClearDialog } from "./NotificationClearDialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { date, type Notice, type Task } from "./model";
import { Icon } from "./navigation";
import { taskCategory } from "./taskColors";
import { offeredVersion, updateMessage, type UpdateActivity } from "./updates";

export function NotificationSidebar({
  open,
  pinned,
  notices,
  tasks,
  busy,
  onOpenChange,
  onPin,
  onRead,
  onTask,
  onReview,
  onManage,
  onUpdate,
  updateActivity,
}: {
  open: boolean;
  pinned: boolean;
  notices: Notice[];
  tasks: Task[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPin: (pinned: boolean) => Promise<boolean>;
  onRead: (id: string) => void;
  onTask: (task: Task) => void;
  onReview: () => void;
  onManage: (action: NoticeAction, ids: string[]) => Promise<boolean>;
  onUpdate: (noticeId: string) => Promise<void>;
  updateActivity: UpdateActivity | null;
}) {
  const shown = open || pinned;
  const [confirmation, setConfirmation] = useState<{
    action: NoticeAction;
    ids: string[];
  } | null>(null);
  const [managementError, setManagementError] = useState("");
  async function manage(action: NoticeAction, ids: string[]) {
    setManagementError("");
    if (await onManage(action, ids)) setConfirmation(null);
    else
      setManagementError("Could not update notifications. Please try again.");
  }
  const [present, setPresent] = useState(shown),
    [exiting, setExiting] = useState(false);
  const [category, setCategory] = useState("All"),
    [unread, setUnread] = useState(false),
    [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    opener = useRef<HTMLElement | null>(null),
    keyboard = useRef(false),
    atEdge = useRef(false);
  useLayoutEffect(() => {
    if (shown) {
      setPresent(true);
      setExiting(false);
      return;
    }
    if (!present) return;
    const root = document.documentElement;
    if (
      root.dataset.motion === "off" ||
      root.dataset.windowActive === "false" ||
      document.visibilityState === "hidden" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setPresent(false);
      setExiting(false);
      return;
    }
    setExiting(true);
    const duration = getComputedStyle(root)
      .getPropertyValue("--motion-modal")
      .trim();
    const milliseconds = duration.endsWith("ms")
      ? parseFloat(duration)
      : parseFloat(duration) * 1000;
    const timeout = setTimeout(
      () => {
        setPresent(false);
        setExiting(false);
      },
      Number.isFinite(milliseconds) ? milliseconds : 180,
    );
    return () => clearTimeout(timeout);
  }, [shown]);
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const blocked = () => !!document.querySelector("dialog[open], .menu-shield");
  function restoreFocus() {
    const target =
      opener.current?.isConnected &&
      opener.current !== document.body &&
      !panel.current?.contains(opener.current)
        ? opener.current
        : document.querySelector<HTMLElement>("main.content");
    target?.focus();
  }
  function reveal(focus = false) {
    cancel();
    if (blocked()) return;
    opener.current = document.activeElement as HTMLElement;
    onOpenChange(true);
    if (focus)
      requestAnimationFrame(() =>
        panel.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      );
  }
  function close() {
    cancel();
    if (pinned || blocked()) return;
    if (panel.current?.contains(document.activeElement)) restoreFocus();
    onOpenChange(false);
  }
  function tuck() {
    cancel();
    if (!pinned)
      timer.current = setTimeout(() => {
        if (
          !keyboard.current ||
          !panel.current?.contains(document.activeElement)
        )
          close();
      }, 350);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (shown || pinned) return;
      const edge =
        e.clientX >= (document.documentElement.clientWidth || innerWidth) - 12;
      if (!edge || e.buttons || e.pointerType === "touch") {
        atEdge.current = false;
        cancel();
      } else if (!atEdge.current) {
        atEdge.current = true;
        cancel();
        timer.current = setTimeout(() => reveal(), 160);
      }
    };
    // Observe the edge without covering the native scrollbar's drag target.
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [shown, pinned, onOpenChange]);
  useEffect(() => {
    if (shown && !panel.current?.contains(document.activeElement))
      opener.current = document.activeElement as HTMLElement;
  }, [shown]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === "n" &&
        !blocked()
      ) {
        e.preventDefault();
        if (shown && !pinned) close();
        else reveal(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [shown, pinned, onOpenChange]);
  const categories = ["All", ...new Set(notices.map((n) => n.category))];
  const activeCategory = categories.includes(category) ? category : "All";
  const filtered = filterNotices(notices, activeCategory, unread, query);
  return (
    <>
      {!shown && (
        <button
          className="notification-edge"
          aria-label="Reveal notifications"
          title="Notifications · Ctrl+Shift+N"
          aria-controls="notification-panel"
          aria-expanded={false}
          onFocus={() => reveal(true)}
          onClick={() => reveal(true)}
        />
      )}
      {present && (
        <aside
          ref={panel}
          id="notification-panel"
          className="notification-dock"
          data-pinned={pinned}
          data-exiting={exiting}
          aria-hidden={!shown}
          inert={!shown}
          aria-label="Notifications"
          tabIndex={-1}
          onPointerEnter={cancel}
          onPointerLeave={tuck}
          onFocusCapture={cancel}
          onPointerDown={() => {
            keyboard.current = false;
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              tuck();
          }}
          onKeyDown={(e) => {
            keyboard.current = true;
            if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
              e.preventDefault();
              if (pinned) restoreFocus();
              else close();
            }
          }}
        >
          <header className="notification-head">
            <div>
              <h2>
                <Icon name="Notification History" /> Notifications{" "}
                <span className="notification-total">
                  {notices.filter((n) => !n.read).length}
                </span>
              </h2>
              <p>Waitin' for ya</p>
            </div>
            <button
              className="notification-pin"
              aria-label={pinned ? "Unpin notifications" : "Pin notifications"}
              title={pinned ? "Unpin notifications" : "Keep notifications open"}
              aria-pressed={pinned}
              disabled={busy}
              onClick={async () => {
                cancel();
                onOpenChange(true);
                await onPin(!pinned);
              }}
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3h8l-1 7 4 4v2H5v-2l4-4-1-7ZM12 16v6" />
              </svg>
            </button>
            {!pinned && (
              <button
                aria-label="Close notifications"
                title="Close notifications"
                onClick={close}
              >
                ×
              </button>
            )}
          </header>
          <div className="notification-filters">
            <label className="notification-search">
              Search notifications
              <input
                type="search"
                value={query}
                placeholder="Find a reminder…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div>
              <label>
                Category
                <Select
                  value={activeCategory}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={unread}
                  onChange={(e) => setUnread(e.target.checked)}
                />{" "}
                Unread only
              </label>
            </div>
          </div>
          <div
            className="notification-management"
            aria-label="Manage notifications"
          >
            <button
              disabled={busy || !notices.some((n) => !n.read)}
              onClick={() =>
                void manage(
                  "read",
                  notices.filter((n) => !n.read).map((n) => n.id),
                )
              }
            >
              Mark all as read
            </button>
            <button
              disabled={busy || !notices.some((n) => n.read)}
              onClick={() =>
                setConfirmation({
                  action: "clear_read",
                  ids: notices.filter((n) => n.read).map((n) => n.id),
                })
              }
            >
              Clear read
            </button>
            <button
              disabled={busy || !notices.length}
              onClick={() =>
                setConfirmation({
                  action: "clear_all",
                  ids: notices.map((n) => n.id),
                })
              }
            >
              Clear all
            </button>
            {managementError && <p role="alert">{managementError}</p>}
          </div>
          <div
            className="notification-scroll"
            tabIndex={0}
            aria-label="Notification history"
          >
            {filtered.map((n) => (
              <article
                className={`notice ${n.read ? "" : "unread"}`}
                key={n.id}
              >
                <div className="task-meta">
                  <span
                    className="notice-category"
                    data-status={taskCategory(n.category)}
                  >
                    {categoryLabel(n.category)}
                  </span>
                  <time>{date(n.created_at)}</time>
                  {n.state === "Failed" && (
                    <span className="notice-failed">
                      Could not send to Windows
                    </span>
                  )}
                  {n.state === "Pending" && <span>Waiting to send</span>}
                </div>
                <h3>
                  {offeredVersion(n) ? (
                    <button
                      className="notice-update-title"
                      disabled={
                        busy ||
                        (!!updateActivity && updateActivity.stage !== "error")
                      }
                      onClick={() => void onUpdate(n.id)}
                      aria-label={`Update Reprise to v${offeredVersion(n)}`}
                    >
                      {n.title}
                    </button>
                  ) : (
                    n.title
                  )}
                </h3>
                <p>{n.message}</p>
                {updateActivity?.notice_id === n.id && (
                  <p
                    className="update-progress"
                    role="status"
                    aria-label="Update progress"
                  >
                    {updateMessage(updateActivity)}
                  </p>
                )}
                <div className="task-actions">
                  {n.category === "DailyReview" && (
                    <button
                      onClick={() => {
                        onReview();
                        onRead(n.id);
                      }}
                    >
                      Open Daily Review
                    </button>
                  )}
                  <button
                    disabled={busy}
                    aria-label={`Dismiss ${n.title}`}
                    onClick={() => void manage("dismiss", [n.id])}
                  >
                    Dismiss
                  </button>
                  {n.task_id && (
                    <button
                      disabled={!tasks.some((t) => t.id === n.task_id)}
                      onClick={() => {
                        const task = tasks.find((t) => t.id === n.task_id);
                        if (task) onTask(task);
                      }}
                    >
                      Open task
                    </button>
                  )}
                  <button
                    disabled={n.read || busy}
                    onClick={() => onRead(n.id)}
                  >
                    {n.read ? "Read" : "Mark read"}
                  </button>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <div className="notification-empty">
                <Icon name="Notification History" />
                <h3>
                  {notices.length
                    ? "No matching reminders."
                    : "Nothing waiting here."}
                </h3>
                <p>
                  {notices.length
                    ? "Try another filter or search."
                    : "Your reminders will leave a record here."}
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
      {confirmation && (
        <NotificationClearDialog
          error={managementError}
          count={confirmation.ids.length}
          busy={busy}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void manage(confirmation.action, confirmation.ids)}
        />
      )}
    </>
  );
}
