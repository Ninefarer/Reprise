import type { Settings, Snapshot, VisualPreferences } from "./model";
import { visualPreferences } from "./visuals";
export function AppearanceSettings({
  settings,
  system,
  onChange,
}: {
  settings: Settings;
  system?: Snapshot["system_visuals"];
  onChange: (patch: Partial<VisualPreferences>) => Promise<void>;
}) {
  const v = visualPreferences(settings),
    fixed = v.theme_family !== "classic";
  return (
    <>
      <section className="settings-section" id="appearance-section">
        <h2>Appearance</h2>
        <div className="fields">
          <label>
            Window appearance
            <select
              value={v.desktop_glass ? "glass" : "default"}
              onChange={(e) =>
                void onChange({ desktop_glass: e.target.value === "glass" })
              }
            >
              <option value="default">Default (opaque)</option>
              <option value="glass">Glass (native Windows transparency)</option>
            </select>
          </label>
          {v.desktop_glass && (
            <label>
              Glass material
              <select
                value={v.desktop_material}
                onChange={(e) =>
                  void onChange({
                    desktop_material: e.target.value as "clear" | "acrylic",
                  })
                }
              >
                <option value="clear">Clear</option>
                <option value="acrylic">Acrylic</option>
              </select>
            </label>
          )}
        </div>
        {v.desktop_glass && (
          <>
            <label>
              Glass intensity
              <select
                value={
                  v.desktop_tint === 82
                    ? "subtle"
                    : v.desktop_tint === 60
                      ? "balanced"
                      : v.desktop_tint === 38
                        ? "crystal"
                        : "custom"
                }
                onChange={(e) =>
                  void onChange({
                    desktop_tint:
                      (
                        { subtle: 82, balanced: 60, crystal: 38 } as Record<
                          string,
                          number
                        >
                      )[e.target.value] ?? v.desktop_tint,
                  })
                }
              >
                <option value="subtle">Subtle</option>
                <option value="balanced">Balanced</option>
                <option value="crystal">Crystal</option>
                <option value="custom" disabled>
                  Custom tint
                </option>
              </select>
            </label>
            <label>
              Glass tint: {v.desktop_tint}%
              <input
                type="range"
                min="35"
                max="90"
                value={v.desktop_tint}
                onChange={(e) =>
                  void onChange({ desktop_tint: Number(e.target.value) })
                }
              />
            </label>
            <p className="hint">
              Background tint only; Windows controls Acrylic blur. High contrast
              and reduced transparency use opaque surfaces.
            </p>
          </>
        )}

        <div className="fields">
          <label>
            Theme
            <select
              value={v.theme_family}
              onChange={(e) =>
                void onChange({
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
          <label>
            Appearance mode
            {fixed ? (
              <input
                readOnly
                value={
                  v.theme_family === "pitch-black"
                    ? "Dark — fixed by Pitch Black"
                    : "Light — fixed by Ashen White"
                }
              />
            ) : (
              <select
                value={v.theme}
                onChange={(e) =>
                  void onChange({
                    theme: e.target.value as VisualPreferences["theme"],
                  })
                }
              >
                <option value="system">System — follow Windows</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            )}
          </label>
        </div>
        {fixed && (
          <p className="hint">
            This family has a fixed appearance. Your saved Classic preference (
            {v.theme}) is retained and will return with Reprise Classic.
          </p>
        )}
        <div className="fields">
          <label>
            Accent color
            <select
              value={v.accent}
              onChange={(e) =>
                void onChange({
                  accent: e.target.value as VisualPreferences["accent"],
                })
              }
            >
              <option value="theme">
                Theme default (
                {v.theme_family === "classic" ? "Sage" : "Neutral"})
              </option>
              <option value="lavender">Lavender</option>
              <option value="sage">Sage</option>
              <option value="icy-blue">Icy Blue</option>
              <option value="rose">Rose</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <label>
            Animation
            <select
              value={v.animation}
              onChange={(e) =>
                void onChange({
                  animation: e.target.value as VisualPreferences["animation"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="expressive">Expressive</option>
            </select>
          </label>
        </div>
        <p className="hint">
          Accents highlight controls; task colors keep their meaning. Windows
          reduced-motion preferences take priority without changing your
          selection.
        </p>
        {system?.animations_enabled === false && (
          <p className="hint">
            Windows animations are off. Your saved animation preference is
            retained.
          </p>
        )}
        <div className="fields">
          <label>
            Density
            <select
              value={v.density}
              onChange={(e) =>
                void onChange({
                  density: e.target.value as VisualPreferences["density"],
                })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label>
            Modal backdrop
            <select
              value={v.modal_backdrop}
              onChange={(e) =>
                void onChange({
                  modal_backdrop: e.target
                    .value as VisualPreferences["modal_backdrop"],
                })
              }
            >
              <option value="dim">Dim</option>
              <option value="blur">Dim and blur</option>
              <option value="none">None</option>
            </select>
          </label>
          <label>
            Scrollbars
            <select
              value={v.scrollbars}
              onChange={(e) =>
                void onChange({
                  scrollbars: e.target.value as VisualPreferences["scrollbars"],
                })
              }
            >
              <option value="system">Follow Windows</option>
              <option value="always">Always visible</option>
            </select>
          </label>
        </div>
        {system?.advanced_effects === false && (
          <p className="hint">
            Windows has disabled advanced effects. Solid surfaces are active;
            your appearance preference is retained.
          </p>
        )}
      </section>
    </>
  );
}
