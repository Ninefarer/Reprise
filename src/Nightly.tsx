import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
export const issueUrl = "https://github.com/Ninefarer/Reprise/issues/new";
export function isNightly(version?: string) {
  return !!version && /^\d+\.\d+\.\d+-nightly(?:[.+]|$)/.test(version);
}
export function NightlyBadge({ version }: { version: string }) {
  return (
    <div
      role="note"
      className="nightly-badge"
      title={`Reprise Nightly ${version}`}
      aria-label={`Nightly build ${version}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M7 2h6M8 2v6l-4 7a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-7V2M6 12h8" />
      </svg>
      <span className="nightly-label">Nightly</span>
    </div>
  );
}
export function NightlyDisclosure({
  version,
  onClose,
}: {
  version: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="task-dialog nightly-disclosure material-floating"
      aria-labelledby="nightly-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <NightlyBadge version={version} />
      <h2 id="nightly-title">You're running Reprise Nightly</h2>
      <p>
        This is a prerelease testing build. Features may change, and bugs or
        regressions may occur.
      </p>
      <p>
        Nightly installs separately from stable and uses its own local data.
        Quit stable before testing the shared Quick Capture shortcut.
      </p>
      <p>
        If you find a problem, report it on GitHub with the steps to reproduce
        it and your version. Avoid including private task data.
      </p>
      <a
        href={issueUrl}
        onClick={(e) => {
          e.preventDefault();
          void invoke("open_issue_report").catch((error) =>
            setError(String(error)),
          );
        }}
      >
        Report an issue on GitHub {"\u2197"}
      </a>
      <p className="hint">Version {version}</p>
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <button autoFocus type="button" className="primary" onClick={onClose}>
          Continue to Nightly
        </button>
      </div>
    </dialog>
  );
}
