import { useEffect, useRef } from "react";
export function NotificationClearDialog({
  count,
  error,
  busy,
  onConfirm,
  onClose,
}: {
  count: number;
  error?: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="task-dialog notification-clear-dialog material-floating"
      aria-labelledby="clear-notifications-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="clear-notifications-title">
        Clear {count} notification{count === 1 ? "" : "s"}?
      </h2>
      <p>
        This permanently removes the selected local history. It does not clear
        Windows Notification Center or change your tasks.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" autoFocus disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={onConfirm}>
          Clear notifications
        </button>
      </div>
    </dialog>
  );
}
