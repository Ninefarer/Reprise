import { useEffect, useRef, useState } from "react";

export function UnsavedSettingsDialog({
  onStay,
  onDiscard,
  onSave,
}: {
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="task-dialog material-floating"
      aria-labelledby="unsaved-settings-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onStay();
      }}
    >
      <div className="delete-content">
        <h2 id="unsaved-settings-title">Save your Settings changes?</h2>
        <p>
          Your profile and reminder changes haven’t been saved. Appearance and
          picture changes are already saved.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button autoFocus disabled={busy} onClick={onStay}>
            Keep editing
          </button>
          <button disabled={busy} onClick={onDiscard}>
            Discard changes
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (!(await onSave()))
                  setError("Couldn’t save. Your changes are still here.");
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
