import { useEffect, useRef, useState } from "react";
import type { Task } from "./model";
export function DeleteTaskDialog({
  task,
  error,
  onCancel,
  onConfirm,
}: {
  task: Task;
  error: string;
  onCancel: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="task-dialog delete-dialog material-floating"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onCancel();
      }}
    >
      <div className="delete-content">
        <p className="eyebrow">PERMANENT DELETION</p>
        <h2 id="delete-title">Delete this task?</h2>
        <p className="delete-title">{task.title}</p>
        <p id="delete-description">
          This permanently removes the task, its notes, task history, reminders,
          and in-app notification records. It cannot be undone. Dropping a task
          keeps its record; deleting removes it.
        </p>
        <p className="hint">Any subtasks are kept as independent tasks.</p>
        <p className="hint">
          Previously submitted Windows notifications may remain in Notification
          Center.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button autoFocus disabled={busy} onClick={onCancel}>
            Keep task
          </button>
          <button
            className="danger-solid"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
