import { Select } from "./Select";
import { isNightly } from "./Nightly";
import { useEffect, useRef, useState } from "react";
import {
  releases,
  releaseFor,
  type Release,
  type ReleaseEntry,
} from "./changelog";
function Entries({ entries }: { entries: ReleaseEntry[] }) {
  return (
    <ul>
      {entries.map((entry, i) => (
        <li key={i}>
          <span>{entry.text}</span>
          {entry.links?.map((link) =>
            /^https:\/\//.test(link.href) ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {link.label}
              </a>
            ) : null,
          )}
          {entry.details && <Entries entries={entry.details} />}
        </li>
      ))}
    </ul>
  );
}
export function ReleaseNotes({ release }: { release: Release }) {
  return (
    <article className="release-notes">
      <header className="release-heading">
        <p className="eyebrow">REPRISE / RELEASE NOTES</p>
        <h2>v{release.version}</h2>
        <time dateTime={release.date}>
          {new Date(`${release.date}T12:00:00`).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h3>{release.title}</h3>
        {release.subtitle && <p>{release.subtitle}</p>}
      </header>
      {release.sections.map((section) => (
        <section key={section.heading} data-release-accent={section.accent}>
          <h3>{section.heading}</h3>
          <Entries entries={section.entries} />
        </section>
      ))}
    </article>
  );
}
export function ReleaseDialog({
  current,
  mode,
  pending,
  onClose,
  onAcknowledge,
}: {
  current: string;
  mode: "new" | "history";
  pending: boolean;
  onClose: () => void;
  onAcknowledge: () => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(current),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  async function dismiss() {
    if (busy) return;
    if (mode === "new" && pending) {
      setBusy(true);
      if (!(await onAcknowledge())) {
        setError("Could not save your acknowledgment. Please try again.");
        setBusy(false);
        return;
      }
    }
    onClose();
  }
  const release = releaseFor(selected);
  return (
    <dialog
      ref={ref}
      className="task-dialog release-dialog material-floating"
      aria-label={mode === "new" ? "What's New" : "Release Notes history"}
      onCancel={(e) => {
        e.preventDefault();
        void dismiss();
      }}
    >
      <div className="release-toolbar">
        <strong>{mode === "new" ? "What’s New" : "Release history"}</strong>
        <label>
          Version
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {!releaseFor(current) && (
              <option value={current}>{current} — notes unavailable</option>
            )}
            {releases
              .filter((r) => isNightly(current) === isNightly(r.version))
              .map((r) => (
                <option key={r.version} value={r.version}>
                  v{r.version}
                </option>
              ))}
          </Select>
        </label>
      </div>
      <div className="release-scroll">
        {release ? (
          <ReleaseNotes release={release} />
        ) : (
          <div className="empty">
            <h2>Notes are not bundled for v{selected}.</h2>
            <p>You can still browse earlier releases above.</p>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="release-footer">
        <button
          autoFocus
          className="primary"
          disabled={busy}
          onClick={() => void dismiss()}
        >
          {busy ? "Saving…" : mode === "new" ? "Got it" : "Close history"}
        </button>
      </footer>
    </dialog>
  );
}
