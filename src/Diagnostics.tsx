import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { date } from "./model";
interface Diagnostic {
  health: {
    heartbeat: number | null;
    scheduler_error: string | null;
    tray_running: boolean;
    shortcut_error: string | null;
  };
  application_id: string;
  registration: string;
  last_submission: number | null;
  errors: { at: number; message: string }[];
}
export function Diagnostics() {
  const [data, setData] = useState<Diagnostic | null>(null),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      setData(await invoke("diagnostics"));
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="settings-section" aria-labelledby="diagnostic-heading">
      <h2 id="diagnostic-heading">Notification diagnostics</h2>
      <p>
        Windows decides whether a submitted notification is displayed. Reprise
        has no display or read receipt.
      </p>
      {data && (
        <dl className="diagnostics">
          <dt>Application identity</dt>
          <dd>{data.application_id}</dd>
          <dt>Windows registration</dt>
          <dd>{data.registration}</dd>
          <dt>Scheduler</dt>
          <dd>
            {data.health.heartbeat &&
            Date.now() / 1000 - data.health.heartbeat < 45
              ? "Running"
              : "Awaiting heartbeat"}{" "}
            · last tick {date(data.health.heartbeat)}
          </dd>
          <dt>Background / tray</dt>
          <dd>
            {data.health.tray_running ? "Tray process running" : "Not running"}
          </dd>
          <dt>Last successful submission</dt>
          <dd>{date(data.last_submission)}</dd>
          <dt>Quick Capture shortcut</dt>
          <dd>{data.health.shortcut_error || "Registered"}</dd>
        </dl>
      )}
      {data?.health.scheduler_error && (
        <p role="alert">Scheduler: {data.health.scheduler_error}</p>
      )}
      {data?.errors.map((e, i) => (
        <p className="hint" key={i}>
          {date(e.at)} · {e.message}
        </p>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={() => void load()}>
          Refresh diagnostics
        </button>
      </div>
    </section>
  );
}

export function TestNotification() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <div className="dialog-actions">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await invoke("test_notification");
              setMessage(
                "Submitted to Windows. This does not confirm display.",
              );
            } catch (e) {
              setError(String(e));
            }
            setBusy(false);
          }}
        >
          Test Windows notification
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status" className="hint">
        {message}
      </p>
    </>
  );
}
