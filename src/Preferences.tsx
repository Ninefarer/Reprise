import { DateTimeField } from "./DateTimeField";
import { Select } from "./Select";
import { isNightly } from "./Nightly";
import { categoryLabel, reminderCategories } from "./notifications";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Settings, Snapshot, VisualPreferences } from "./model";
import { AppearanceSettings } from "./AppearanceSettings";
import { AvatarEditor } from "./Profile";
import { Diagnostics, TestNotification } from "./Diagnostics";
export interface SettingsEditor {
  dirty: boolean;
  busy: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}
const sections = {
  Profile: ["name"],
  Appearance: [],
  Reminders: [
    "settlement_mode",
    "return_time",
    "review_time",
    "daily_review",
    "quiet_start",
    "quiet_end",
    "notifications",
    "categories",
    "close_to_tray",
  ],
  Keyboard: ["command_shortcut"],
  About: [],
} satisfies Record<string, (keyof Settings)[]>;
type Section = keyof typeof sections;
const editableKeys = Object.values(sections).flat();
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
  onEditor,
}: {
  settings: Settings;
  onRedoOnboarding: () => void;
  avatar?: string | null;
  onRefresh?: () => Promise<void>;
  onSave: (s: Partial<Settings>) => Promise<boolean>;
  onVisual: (patch: Partial<VisualPreferences>) => Promise<void>;
  system?: Snapshot["system_visuals"];
  version: string;
  onReleaseNotes: (mode: "new" | "history") => void;
  onCheckUpdates: () => Promise<void>;
  checkingUpdates: boolean;
  updateCheckMessage?: string;
  onEditor?: (editor: SettingsEditor | null) => void;
}) {
  const [section, setSection] = useState<Section>("Profile");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [draft, setDraft] = useState(settings),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState(settings);
  const [saveError, setSaveError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const dirty = editableKeys.some(
    (k) => JSON.stringify(draft[k]) !== JSON.stringify(baseline[k]),
  );
  async function save(keys: readonly (keyof Settings)[] = editableKeys) {
    if (submitting.current) return false;
    const fields =
      form.current?.querySelectorAll<HTMLInputElement>("input, textarea");
    for (const field of Array.from(fields ?? [])) {
      const panel = field.closest<HTMLElement>("[data-settings-panel]")?.dataset
        .settingsPanel as Section;
      if (
        panel &&
        sections[panel].some((key) => keys.includes(key)) &&
        !field.checkValidity()
      ) {
        setSection(panel);
        requestAnimationFrame(() => field.reportValidity());
        return false;
      }
    }
    submitting.current = true;
    setBusy(true);
    setSaved(false);
    setSaveError("");
    const submitted = Object.fromEntries(
      keys
        .filter(
          (key) => JSON.stringify(draft[key]) !== JSON.stringify(baseline[key]),
        )
        .map((key) => [key, draft[key]]),
    ) as Partial<Settings>;
    if (!Object.keys(submitted).length) {
      submitting.current = false;
      setBusy(false);
      return true;
    }
    try {
      const ok = await onSave(submitted);
      if (ok) {
        setBaseline((previous) => ({ ...previous, ...submitted }));
        setSaved(true);
      }
      return ok;
    } catch (error) {
      setSaveError(String(error));
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function discard() {
    setDraft(settings);
    setBaseline(settings);
    setSaved(false);
  }
  useLayoutEffect(() => {
    onEditor?.({ dirty, busy, save, discard });
  });
  useEffect(() => () => onEditor?.(null), [onEditor]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  return (
    <form
      ref={form}
      className="preferences"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        await save(sections[section]);
      }}
    >
      <div
        role="tablist"
        aria-label="Settings sections"
        className="settings-tabs"
      >
        {(Object.keys(sections) as Section[]).map((name, index, names) => (
          <button
            type="button"
            role="tab"
            key={name}
            id={`settings-tab-${name}`}
            aria-controls={`settings-panel-${name}`}
            aria-selected={section === name}
            tabIndex={section === name ? 0 : -1}
            onClick={() => setSection(name)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  names[
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? names.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            names.length) %
                          names.length
                  ];
                setSection(next);
                document.getElementById(`settings-tab-${next}`)?.focus();
              }
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        data-settings-panel="Profile"
        id="settings-panel-Profile"
        aria-labelledby="settings-tab-Profile"
        hidden={section !== "Profile"}
      >
        <section className="settings-section" id="profile-section">
          <h2>Profile</h2>
          <AvatarEditor
            avatar={avatar}
            name={settings.name}
            onSaved={onRefresh ?? (async () => {})}
          />
          <label>
            Display name
            <input
              maxLength={100}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </label>
        </section>
        <section className="settings-section setup-row">
          <h2>Setup</h2>
          <button type="button" onClick={onRedoOnboarding}>
            Redo onboarding
          </button>
        </section>
      </div>
      <div
        role="tabpanel"
        data-settings-panel="Appearance"
        id="settings-panel-Appearance"
        aria-labelledby="settings-tab-Appearance"
        hidden={section !== "Appearance"}
      >
        <AppearanceSettings
          settings={settings}
          system={system}
          onChange={onVisual}
        />
      </div>
      <div
        role="tabpanel"
        data-settings-panel="Reminders"
        id="settings-panel-Reminders"
        aria-labelledby="settings-tab-Reminders"
        hidden={section !== "Reminders"}
      >
        <section className="settings-section">
          <h2>Task returns and daily review</h2>
          <div className="fields">
            <label>
              Default settlement mode
              <Select
                value={draft.settlement_mode}
                onChange={(e) => set("settlement_mode", e.target.value)}
              >
                <option value="next_day">Next calendar day</option>
                <option value="24h">Exactly 24 hours later</option>
              </Select>
            </label>
            <label>
              Preferred next-day time
              <DateTimeField
                type="time"
                required
                value={draft.return_time}
                onChange={(e) => set("return_time", e.target.value)}
              />
            </label>
            <label>
              Daily review time
              <DateTimeField
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
          <h2>Notifications and background behavior</h2>
          <div className="fields">
            <label>
              Quiet hours begin
              <DateTimeField
                type="time"
                required
                value={draft.quiet_start}
                onChange={(e) => set("quiet_start", e.target.value)}
              />
            </label>
            <label>
              Quiet hours end
              <DateTimeField
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
          <label className="check">
            <input
              type="checkbox"
              checked={draft.close_to_tray}
              onChange={(e) => set("close_to_tray", e.target.checked)}
            />
            Keep running in the tray when I close the window
          </label>
        </section>
      </div>
      <div
        role="tabpanel"
        data-settings-panel="Keyboard"
        id="settings-panel-Keyboard"
        aria-labelledby="settings-tab-Keyboard"
        hidden={section !== "Keyboard"}
      >
        <section className="settings-section">
          <h2>Keyboard</h2>
          <label>
            Command palette shortcut
            <Select
              value={draft.command_shortcut ?? "Ctrl+K"}
              onChange={(e) => set("command_shortcut", e.target.value)}
            >
              <option value="Ctrl+K">Ctrl+K</option>
              <option value="Ctrl+Shift+P">Ctrl+Shift+P</option>
            </Select>
          </label>
        </section>
      </div>
      {sections[section].some(
        (key) => JSON.stringify(draft[key]) !== JSON.stringify(baseline[key]),
      ) && (
        <div className="save-bar settings-save-bar">
          <button className="primary" disabled={busy}>
            Save preferences
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const values = Object.fromEntries(
                sections[section].map((key) => [key, settings[key]]),
              );
              setDraft((previous) => ({ ...previous, ...values }));
              setBaseline((previous) => ({ ...previous, ...values }));
              setSaved(false);
            }}
          >
            Discard changes
          </button>
          <span role="status">{busy ? "Saving…" : "Unsaved changes"}</span>
        </div>
      )}
      {saved && <p role="status">Preferences saved.</p>}
      {saveError && <p role="alert">{saveError}</p>}
      <div
        role="tabpanel"
        data-settings-panel="About"
        id="settings-panel-About"
        aria-labelledby="settings-tab-About"
        hidden={section !== "About"}
      >
        {isNightly(version) && (
          <details
            className="settings-section"
            onToggle={(e) => setDiagnosticsOpen(e.currentTarget.open)}
          >
            <summary>Advanced / Diagnostics</summary>
            {diagnosticsOpen && (
              <>
                <TestNotification />
                <Diagnostics />
              </>
            )}
          </details>
        )}
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
            <button type="button" onClick={() => onReleaseNotes("history")}>
              Release Notes history
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
