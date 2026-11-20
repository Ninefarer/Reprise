# Glass material audit and implementation plan

This is a historical implementation/validation record. The later Clear/90% regression
and current Nightly .3 material contract are documented in
[the installed transparency investigation](GLASS-TRANSPARENCY-REGRESSION.md).

## Architecture and diagnosis

Reprise uses React 19, TypeScript and Vite inside Tauri 2 / Windows WebView2.
Rust `visuals.rs` applies native window effects; `theme.ts` synchronizes theme,
focus, Windows animation/effects preferences and native readiness. SQLite owns
preferences. CSS owns in-app paint and finite event-driven motion. No WinUI,
Win2D, custom Direct3D renderer or shared Composition visual tree is present.

Before the overhaul, Clear cleared all native effects, made the native window transparent,
and paints a pane at `desktop_tint * .58` (light: `.48`). At minimum tint this
is only 20.3% / 16.8% coverage, with no desktop diffusion. Acrylic enables the
Tauri effect but shares the same CSS. Neither setting describes a coherent
optical material. Cards currently receive reflections as well as navigation.

Affected surfaces: app shell, sidebar, Quick Capture, task/overview cards,
settings, inputs, notification dock/notices, ControlPopup (Select and date/time),
PopupMenu (task/text menus), profile footer menu, command palette and all
`material-floating` dialogs. Profile-card artwork and styling remain independent.

Classic inherits green-neutral light/dark surface RGB; Peach uses warm RGB and
follows appearance; Pitch Black fixes dark neutral; Ashen White fixes light
neutral. Accent/semantic task colors remain separate. Material must consume
these family tokens, never replace them with one universal glass color.

## Research and rendering choice

Apple distinguishes an elevated navigation/control layer from content, discourages
nested glass, and uses geometry, light, shadows and continuity together. Its Clear
variant has restricted media use and is not automatically adaptive. Reprise needs
a more conservative Clear floor for dense desktop text, rather than literal parity.
SwiftUI Glass/GlassEffectContainer are Apple-only APIs, not reusable renderers.

Use native desktop diffusion plus CSS surface lighting/edges and finite transform
motion. CSS backdrop-filter samples only WebView content. It cannot refract or
sample pixels behind the HWND. Do not claim real refraction, wallpaper luminance
adaptation, caustics, adaptive shadows or true shape union. Theme-dependent tint
and bounded coverage provide conservative contrast without reading desktop pixels.
Related controls use a shared surface and anchored expansion instead of metaballs.

Mica is a wallpaper-derived base; Desktop Acrylic is a live desktop backdrop.
Documented DWM system backdrops require Windows 11 build 22621. Tauri's existing
WindowEffect::Acrylic implementation must be audited before relying on it: the
window-vibrancy Windows implementation may use legacy undocumented accent APIs.
For new desktop diffusion use documented DwmSetWindowAttribute, with solid fallback.
DirectComposition/Windows Composition could own separate native visuals, but cannot
directly apply SwiftUI-like effects to the existing DOM. Direct2D/Win2D effect graphs
and D3D shaders require a separate render/interoperability path and source textures;
they do not grant arbitrary desktop sampling. That cost is unjustified here.

## Prototype and rollout gate

1. Build a development-only `?glass-lab` entry using the real Select/ControlPopup,
   shared material CSS, bright/dark stress backgrounds, Clear/Regular/Tinted,
   resting/hover/press, reversible disclosure, solid/reduced-motion modes and themes.
   It must not load the task app or invoke storage commands.
2. Check computed material floors, keyboard selection/Escape/focus, popup placement,
   reduced modes and screenshots. Compare against the legacy alpha-only sample.
3. Only after prototype checks pass, integrate eligible navigation/overlays. Keep
   lists/cards/settings dense and stable. Preserve stored `clear`/`acrylic` values;
   present Acrylic as Regular and existing high tint as Tinted (no schema migration).
4. Run frontend build/tests, Rust fmt/check/tests. Native acceptance additionally
   needs high-contrast desktop wallpaper, active/inactive, resize/minimize/restore,
   Quick Capture, notification lifecycle, multiple DPI and GPU/frame-time checks.
   Web screenshots cannot satisfy desktop-composition or performance acceptance.

## Performance and fallbacks

One desktop compositor backdrop per window; no capture, bitmap processing, pointer
loop, full-window distortion or new runtime dependency. Only elevated overlays
request in-app blur; dense children do not each blur. No permanent will-change.
Hover/press use short CSS transitions; expansion uses measured anchor origin.
Reduced effects/transparency, increased contrast, forced colors, inactive windows,
and OS/user reduced motion override material and motion. Unsupported native effects
must restore the theme-matched opaque window. Keep geometry in CSS logical pixels.

## References consulted (2026-11-19)

- [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [WWDC25 219](https://developer.apple.com/videos/play/wwdc2025/219/)
- [WWDC25 356](https://developer.apple.com/videos/play/wwdc2025/356/)
- [Glass](https://developer.apple.com/documentation/swiftui/glass)
- [GlassEffectContainer](https://developer.apple.com/documentation/swiftui/GlassEffectContainer)
- [Windows materials](https://learn.microsoft.com/en-us/windows/apps/develop/ui/materials)
- [System backdrops](https://learn.microsoft.com/en-us/windows/apps/develop/ui/system-backdrops)
- [In-app Acrylic](https://learn.microsoft.com/en-us/windows/apps/develop/ui/in-app-acrylic)
- [Visual layer](https://learn.microsoft.com/en-us/windows/apps/develop/composition/visual-layer)
- [Effects](https://learn.microsoft.com/en-us/windows/apps/develop/composition/composition-effects)
- [Animations](https://learn.microsoft.com/en-us/windows/apps/develop/composition/composition-animation)
- [Relation animations](https://learn.microsoft.com/en-us/windows/apps/develop/composition/relation-animations)
- [DWM backdrop types](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type)

Apple's JavaScript documentation was also read through its official Markdown
endpoints. Microsoft pages displayed an authorization banner but exposed article text.

## Implementation and validation

The in-app prototype gate passed before selective replacement. Edge 157 generated
eight theme/appearance screenshots plus expanded, solid and forced-color states.
Inspected Classic dark and Ashen White light screenshots show diffused surfaces
where legacy Clear leaves sharp stripes through labels. Keyboard selection,
Escape focus restoration, expansion inert state, solid/reduced motion and forced
colors pass. Artifacts are in `artifacts/glass` (ignored). Run `npm run dev`, open
`/?glass-lab` for the development-only, storage-free harness. The automated script
starts/stops Vite and takes a Playwright module path, without a runtime dependency.

Integration uses documented DWM Acrylic for both stored variants, never the legacy
accent fallback. Clear coverage has a floor; Regular and high-tint Tinted have
different diffusion/lighting recipes. Reading areas remain stable. Portaled menus
share the recipe and measured anchor origins connect entry to their triggers.
Nested controls use solid fills. Accessibility media changes reapply native policy.

A separate `com.reprise.glass.qa.20261119` synthetic profile was launched. Observed
native Clear/Regular, settings navigation, keyboard material selection,
maximize/restore, Quick Capture and the empty notification dock. Dock inspection
exposed underlying text bleed; restored one bounded 24px blur and raised coverage
to .96. The normal profile was not opened. QA files/profile remain local only.
The corrected dock was rechecked natively; underlying text no longer bleeds through.
QA application and development servers were stopped after verification.

Validation: production TypeScript/Vite build; 223 frontend tests; cargo fmt --check;
cargo check; 63 Rust tests passed, two existing manual tests ignored.

At the end of the first phase, remaining native acceptance included controlled high-contrast desktop wallpaper, multiple
DPI/monitor configurations, minimize/restore, timed notification delivery/lifetime,
and measured GPU/frame-time during resizing. No desktop refraction, sampled
luminance adaptation, true shape union or matched-geometry morphing is implemented.
Popup entry is anchored; dismissal remains immediate to preserve focus/lifecycle.
The prototype disclosure demonstrates reversible geometry; this does not mean all
existing popups morph. No pointer tracking, decorative loops or bitmap processing
was added. This is an integrated candidate pending that acceptance matrix, not a
certified performance or optical-parity result.

## Second phase: controlled native validation

Tested 2026-11-19 (local; raw files use UTC). Windows 11 Home build 26300,
NVIDIA RTX 4060, driver 32.0.16.1088, one 1920×1080 display at 165 Hz, 100% DPI.
Tauri debug build, WebView2 157, Classic theme, Clear at minimum 35% tint.
All task/settings writes used the separate synthetic QA profile. The normal
Reprise profile and Windows wallpaper/accessibility settings were not changed.

An ordinary opaque test HWND provided white, near-black and 64px black/white
checkerboard backgrounds **behind** the native Reprise window. These are controlled
behind-window stress surfaces, not a changed wallpaper or a screen-capture effect.
Observed light/dark appearances, task text, settings, popup keyboard navigation,
command palette/Escape, notification dock, Quick Capture creation/save (two tasks
persisted), native width resizing, maximize/restore and minimize/relaunch restore.
The final dark material was rechecked over all three backgrounds after fixes.
Native screenshots were inspected in the computer-use results; the saved PNGs
in `artifacts/glass` remain the browser prototype images, not native evidence.

### Defects fixed

- Root-level material scope did not match descendant-only inactive/reduced-effects/
  motion-off selectors. Corrected selectors and verified native off response `0`
  and inactive coverage `.96`. Browser regression checks exercise the native root.
- Shell tint beneath sidebar tint compounded Clear above 96% effective coverage.
  Removed the duplicate pane layer. Content remains .98 coverage; navigation has
  one bounded tint, Regular .90 and Tinted .96. Clear's minimum is .86.
- Removing duplicate tint exposed faint small sidebar labels on a white backdrop.
  Navigation now uses theme text ink for secondary labels and a restrained 4%
  broad reflection. Semantic task/accent colors retain their existing rules.
- Showing/focusing an iconified HWND did not restore it. Dashboard requests now
  unminimize before showing/focusing. Native minimize followed by a second-instance
  launch restored the rebuilt QA window successfully.

### Measurements and their limits

Read-only CDP instrumentation sampled rAF intervals, long tasks and Event Timing.
It ran only during each explicit sample and disconnected observers afterward.
PDH GPU counters and process-tree CPU/private bytes were sampled separately.
No production animation loop, telemetry or graphics dependency was added.

| Renderer sample | Duration | p95 interval | Maximum | Gaps >25ms | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Opaque, light idle | 10s | 6.2ms | 7.1ms | 0 | 0 |
| Clear, light idle (matched pilot) | 10s | 6.2ms | 7.3ms | 0 | 0 |
| Clear, final dark contrast recheck | 10s | 6.2ms | 7.4ms | 0 | 0 |
| Clear, palette/keyboard/overlays | 30s | 6.2ms | 8.0ms | 0 | 0 |
| Clear, verified native maximize/restore | 30s | 6.2ms | 12.1ms | 0 | 0 |

Verified resize history records 802×800 → 1920×1057 → 802×800 within the final
sample. Separate right-edge drags checked responsive settings at approximately
900px and 800px widths. The earlier `clear-resize` pilot had no recorded resize
events and is **not** used as evidence of resizing frame performance.
Recorded Event Timing entries above its 16ms reporting threshold reached 24ms;
this is neither end-to-end input latency nor a claim about unreported events.

| Process sample | Weighted mean CPU, whole machine (16 logical processors) | Peak CPU | Peak private bytes | Busiest owned GPU engine peak |
| --- | ---: | ---: | ---: | ---: |
| Opaque idle, 5 samples | .059% | .097% | 330.1 MiB | reported 0% |
| Clear idle, 5 samples | .311% | .513% | 328.5 MiB | reported 0% |
| Clear interactions, 20 samples | .586% | 5.165% | 375.1 MiB | 2.975% |

These short debug-build pilots include instrumentation and settling; they are
not a statistical release benchmark. Raw intervals include PDH query overhead,
and means are weighted by actual interval duration. Idle GPU zero means the
counter reported zero during those intervals, **not** that Acrylic has no GPU cost.
Shared DWM utilization was roughly 8.5–11.7% in these runs, with other applications
running; it cannot be attributed to Reprise or compared as Reprise-only GPU cost.
The renderer's scheduling is not a DWM presentation/frame-drop measurement.
The initial `clear-final-idle-process.json` overlapped a setting change and is
discarded; use `clear-stable-process.json` and `opaque-stable-process.json`.

Raw JSON: `artifacts/glass/runtime/`. Reproduction helpers:
`scripts/performance/measure-glass-native.mjs <label> [2–30 seconds]` attaches only
to the local QA target on port 9227; `measure-glass-process.ps1 -Label <label>
-Seconds <sample count>` requires exactly one window titled Reprise Glass QA.
`GlassBackdrop.cs` is a test-only WinForms background, not part of Reprise:
compile with PowerShell `Add-Type -Path scripts/performance/GlassBackdrop.cs
-ReferencedAssemblies System.Windows.Forms,System.Drawing -OutputType WindowsApplication
-OutputAssembly artifacts/glass/GlassBackdrop.exe`. Launch it behind the isolated
QA app. Its normal full-screen bounds avoid automation restoring a maximized test
window to a tiny normal size. It never changes desktop settings or captures pixels.

Remaining acceptance: actual alternate wallpapers, physical DPI/monitor changes
(only 100%/one display available), timed native notifications, a longer resource
soak and release-build presentation tracing with compositor/GPU attribution.
No persistent visual defect remained in the inspected native states after fixes;
the broader matrix and GPU certification remain open. No genuine optical
refraction, luminance sampling or shape union is claimed.
