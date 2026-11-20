# Pass 2.5 — coordinated glass surfaces

## Research and comparison

Reviewed Apple's official [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
presentation transcript, especially Dynamics and the layers discussion: geometry,
illumination and depth work together. Reprise's previous `surfaceFrame` only scaled
and faded the entire element. Its press animation also scaled labels and icons.
The new implementation changes a material shell's rectangle and curvature while
revealing unscaled content through a matching clip. Lighting and shadow follow
that same spring state. CSS lighting approximates reflection; it is not lensing.

[Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
connects source controls to transient surfaces and retains compact rounded rectangles
for dense desktop controls. Reprise keeps its existing layout and final corner
geometry. Context menus have only an invocation point, so their small origin region
is an approximation, not a claimed source-button morph.

[Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
groups related actions, specifies presentation sources and recommends combined
custom-effect containers. Here, one bounded SVG silhouette connects closely related
time presets during a press. This is actual path geometry interpolation without
filter-based metaballs; the visual material remains an approximation. It does not
merge independent HWNDs or unrelated controls.

The [Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion)
calls for short, optional, cancelable feedback and more restrained pointer behavior.
The existing damping profiles and policy listeners remain in use. No increased bounce,
continuous shimmer, pointer-tracked gradients, new rendering engine or dependency.
The research comparison uses Apple's published descriptions; it is not a claim of
frame-matched visual equivalence with Apple's compositor.

## Implementation

- `morphSurface`: one temporary material shell copies the popup's computed recipe,
  including opaque/accessibility fallbacks. Bounds and corner radius interpolate
  from the measured source to the final popup, clamped to valid geometry. A second
  track clips content at its final size. Shell shadow/rim response shares the exact
  sampled progress. Existing popup placement, focus, keyboard handling and actions
  remain independent of animation completion.
- Spring tracks use the existing analytical position/velocity on reversal. Cleanup
  cancels all tracks, removes the shell and restores panel rendering. Reduced motion
  bypasses morphing. Closing surfaces remain inert immediately.
- Glass presses temporarily transfer their computed fill to a separate material
  skin behind the label. That skin flexes and changes its rim light; text, hit target
  and layout remain fixed. Release restores the original CSS material. Disabled and
  forced-color controls do not get this effect.
- Sidebar selection is still one existing selected fill, now with a small travel
  deformation and rim response. It is not a multi-surface union.
- Only neighboring time presets get a shared path during interaction. Resting styles,
  per-control boundaries and actions remain intact. Long gaps and wrapped rows skip it.
- Quick Capture uses a short clipped reveal with a transient inner rim, preserving
  immediate input focus. It has no source element in another native window and does
  not pretend to morph across windows.

## Prototype and limits

Storage-free development comparison: `?glass-motion-lab`. Toggle Surface fidelity
to compare the previous scale/fade behavior. It includes trigger-to-menu expansion,
two related controls joining/separating, and a press/release study. Reduced motion
is independently selectable.

`scripts/performance/glass-motion-prototype.mjs` runs the rendered Edge prototype;
artifacts are local under `artifacts/glass-motion/`. Checks include actual shell
geometry, unscaled content, thirty rapid reversals, no orphan shells/idle animations,
fixed press bounds and immediate reduced-motion dismissal. SVG path animation is
checked in the running engine, not inferred solely from CSS feature detection.

Actual geometry and SVG path interpolation are achievable in Chromium/WebView2.
Rounded clips, width/height/position changes and shadow painting are bounded but are
**not guaranteed compositor-only**. The transient shell has one backdrop blur at a
time: the content panel's blur is disabled while the shell is active. There is no
per-frame JavaScript layout reading or bitmap processing. These checks do not certify
GPU cost or native presented-frame timing on every machine.

No true optical refraction, Apple adaptive lensing, illumination-aware background
analysis, desktop content sampling, or native-window shape union is implemented.
Native Windows backdrops, glass settings, task data, notifications and updater behavior
are unchanged.

## Validation — 2026-11-20

- Production frontend and Tauri release/NSIS builds completed. All 235 frontend
  tests passed. No Rust logic changed; the release build compiled the existing Rust
  backend. The Rust unit suite was not rerun for this frontend-only pass.
- Prototype: thirty rapid reversals, unscaled text, constant press bounds, actual
  changing SVG path, real context-menu shell, reduced-motion bypass and zero idle
  animations/page errors. Midpoint, connected and pressed screenshots were inspected
  locally. This is an Edge prototype, distinct from the native checks below.
- Installed `3.4.5-nightly.20261120.2` successfully. The packaged WebView2 completed
  five repeated notification/dropdown cycles, rapid navigation and 48 requested
  combinations of four families, two appearance preferences, two material variants,
  and three tint levels (35/60/90). Pitch Black and Ashen White correctly retain
  fixed effective appearances. Every sampled popup settled unscaled and within the
  viewport. No page errors or long tasks were recorded. Motion Off left no animations.
  These are behavior/geometry checks, not a claim of frame-perfect optical fidelity.
- Native Quick Capture accepted a draft immediately without a focus click and hid
  on Escape after clearing the draft. No task was saved. Task-table fingerprint
  and SQLite integrity were unchanged; original visual preferences were restored.
- Sampled the installed process tree during the theme/popup workload and at idle.
  Active GPU busiest-owned-engine peak was 5.31%; this includes theme switching and
  diagnostics. A corrected eight-sample idle run averaged 0.32% whole-machine CPU
  (16 logical processors) and recorded zero on the owned GPU engine counters. This
  does not mean no GPU work exists. Shared DWM, subsecond peaks and presented frames
  are outside attribution. No controlled old/new performance comparison was made.
- Corrected the measurement helper to calculate per-PID CPU deltas. Its earlier
  aggregate lifetime-total method could report negative CPU when a child exited.
  Discard that earlier idle CPU result. New/exited process coverage is recorded;
  CPU spent by processes missing either interval endpoint is excluded.

Artifacts: `artifacts/glass-motion/`, `artifacts/motion/fidelity-installed.json`,
and `artifacts/glass/runtime/fidelity-*-process.json`. Real multi-monitor/mixed-DPI
validation and broad sustained-load GPU profiling remain untested. No Apple optical
renderer equivalence or universally regression-free GPU performance is claimed.
