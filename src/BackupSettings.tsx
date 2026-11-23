import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function BackupSettings() {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function run(command: string) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await invoke<string>(command, { path }));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>Backup and restore</h2>
      <p>
        Enter an absolute filename ending in .reprise-backup. Backups include
        tasks, history, settings and your avatar. Choose a new filename when
        creating a backup.
      </p>
      <label>
        Backup file
        <input
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setConfirm(false);
          }}
          placeholder="C:\\Users\\you\\Documents\\tasks.reprise-backup"
          disabled={busy}
        />
      </label>
      <div className="dialog-actions">
        <button
          type="button"
          disabled={busy || !path}
          onClick={() => void run("create_backup")}
        >
          Create backup
        </button>
        <button
          type="button"
          disabled={busy || !path}
          onClick={() => setConfirm(true)}
        >
          Restore backup
        </button>
      </div>
      {confirm && (
        <div role="alert">
          <p>
            Replace this installation’s tasks, history and settings with the
            backup and restart Reprise? Unsaved drafts will be discarded. A
            safety backup will be saved in the app data folder first.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("restore_backup")}
          >
            Restore and restart
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {busy && <p role="status">Working…</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
