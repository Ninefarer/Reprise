import { useEffect, useState } from "react";
import { platform } from "reprise:platform";
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
      setData(await platform.diagnostics());
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
        {platform.kind === "web"
          ? "Browser alerts can appear while this page is open. Leaving the app cannot schedule a local reminder."
          : "Windows decides whether a submitted notification is displayed. Reprise has no display or read receipt."}
      </p>
      {data && (
        <dl className="diagnostics">
          <dt>Application identity</dt>
          <dd>{data.application_id}</dd>
          <dt>
            {platform.kind === "web"
              ? "Notification permission"
              : "Windows registration"}
          </dt>
          <dd>{data.registration}</dd>
          <dt>Scheduler</dt>
          <dd>
            {data.health.heartbeat &&
            Date.now() / 1000 - data.health.heartbeat < 45
              ? "Running"
              : "Awaiting heartbeat"}{" "}
            · last tick {date(data.health.heartbeat)}
          </dd>
          <dt>{platform.kind === "web" ? "Background" : "Background / tray"}</dt>
          <dd>
            {platform.kind === "web"
              ? "No system tray. Reminders run while this page is open."
              : data.health.tray_running
                ? "Tray process running"
                : "Not running"}
          </dd>
          <dt>Last successful submission</dt>
          <dd>{date(data.last_submission)}</dd>
          <dt>
            {platform.kind === "web"
              ? "Quick Capture"
              : "Quick Capture shortcut"}
          </dt>
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
              await platform.testNotification();
              setMessage(
                platform.kind === "web"
                  ? "Shown while Reprise is open. This does not schedule a later alert."
                  : "Submitted to Windows. This does not confirm display.",
              );
            } catch (e) {
              setError(String(e));
            }
            setBusy(false);
          }}
        >
          {platform.kind === "web"
            ? "Test notification"
            : "Test Windows notification"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status" className="hint">
        {message}
      </p>
    </>
  );
}
