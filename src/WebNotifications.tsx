import { useState } from "react";
import { platform } from "reprise:platform";

export function WebNotifications() {
  const [permission, setPermission] = useState(() =>
    platform.kind === "web" ? platform.notifications.permission() : "unsupported",
  );
  const [detail, setDetail] = useState("");
  if (platform.kind !== "web") return null;
  return (
    <div className="web-notifications">
      <p className="hint">
        While Reprise is open, an allowed browser can show an alert. iOS only
        shows the permission prompt from a tap, and only for a Home Screen app.
      </p>
      <p className="hint">
        Timed reminders after you leave are not available yet. Task text stays
        on this device. Export or import a backup at the top of Settings. On a
        phone, open More, then Settings. Home Screen storage is separate from
        Safari tabs.
      </p>
      <div className="dialog-actions">
        <button
          type="button"
          disabled={permission === "granted" || permission === "unsupported"}
          onClick={() => {
            const requested = platform.notifications.requestPermission();
            const durable = platform.requestDurableStorage();
            void Promise.all([requested, durable]).then(async ([next]) => {
              setPermission(next);
              if (next !== "granted") {
                setDetail("");
                return;
              }
              const push = await platform.push.subscribe();
              setDetail(
                push.status === "unconfigured"
                  ? push.reason
                  : "Notifications are allowed while Reprise is open.",
              );
            });
          }}
        >
          {permission === "granted" ? "Notifications allowed" : "Allow notifications"}
        </button>
      </div>
      <p role="status" className="hint">
        {permission === "granted"
          ? detail || "Notifications are allowed while Reprise is open."
          : permission === "denied"
            ? "Notifications are blocked for this app. iOS keeps that choice in Settings."
            : permission === "unsupported"
              ? "This browser has no notification API. On iPhone, install Reprise to the Home Screen and open it from there."
              : "Notifications are not allowed yet."}
      </p>
    </div>
  );
}
