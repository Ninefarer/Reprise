import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  date,
  localInput,
  parseInput,
  statuses,
  label,
  type Task,
  type Status,
  type History,
} from "./model";
export type TaskIntent =
  "edit" | "schedule" | "snooze" | "return" | "followup" | "history";
export function TaskDialog({
  task,
  intent,
  onClose,
  onSave,
  onTransition,
  externalError,
  onDelete,
}: {
  task: Task;
  externalError?: string;
  intent: TaskIntent;
  onClose: () => void;
  onDelete: () => void;
  onSave: (t: Task) => Promise<boolean>;
  onTransition: (t: Task, s: Status) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Task>(() => ({
    ...task,
    status:
      intent === "schedule"
        ? "Scheduled"
        : intent === "snooze"
          ? "Snoozed"
          : task.status,
    wake_at:
      intent === "snooze" ? Math.floor(Date.now() / 1000) + 3600 : task.wake_at,
  }));
  const [history, setHistory] = useState<History[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    if (intent !== "history")
      ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    void invoke<History[]>("task_history", { id: task.id })
      .then(setHistory)
      .catch((e) => setError(String(e)));
    return () => {
      previous?.focus();
    };
  }, [task.id]);
  const set = <K extends keyof Task>(k: K, v: Task[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function transition(s: Status) {
    setBusy(true);
    if (await onTransition(task, s)) onClose();
    setBusy(false);
  }
  if (intent === "history")
    return (
      <dialog
        ref={ref}
        className="task-dialog material-floating"
        aria-label="Task history"
        onCancel={onClose}
      >
        <div className="delete-content">
          <h2>{task.title}</h2>
          <div className="dialog-statuses">
            <span className="status" data-status={task.status}>
              {label(task.status)}
            </span>
            {task.review_at !== null && (
              <span className="status" data-status="Resurfaced">
                Resurfaced · review queue
              </span>
            )}
          </div>
          <button onClick={onClose}>Close history</button>
          {task.description && (
            <p className="readonly-notes">{task.description}</p>
          )}
          <p className="hint">
            {label(task.status)} · Scheduled {date(task.scheduled_at)} ·
            Deadline {date(task.due_at)}
          </p>
          {(error || externalError) && (
            <p role="alert">{error || externalError}</p>
          )}
          <section className="history">
            <h3>Task history</h3>
            {history.map((h, i) => (
              <div key={i}>
                <span>{label(h.action)}</span>
                <time>{date(h.at)}</time>
              </div>
            ))}
          </section>
        </div>
      </dialog>
    );
  return (
    <dialog
      ref={ref}
      className="task-dialog material-floating"
      onCancel={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await onSave(draft)) onClose();
          setBusy(false);
        }}
      >
        <div className="dialog-head">
          <div>
            <p className="eyebrow">INTENTION DETAILS</p>
            <h2>Make the next step clear.</h2>
          </div>
          <button
            type="button"
            aria-label="Close task details"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="dialog-statuses">
          <span className="status" data-status={draft.status}>
            {label(draft.status)}
          </span>
          {task.review_at !== null && (
            <span className="status" data-status="Resurfaced">
              Resurfaced · review queue
            </span>
          )}
        </div>
        {(error || externalError) && (
          <p className="error" role="alert">
            {externalError || error}
          </p>
        )}
        <label>
          Title
          <input
            autoFocus
            required
            maxLength={500}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Context for your future self…"
          />
        </label>
        <div className="fields">
          <label>
            Status
            <select
              value={draft.status}
              data-status={draft.status}
              onChange={(e) => {
                set("status", e.target.value as Status);
                if (e.target.value === "Snoozed" && !draft.wake_at)
                  set("wake_at", Math.floor(Date.now() / 1000) + 3600);
              }}
            >
              {statuses.map((s) => (
                <option value={s} key={s} data-status={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={draft.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
            >
              {["None", "Low", "Medium", "High"].map((v, i) => (
                <option value={i} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheduled start
            <input
              type="datetime-local"
              required={draft.status === "Scheduled"}
              value={localInput(draft.scheduled_at)}
              onChange={(e) => set("scheduled_at", parseInput(e.target.value))}
            />
          </label>
          <label>
            Deadline
            <input
              type="datetime-local"
              value={localInput(draft.due_at)}
              onChange={(e) => set("due_at", parseInput(e.target.value))}
            />
          </label>
        </div>
        {draft.status === "Snoozed" && (
          <fieldset>
            <legend>Snooze until</legend>
            <div className="preset-row">
              {[
                ["15 min", 900],
                ["1 hour", 3600],
                ["24 hours", 86400],
                ["1 week", 604800],
              ].map(([name, sec]) => (
                <button
                  type="button"
                  key={name}
                  onClick={() =>
                    set("wake_at", Math.floor(Date.now() / 1000) + Number(sec))
                  }
                >
                  {name}
                </button>
              ))}
            </div>
            <label>
              Custom return time
              <input
                type="datetime-local"
                required
                min={localInput(Math.floor(Date.now() / 1000))}
                value={localInput(draft.wake_at)}
                onChange={(e) => set("wake_at", parseInput(e.target.value))}
              />
            </label>
          </fieldset>
        )}
        {draft.status === "Settled" && (
          <p className="hint">
            Settling uses your saved attention preference. Existing return times
            stay fixed when you edit notes. Use “Settle again” for a new period.
          </p>
        )}
        {draft.status === "Settled" && intent === "return" && (
          <label>
            Return time
            <input
              type="datetime-local"
              required
              value={localInput(draft.wake_at)}
              onChange={(e) => set("wake_at", parseInput(e.target.value))}
            />
          </label>
        )}
        {draft.status === "Waiting" && (
          <>
            <label>
              Dependency or reason
              <input
                value={draft.reason}
                onChange={(e) => set("reason", e.target.value)}
              />
            </label>
            <label>
              Follow-up time
              <input
                type="datetime-local"
                value={localInput(draft.wake_at)}
                onChange={(e) => set("wake_at", parseInput(e.target.value))}
              />
            </label>
          </>
        )}
        <div className="fields">
          <label>
            Project
            <input
              value={draft.project}
              onChange={(e) => set("project", e.target.value)}
            />
          </label>
          <label>
            Tags
            <input
              value={draft.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button className="primary" disabled={busy}>
            Save changes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void transition("DoNow")}
          >
            Do now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void transition("Settled")}
          >
            {task.status === "Settled" ? "Settle again" : "Settle"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void transition("Finished")}
          >
            Finish
          </button>
        </div>
        <section className="history">
          <h3>Task history</h3>
          {history.length ? (
            history.map((h, i) => (
              <div key={i}>
                <span>{label(h.action)}</span>
                <time>{date(h.at)}</time>
              </div>
            ))
          ) : (
            <p>No transitions recorded.</p>
          )}
        </section>
        <div className="delete-section">
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={onDelete}
          >
            Delete permanently…
          </button>
        </div>
      </form>
    </dialog>
  );
}
