import { TaskHistory } from "./TaskHistory";
import { DateTimeField } from "./DateTimeField";
import { Select } from "./Select";
import { useEffect, useRef, useState } from "react";
import { useDialogMotion } from "./useMotion";
import {
  date,
  localInput,
  parseInput,
  statuses,
  label,
  type Task,
  type Status,
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
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const close = useDialogMotion(ref, onClose, task.id);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    if (intent !== "history")
      ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      previous?.focus();
    };
  }, [task.id]);
  const set = <K extends keyof Task>(k: K, v: Task[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function submit(status?: Status) {
    if (busy) return;
    if (!draft.title.trim()) {
      setError("Enter a task title.");
      ref.current?.querySelector("input")?.focus();
      return;
    }
    const scheduleChanged =
      draft.scheduled_at !== task.scheduled_at ||
      ((status ?? draft.status) === "Scheduled" && task.status !== "Scheduled");
    if (
      scheduleChanged &&
      draft.scheduled_at != null &&
      draft.scheduled_at <= Math.floor(Date.now() / 1000)
    ) {
      setError("Choose a scheduled start in the future.");
      return;
    }
    if (!ref.current?.querySelector("form")?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const ok = status
        ? await onTransition(draft, status)
        : await onSave(draft);
      if (ok) close();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (intent === "history")
    return (
      <dialog
        ref={ref}
        className="task-dialog task-history-dialog material-floating"
        aria-label="Task history"
        onCancel={close}
      >
        <header className="task-history-header">
          <div>
            <h2>{task.title}</h2>
            <div className="dialog-statuses">
              <span className="status" data-status={task.status}>
                {label(task.status)}
              </span>
              {task.review_at !== null && (
                <span className="status" data-status="Resurfaced">
                  Resurfaced
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close history"
            data-tooltip="Close history"
            onClick={close}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <div
          className="task-history-scroll"
          role="region"
          aria-label="Task history entries"
          tabIndex={0}
        >
          {task.description && (
            <p className="readonly-notes">{task.description}</p>
          )}
          {(task.scheduled_at != null || task.due_at != null) && (
            <dl className="task-history-dates">
              {task.scheduled_at != null && (
                <div>
                  <dt>Scheduled</dt>
                  <dd>{date(task.scheduled_at)}</dd>
                </div>
              )}
              {task.due_at != null && (
                <div>
                  <dt>Deadline</dt>
                  <dd>{date(task.due_at)}</dd>
                </div>
              )}
            </dl>
          )}
          {(error || externalError) && (
            <p role="alert">{error || externalError}</p>
          )}
          <TaskHistory taskId={task.id} standalone />
        </div>
      </dialog>
    );
  const editing = intent === "edit";
  const statusBadges = (
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
  );
  const transitions = (
    <div
      className="editor-transitions"
      role="group"
      aria-label={editing ? undefined : "Save and change task status"}
      aria-labelledby={editing ? "edit-task-transitions" : undefined}
      aria-describedby={editing ? undefined : "task-transition-help"}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit("DoNow")}
      >
        Start now
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit("Settled")}
      >
        {task.status === "Settled" ? "Settle again" : "Settle"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit("Finished")}
      >
        Finish
      </button>
    </div>
  );
  const planning = (
    <fieldset className="editor-section">
      <legend>Status and timing</legend>
      <div className="fields">
        <label>
          Status
          <Select
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
          </Select>
        </label>
        <label>
          Priority
          <Select
            value={draft.priority}
            onChange={(e) => set("priority", Number(e.target.value))}
          >
            {["None", "Low", "Medium", "High"].map((v, i) => (
              <option value={i} key={v}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Scheduled start
          <DateTimeField
            aria-label="Scheduled start"
            type="datetime-local"
            required={draft.status === "Scheduled"}
            min={
              draft.scheduled_at !== task.scheduled_at ||
              (draft.status === "Scheduled" && task.status !== "Scheduled")
                ? localInput(Math.floor(Date.now() / 1000) + 60)
                : undefined
            }
            value={localInput(draft.scheduled_at)}
            onChange={(e) => set("scheduled_at", parseInput(e.target.value))}
          />
        </label>
        <label>
          Deadline
          <DateTimeField
            aria-label="Deadline"
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
            <DateTimeField
              aria-label="Custom return time"
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
          {draft.settlement_mode === "auto" ? (
            "Reprise auto-settled this task. Use Resume from the Settled list to move it back to Inbox."
          ) : (
            <>
              Settling uses your saved attention preference. Existing return
              times stay fixed when you edit notes. Use &ldquo;Settle
              again&rdquo; for a new period.
            </>
          )}
        </p>
      )}
      {draft.status === "Settled" && intent === "return" && (
        <label>
          Return time
          <DateTimeField
            aria-label="Return time"
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
            <DateTimeField
              aria-label="Follow-up time"
              type="datetime-local"
              value={localInput(draft.wake_at)}
              onChange={(e) => set("wake_at", parseInput(e.target.value))}
            />
          </label>
        </>
      )}
      {!editing && (
        <>
          <p className="hint" id="task-transition-help">
            These actions save your edits and change the task status. Start now
            moves it to Current; Settle pauses it using your saved return
            preference; Finish marks it complete.
          </p>
          {transitions}
        </>
      )}
    </fieldset>
  );
  const writingFields = (
    <>
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
          placeholder={editing ? undefined : "Context for your future self…"}
        />
      </label>
    </>
  );
  const project = (
    <label>
      Project
      <input
        value={draft.project}
        onChange={(e) => set("project", e.target.value)}
        aria-describedby={editing ? undefined : "task-project-help"}
      />
    </label>
  );
  const deleteButton = (
    <button type="button" className="danger" disabled={busy} onClick={onDelete}>
      Delete permanently&hellip;
    </button>
  );
  const footer = (
    <div className="dialog-actions editor-primary-actions">
      {editing && deleteButton}
      <button type="button" disabled={busy} onClick={close}>
        Cancel
      </button>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
  const details = (
    <>
      <TaskHistory taskId={task.id} />
      {!editing && <div className="delete-section">{deleteButton}</div>}
    </>
  );
  return (
    <dialog
      ref={ref}
      className={
        editing
          ? "task-dialog material-floating task-edit-dialog"
          : "task-dialog material-floating"
      }
      aria-labelledby="task-editor-heading"
      onCancel={close}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          await submit();
        }}
      >
        <div className="dialog-head">
          <div>
            <h2 id="task-editor-heading">
              {
                {
                  edit: "Edit task",
                  schedule: "Schedule task",
                  snooze: "Snooze task",
                  return: "Change return time",
                  followup: "Change follow-up",
                  history: "Task history",
                }[intent]
              }
            </h2>
            {editing && statusBadges}
          </div>
          <button type="button" aria-label="Close task details" onClick={close}>
            ×
          </button>
        </div>
        {editing ? (
          <>
            <div className="task-edit-body">
              {(error || externalError) && (
                <p className="error" role="alert">
                  {externalError || error}
                </p>
              )}
              <div className="task-edit-columns">
                <div className="task-edit-writing">
                  {writingFields}
                  {project}
                </div>
                {planning}
              </div>
              <div className="task-edit-status-actions">
                <p id="edit-task-transitions">Save and change status</p>
                {transitions}
              </div>
              <div className="task-edit-details">{details}</div>
            </div>
            {footer}
          </>
        ) : (
          <>
            {statusBadges}
            {(error || externalError) && (
              <p className="error" role="alert">
                {externalError || error}
              </p>
            )}
            {writingFields}
            {planning}
            {project}
            <p className="hint" id="task-project-help">
              Optional. Shown on the task card and included in search.
            </p>
            {footer}
            {details}
          </>
        )}
      </form>
    </dialog>
  );
}
