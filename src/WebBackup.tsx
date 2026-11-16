import { useEffect, useRef, useState } from "react";
import { platform } from "reprise:platform";
import { browserIndexedDbStorage } from "./platform/storage";
import "./web-backup.css";

export function WebBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (platform.kind !== "web") return;
    let live = true;
    void browserIndexedDbStorage()
      .read()
      .then((document) => {
        if (live) setTitles(document?.tasks.map((task) => task.title) ?? []);
      })
      .catch(() => {
        if (live) setTitles([]);
      });
    return () => {
      live = false;
    };
  }, []);
  if (platform.kind !== "web") return null;

  async function exportBackup() {
    setBusy(true);
    setStatus("");
    try {
      const json = await browserIndexedDbStorage().exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "reprise-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus("Backup file ready. It stays on this device until you move it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function replace() {
    if (pending == null) return;
    setBusy(true);
    setStatus("");
    try {
      await browserIndexedDbStorage().importBackup(pending);
      setStatus("Backup restored.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
      setBusy(false);
    }
  }

  return (
    <section className="web-backup" aria-label="Backup">
      <p className="hint">
        {titles.length
          ? `On this device: ${titles.join(", ")}.`
          : "No tasks saved in this browser yet."}{" "}
        Export a backup file if you want a copy you can keep. Home Screen
        storage is separate from Safari tabs.
      </p>
      <div className="web-backup-actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void exportBackup()}
        >
          Export backup
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Import backup
        </button>
      </div>
      <input
        ref={input}
        className="web-backup-file"
        type="file"
        accept="application/json,.json"
        aria-label="Import backup file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void file.text().then(
            (json) => {
              setPending(json);
              setStatus("");
            },
            () => {
              setPending(null);
              setStatus(
                "This backup could not be read. Saved tasks were left untouched.",
              );
            },
          );
        }}
      />
      {pending != null && (
        <div className="web-backup-confirm">
          <p className="hint">
            Replace the tasks on this device with this backup?
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void replace()}
          >
            Replace tasks
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Keep current tasks
          </button>
        </div>
      )}
      <p role="status" className="hint">
        {status}
      </p>
    </section>
  );
}
