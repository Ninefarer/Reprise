import { Select } from "./Select";
import type { Settings, Snapshot, VisualPreferences } from "./model";
import { visualPreferences } from "./visuals";
export function AppearanceSettings({
  settings,
  system,
  surfaceFallback,
  onChange,
}: {
  settings: Settings;
  system?: Snapshot["system_visuals"];
  surfaceFallback?: string;
  onChange: (patch: Partial<VisualPreferences>) => Promise<void>;
}) {
  const v = visualPreferences(settings);
  return (
    <>
      <section className="settings-section" id="appearance-section">
        <h3>Theme and controls</h3>
        <div className="fields">
          <label>
            Theme
            <Select
              value={v.theme_family}
              onChange={(e) =>
                void onChange({
                  theme_family: e.target
                    .value as VisualPreferences["theme_family"],
                })
              }
            >
              <option value="classic">Reprise Classic</option>
              <option value="peach">Peach</option>
              <option value="pitch-black">Pitch Black</option>
              <option value="ashen-white">Ashen White</option>
            </Select>
          </label>
        </div>
        <div className="fields">
          <label>
            Accent color
            <Select
              value={v.accent}
              onChange={(e) =>
                void onChange({
                  accent: e.target.value as VisualPreferences["accent"],
                })
              }
            >
              <option value="theme">
                Theme default (
                {v.theme_family === "classic"
                  ? "Sage"
                  : v.theme_family === "peach"
                    ? "Peach"
                    : "Neutral"}
                )
              </option>
              <option value="lavender">Lavender</option>
              <option value="sage">Sage</option>
              <option value="icy-blue">Icy Blue</option>
              <option value="rose">Rose</option>
              <option value="neutral">Neutral</option>
            </Select>
          </label>
        </div>
        <div className="fields">
          <label>
            Aesthetic
            <Select
              value={v.aesthetic}
              onChange={(e) =>
                void onChange({
                  aesthetic: e.target.value as VisualPreferences["aesthetic"],
                })
              }
            >
              <option value="solid">Solid</option>
              <option value="glass">Glass</option>
            </Select>
          </label>
          {v.aesthetic === "glass" && (
            <label>
              Glass material
              <Select
                value={v.desktop_material}
                onChange={(e) =>
                  void onChange({
                    desktop_material: e.target
                      .value as VisualPreferences["desktop_material"],
                  })
                }
              >
                <option value="clear">Clear</option>
                <option value="acrylic">Regular</option>
                <option value="tinted">Tinted</option>
              </Select>
            </label>
          )}
        </div>
        {v.aesthetic === "glass" && (
          <>
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
          </>
        )}

        {v.aesthetic === "glass" && surfaceFallback && (
          <p className="hint" role="status">
            Windows is using a solid surface.
          </p>
        )}
        <div className="fields">
          <label>
            Motion
            <Select
              value={v.animation}
              onChange={(e) =>
                void onChange({
                  animation: e.target.value as VisualPreferences["animation"],
                })
              }
            >
              <option value="off">Reduced</option>
              <option value="subtle">Subtle</option>
              <option value="expressive">Fluid</option>
            </Select>
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
            <Select
              value={v.density}
              onChange={(e) =>
                void onChange({
                  density: e.target.value as VisualPreferences["density"],
                })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </label>
          <label>
            Modal backdrop
            <Select
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
            </Select>
          </label>
          <label>
            Scrollbars
            <Select
              value={v.scrollbars}
              onChange={(e) =>
                void onChange({
                  scrollbars: e.target.value as VisualPreferences["scrollbars"],
                })
              }
            >
              <option value="system">Follow Windows</option>
              <option value="always">Always visible</option>
            </Select>
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
