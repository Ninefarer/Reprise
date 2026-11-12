import { categoryLabel, reminderCategories } from "./notifications";
import { useState } from "react";
import type { Settings, Snapshot, VisualPreferences } from "./model";
import { AppearanceSettings } from "./AppearanceSettings";
import { AvatarEditor } from "./Profile";
import { Diagnostics, TestNotification } from "./Diagnostics";
export function Preferences({
  settings,
  onSave,
  onRedoOnboarding,
  onVisual,
  system,
  version,
  onReleaseNotes,
  avatar,
  onRefresh,
  onCheckUpdates,
  checkingUpdates,
  updateCheckMessage,
}: {
  settings: Settings;
  onRedoOnboarding: () => void;
  avatar?: string | null;
  onRefresh?: () => Promise<void>;
  onSave: (s: Settings) => Promise<boolean>;
  onVisual: (patch: Partial<VisualPreferences>) => Promise<void>;
  system?: Snapshot["system_visuals"];
  version: string;
  onReleaseNotes: (mode: "new" | "history") => void;
  onCheckUpdates: () => Promise<void>;
  checkingUpdates: boolean;
  updateCheckMessage?: string;
}) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [draft, setDraft] = useState(settings),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  return (
    <form
      className="preferences"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaved(await onSave(draft));
        setBusy(false);
      }}
    >
      <section className="settings-section" id="profile-section">
        <h2>Your space</h2>
        <p>A few familiar details to make it yours.</p>
        <AvatarEditor
          avatar={avatar}
          name={settings.name}
          onSaved={onRefresh ?? (async () => {})}
        />
        <div className="fields">
          <label>
            Display name
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label>
            Space name
            <input
              value={draft.workspace}
              onChange={(e) => set("workspace", e.target.value)}
            />
          </label>
        </div>
      </section>
      <AppearanceSettings
        settings={settings}
        system={system}
        onChange={onVisual}
      />
      <section className="settings-section">
        <h2>Returning to your intentions</h2>
        <div className="fields">
          <label>
            Default settlement mode
            <select
              value={draft.settlement_mode}
              onChange={(e) => set("settlement_mode", e.target.value)}
            >
              <option value="next_day">Next calendar day</option>
              <option value="24h">Exactly 24 hours later</option>
            </select>
          </label>
          <label>
            Preferred next-day time
            <input
              type="time"
              required
              value={draft.return_time}
              onChange={(e) => set("return_time", e.target.value)}
            />
          </label>
          <label>
            Daily review time
            <input
              type="time"
              required
              value={draft.review_time}
              onChange={(e) => set("review_time", e.target.value)}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.daily_review}
            onChange={(e) => set("daily_review", e.target.checked)}
          />
          Send a daily review reminder
        </label>
      </section>
      <section className="settings-section">
        <h2>Attention and background behavior</h2>
        <div className="fields">
          <label>
            Quiet hours begin
            <input
              type="time"
              required
              value={draft.quiet_start}
              onChange={(e) => set("quiet_start", e.target.value)}
            />
          </label>
          <label>
            Quiet hours end
            <input
              type="time"
              required
              value={draft.quiet_end}
              onChange={(e) => set("quiet_end", e.target.value)}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.notifications}
            onChange={(e) => set("notifications", e.target.checked)}
          />
          Native Windows notifications
        </label>
        <fieldset className="notification-preferences">
          <legend>Reminder categories</legend>
          {reminderCategories.map((category) => (
            <label className="check" key={category}>
              <input
                type="checkbox"
                checked={draft.categories.includes(category)}
                onChange={(e) =>
                  set(
                    "categories",
                    e.target.checked
                      ? [...draft.categories, category]
                      : draft.categories.filter((c) => c !== category),
                  )
                }
              />
              {categoryLabel(category)}
            </label>
          ))}
        </fieldset>
        <TestNotification />
        <label className="check">
          <input
            type="checkbox"
            checked={draft.close_to_tray}
            onChange={(e) => set("close_to_tray", e.target.checked)}
          />
          Keep running in the tray when I close the window
        </label>
        <p className="hint">
          Quit from the tray to stop the background process. Quick Capture: Ctrl
          + Shift + Space.
        </p>
      </section>
      <section className="settings-section">
        <h2>Keyboard</h2>
        <label>
          Command palette shortcut
          <select
            value={draft.command_shortcut ?? "Ctrl+K"}
            onChange={(e) => set("command_shortcut", e.target.value)}
          >
            <option value="Ctrl+K">Ctrl+K</option>
            <option value="Ctrl+Shift+P">Ctrl+Shift+P</option>
          </select>
        </label>
        <p className="hint">
          Quick Capture remains Ctrl+Shift+Space. Resume restores the previous
          actionable status; older tasks without one return to Inbox.
        </p>
      </section>
      <div className="save-bar">
        <button className="primary" disabled={busy}>
          Save preferences
        </button>
        <span role="status">{saved ? "Preferences saved." : ""}</span>
      </div>
      <details
        className="settings-section"
        onToggle={(e) => setDiagnosticsOpen(e.currentTarget.open)}
      >
        <summary>Advanced / Diagnostics</summary>
        {diagnosticsOpen && <Diagnostics />}
      </details>
      <section className="settings-section">
        <h2>Setup</h2>
        <button type="button" onClick={onRedoOnboarding}>
          Redo onboarding
        </button>
      </section>
      <section className="settings-section" aria-labelledby="updates-heading">
        <h2 id="updates-heading">About / Updates</h2>
        <p>Reprise v{version}</p>
        <p className="hint">
          Checks for updates after setup and every six hours while Reprise is
          running. You choose when to download and install.
        </p>
        {updateCheckMessage && <p role="status">{updateCheckMessage}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            onClick={() => void onCheckUpdates()}
            disabled={checkingUpdates}
          >
            {checkingUpdates ? "Checking…" : "Check for updates"}
          </button>
          <button type="button" onClick={() => onReleaseNotes("new")}>
            What's New
          </button>
          <button type="button" onClick={() => onReleaseNotes("history")}>
            Release Notes history
          </button>
        </div>
      </section>
    </form>
  );
}
