import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Select } from "./Select";

type LocalBackup = { path: string; name: string; modified: number };
const filters = [{ name: "Reprise backup", extensions: ["reprise-backup"] }];

export function BackupSettings() {
  const [path, setPath] = useState("");
  const [backups, setBackups] = useState<LocalBackup[]>([]);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function refresh() {
    try {
      setBackups((await invoke<LocalBackup[]>("list_backups")) ?? []);
      setListError("");
    } catch (error) {
      setListError(String(error));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function pick(exporting: boolean) {
    setBusy(true);
    setMessage("");
    setConfirm(false);
    try {
      if (exporting) {
        const file = await save({
          title: "Export Reprise backup",
          defaultPath: "Reprise.reprise-backup",
          filters,
        });
        if (file) {
          const path = file.toLowerCase().endsWith(".reprise-backup")
            ? file
            : `${file}.reprise-backup`;
          setMessage(await invoke<string>("create_backup", { path }));
        }
      } else {
        const file = await open({
          title: "Choose a Reprise backup",
          filters,
          multiple: false,
        });
        if (typeof file === "string") setPath(file);
      }
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function run(command: string, filename?: string) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(
        await invoke<string>(
          command,
          filename === undefined ? {} : { path: filename.trim() },
        ),
      );
      if (command === "create_backup") await refresh();
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
        Local backups are saved in the backups folder inside Reprise app data.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run("create_backup")}
      >
        Create backup
      </button>
      {listError && <p role="alert">{listError}</p>}
      <label>
        Backup file
        <Select
          value={path}
          onChange={(event) => {
            setPath(event.target.value);
            setConfirm(false);
          }}
          disabled={busy}
        >
          <option value="">
            {backups.length ? "Choose a backup" : "No local backups"}
          </option>
          {backups.map((backup) => (
            <option key={backup.path} value={backup.path}>
              {new Date(backup.modified * 1000).toLocaleString()} · {backup.name}
            </option>
          ))}
          {path && !backups.some((backup) => backup.path === path) && (
            <option value={path}>{path.split(/[\\/]/).at(-1)}</option>
          )}
        </Select>
      </label>
      <div className="dialog-actions">
        <button type="button" disabled={busy} onClick={() => void pick(false)}>
          Browse backups
        </button>
        <button
          type="button"
          disabled={busy || !path}
          onClick={() => setConfirm(true)}
        >
          Restore backup
        </button>
      </div>
      <h3>Takeout</h3>
      <p>Export a copy of your tasks, history, settings, and avatar.</p>
      <button type="button" disabled={busy} onClick={() => void pick(true)}>
        Export backup
      </button>
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
            onClick={() => void run("restore_backup", path)}
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
