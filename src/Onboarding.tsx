import { useEffect, useRef, useState } from "react";
import type { Settings, VisualPreferences } from "./model";
import { AvatarEditor } from "./Profile";
import "./onboarding.css";

/** Setup edits preferences only. Replaying it never resets the database or onboarded flag. */
export function Onboarding({
  settings,
  avatar,
  nightlyVersion,
  replay,
  busy,
  error,
  onRefresh,
  onVisual,
  onFinish,
  onCancel,
}: {
  settings: Settings;
  avatar?: string | null;
  nightlyVersion?: string;
  replay: boolean;
  busy: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onVisual: (patch: Partial<VisualPreferences>) => Promise<void>;
  onFinish: (patch: Partial<Settings>, title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (stepTimer.current) clearTimeout(stepTimer.current);
    },
    [],
  );
  function changeStep(next: number) {
    if (leaving) return;
    const reduced =
      document.documentElement.dataset.motion === "off" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || document.visibilityState === "hidden") {
      setStep(next);
      return;
    }
    setLeaving(true);
    stepTimer.current = setTimeout(() => {
      setStep(next);
      setLeaving(false);
      stepTimer.current = null;
    }, 140);
  }
  const [draft, setDraft] = useState(() => ({
    name: settings.name,
    workspace: settings.workspace,
    settlement_mode: settings.settlement_mode,
    return_time: settings.return_time,
    daily_review: settings.daily_review,
    review_time: settings.review_time,
    notifications: settings.notifications,
    quiet_start: settings.quiet_start,
    quiet_end: settings.quiet_end,
  }));
  const [title, setTitle] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const set = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  async function finish(skip = false) {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await onFinish(skip ? {} : draft, skip ? "" : title.trim());
    } finally {
      submitting.current = false;
    }
  }
  return (
    <main className={`setup-screen${nightlyVersion ? " setup-nightly" : ""}`}>
      <div className="setup-shell">
        <header className="setup-progress">
          {!nightlyVersion && <span>Reprise</span>}
          <span aria-label={`Step ${step + 1} of 3`}>{step + 1} / 3</span>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) changeStep(step + 1);
            else void finish();
          }}
          aria-busy={busy}
        >
          <fieldset disabled={busy || leaving} className="setup-fields">
            <section
              key={step}
              className={`setup-step${leaving ? " setup-leaving" : ""}`}
              aria-labelledby="setup-title"
            >
              <h1 ref={heading} tabIndex={-1} id="setup-title">
                {
                  [
                    "A little space for your intentions.",
                    "Let later have a time.",
                    "Start with one thing.",
                  ][step]
                }
              </h1>
              <p className="setup-intro">
                {
                  [
                    "Make yourself at home. You can change all of this later.",
                    "Choose how Reprise helps you return, without rushing you.",
                    "Capture something for later. No dates or priorities needed.",
                  ][step]
                }
              </p>
              {step === 0 ? (
                <>
                  <AvatarEditor
                    avatar={avatar}
                    name={draft.name}
                    onSaved={onRefresh}
                  />
                  <div className="fields">
                    <label>
                      Display name
                      <input
                        autoComplete="given-name"
                        maxLength={100}
                        value={draft.name}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </label>
                    <label>
                      Space name
                      <input
                        maxLength={120}
                        placeholder="Personal"
                        value={draft.workspace}
                        onChange={(e) => set("workspace", e.target.value)}
                      />
                    </label>
                    <label>
                      Theme
                      <select
                        value={settings.theme_family ?? "classic"}
                        onChange={(e) =>
                          void onVisual({
                            theme_family: e.target
                              .value as VisualPreferences["theme_family"],
                          })
                        }
                      >
                        <option value="classic">Reprise Classic</option>
                        <option value="pitch-black">Pitch Black</option>
                        <option value="ashen-white">Ashen White</option>
                      </select>
                    </label>
                    {(settings.theme_family ?? "classic") === "classic" && (
                      <label>
                        Appearance mode
                        <select
                          value={settings.theme}
                          onChange={(e) =>
                            void onVisual({
                              theme: e.target.value as Settings["theme"],
                            })
                          }
                        >
                          <option value="system">
                            System — follow Windows
                          </option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </label>
                    )}
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="fields">
                    <label>
                      Settled tasks return
                      <select
                        value={draft.settlement_mode}
                        onChange={(e) => set("settlement_mode", e.target.value)}
                      >
                        <option value="next_day">The following day</option>
                        <option value="24h">Exactly 24 hours later</option>
                      </select>
                    </label>
                    {draft.settlement_mode === "next_day" && (
                      <label>
                        Preferred return time
                        <input
                          type="time"
                          required
                          value={draft.return_time}
                          onChange={(e) => set("return_time", e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.notifications}
                      onChange={(e) => set("notifications", e.target.checked)}
                    />
                    Windows notifications
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.daily_review}
                      onChange={(e) => set("daily_review", e.target.checked)}
                    />
                    A daily moment to review
                  </label>
                  <div className="fields">
                    {draft.daily_review && (
                      <label>
                        Daily review time
                        <input
                          type="time"
                          required
                          value={draft.review_time}
                          onChange={(e) => set("review_time", e.target.value)}
                        />
                      </label>
                    )}
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
                </>
              ) : (
                <>
                  <label>
                    Your first intention
                    <input
                      maxLength={500}
                      placeholder="What would you like to come back to?"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <p className="hint">
                    {title.trim()
                      ? "This will be saved to Inbox when you open Reprise."
                      : "You can leave this blank and capture something later."}
                  </p>
                </>
              )}
            </section>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <footer className="setup-actions">
              <button
                type="button"
                onClick={() => (replay ? onCancel() : void finish(true))}
              >
                {replay ? "Cancel setup" : "Skip setup"}
              </button>
              <div>
                {step > 0 && (
                  <button type="button" onClick={() => changeStep(step - 1)}>
                    Back
                  </button>
                )}
                <button className="primary" type="submit">
                  {busy ? "Saving…" : step < 2 ? "Continue →" : "Open Reprise"}
                </button>
              </div>
            </footer>
          </fieldset>
        </form>
      </div>
    </main>
  );
}

export function RedoOnboardingDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
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
      className="task-dialog material-floating"
      aria-labelledby="redo-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="delete-content">
        <h2 id="redo-title">Go through setup again?</h2>
        <p>
          Your tasks, history, notifications, and saved preferences will stay.
          Setup starts with your current preferences; only changes you choose
          will be saved. Picture and theme changes apply immediately.
        </p>
        <div className="dialog-actions">
          <button autoFocus onClick={onCancel}>
            Keep working
          </button>
          <button className="primary" onClick={onConfirm}>
            Redo onboarding
          </button>
        </div>
      </div>
    </dialog>
  );
}
