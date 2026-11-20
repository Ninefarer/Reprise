# Appearance preferences — Pass 4

Theme selects color identity: Classic, Peach, Pitch Black and Ashen White.
Appearance mode and accent remain color preferences. Fixed dark/light families
retain their identity without replacing the saved mode used by Classic/Peach.
Selecting a theme never selects an aesthetic or motion style.

Aesthetic selects Solid or Glass. Solid uses opaque theme surfaces. Glass uses
the existing DWM Acrylic foundation, transparent WebView2 canvas and CSS recipes.
Acrylic is an implementation detail, not a user-facing material name. There is
no Mica or desktop refraction path.

Glass exposes Clear, Regular and Tinted. Clear and Regular recipes are unchanged,
including Pitch Black Clear 90% canvas alpha .74. Tinted promotes the internal
recipe into settings: in-app coverage .94/diffusion 22px; canvas coverage is
`min(.95, contrastFloor + .18 + tintProgress * .06)`. Existing theme contrast
floors and tint progress are unchanged. Tinted inactive coverage is
`min(.95, contrastFloor + .20)`. Regular's persisted identifier remains `acrylic`
for compatibility; it selects a CSS recipe, not another native rendering engine.

Motion reuses the existing preference/controller with labels Fluid (`expressive`),
Subtle (`subtle`) and Reduced (`off`). No spring retuning or task timing changes
are introduced. Windows animations Off, reduced-motion media and forced colors
still suppress motion even when Fluid is saved, without replacing the preference.

## Storage and migration

`Settings.aesthetic` is an optional serialized Solid/Glass enum. Missing/null
means legacy: `desktop_glass=true` resolves to Glass; false/missing to Solid.
Neither theme nor the older floating `material` setting participates in migration.
Reads do not rewrite storage. The next settings write serializes the resolved enum
and synchronizes the compatibility `desktop_glass` mirror. Explicit Aesthetic
values take precedence over the mirror. No task migration is needed.

`VisualPatch` accepts modern `aesthetic` and legacy `desktop_glass` requests;
either synchronizes both representations. Conflicting requests are rejected.
Full settings saves preserve appearance fields owned by the visual patch path.
Future aesthetics can extend the enum/renderer dispatch independently of palettes
and motion. Glass details remain saved while Solid hides their controls.

Settings order is Theme/mode/accent, Aesthetic, Glass options, Motion, then
density/backdrop/scrollbars and accessibility status. The redundant tint-preset
selector was removed; its only stored value was the percentage, still editable
through the slider. Motion's existing storage values are unchanged.

## Effective policy

`data-aesthetic` describes the saved selection; `data-desktop-glass` describes
native eligibility; `data-glass-variant` describes the recipe. Selected Glass can
temporarily render solid when effects are unsupported or accessibility requires
it. Settings explains the fallback and retains the saved choices. Technical
diagnostics remain in the existing native-error dataset.

Pass 3 response ordering, hidden Capture refresh, interruption, layout optimization
and accessibility fallbacks remain in place. No rendering loop, additional blur
pass, graphics dependency or shader was added.

## Validation

Frontend tests cover legacy mapping, canonical precedence, independent palette,
material/tint/motion changes, hidden/restored Glass controls and fallback status.
Rust tests cover legacy JSON, Store reconstruction, enum/mirror synchronization,
old-client patches, independent theme selection, Tinted and invalid/conflicting
values. Physical DPI, sleep/resume and live assistive-technology checks remain
the manual certification cases in [Pass 3 QA](PASS-3-QA.md).

### Recorded checks, 2026-11-20

- `npm test`: 245 passed, 27 files. `cargo test`: 64 passed, 2 opt-in probes
  ignored. `cargo fmt` and `cargo check` passed. Production TypeScript/Vite and
  Tauri release/NSIS packaging completed.
- Installed local Nightly `3.4.5-nightly.20261120.5`, installer exit 0. The same
  Tauri/WebView2 architecture and Windows environment as Pass 3 were used.
  Pre-existing Profile Card work remains in the working tree and local build;
  it is excluded from the Pass 4 commit.
- `appearance-installed.mjs`: 126 cases across all four themes, applicable
  appearance modes, Solid/Glass, three motion values, three Glass recipes and
  tint endpoints 35/90. No page exceptions. Actual settings controls exercised
  Solid/Glass and Tinted selection; reduced-motion override retained Fluid.
  Glass/Solid settings screenshots were inspected for layout and clipping.
- Native policy runner verified actual DWM type 3 for Clear, type 1 under
  emulated reduced transparency/high contrast and restoration to type 3.
  Its selected-navigation check now navigates Home first; Settings deliberately
  has no moving navigation marker and did not meet that test's old precondition.
  OS settings themselves were not changed.
- Actual app restart retained canonical Aesthetic, theme/mode, material, tint
  and motion. SQLite comparison confirmed identical task rows, integrity `ok`,
  and only the new `aesthetic` key added to the original settings.
- Installed release-build 120-cycle popup stress: renderer interval p95 6.2ms,
  max 18.1ms, zero long tasks/page errors/final animations. Nine overlapping PDH
  sample endpoints averaged 8.96% machine CPU; busiest owned GPU engine peak
  7.55%; owned private bytes peak 624.11MiB. Fresh-restart idle (8 samples)
  averaged .014% machine CPU, sampled owned GPU engine peak 0%, private bytes
  peak 266.69MiB. Raw reports use `appearance-stress`/`appearance-idle` labels.
  GPU counters measure utilization, not frame time. rAF measures renderer
  scheduling, not presented frames or input latency. These short single runs,
  different cache warmup and current user density/settings do not establish a
  statistical improvement over Pass 3; peak memory was higher during stress.
  Multi-hour retention and hardware certification remain manual.

The app was restarted normally after QA, with the original visual selections
and diagnostic port 9228 closed. No release, tag or remote push was created.
