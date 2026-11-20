# Motion pass

## Audit and implementation plan

Reprise uses React 19, Tauri 2 and Windows WebView2. Existing motion is CSS based;
there is no animation library. `motion.css` defines most timing tokens, but glass
controls add a second press transform, control popups override menu timing, context
menus close on a separate 90 ms timer, and notifications retain records for 320 ms.
Control popups disappear on unmount. Their measured anchor origins already account
for viewport clamping. Quick Capture remains mounted across native hide/show cycles.
Task completion already retains a noninteractive feedback row while persistence
finishes; this behavior must remain independent of presentation.

1. Add one analytical damped-spring controller with snappy, fluid, gentle and
   decisive profiles. Generate finite Web Animations keyframes for transforms and
   opacity. Retarget from the current position **and velocity**, without a frame
   loop, animation queue or rendering dependency.
2. Retain exiting selection surfaces and make them inert immediately. Reuse their
   anchor placement. Coordinate entry/exit through the same controller; preserve
   focus restoration and immediate menu actions. Reuse this presence primitive for
   the notification dock.
3. Give eligible buttons and summaries a single, delegated press response; preserve
   disabled behavior and focus outlines. Keep existing glass fills and lighting.
4. Add layout continuity for navigation selection and task rows. Measure only when
   layout changes, animate transforms, and keep task persistence immediate. Do not
   invent drag reordering or inline details where those interactions do not exist.
5. Notify Quick Capture on each native reveal, focus immediately, and coordinate a
   short exit with native hide. Cancel stale exits on a new reveal.
6. Centralize remaining CSS timings and settle motion when preferences change or
   windows deactivate. Windows animation preferences already feed the theme engine;
   also honor CSS reduced motion and the in-app Off setting.

## Boundaries and checks

No material/tint/backdrop calculations, settings schema, task lifecycle, scheduling,
installer hooks or updater behavior change. No new package is needed. Small spring
overshoot is reserved for expressive mode; subtle mode is critically damped.
Large surfaces use gentle, critically damped movement. Shadows remain attached to
their surface rather than running an independently rasterized animation.

WebView2 can composite finite transform/opacity animations. It cannot animate the
native HWND across hide/show, morph separate native windows into one surface, or
provide desktop optical refraction. Capture motion is confined to its existing
WebView content and must not defer keyboard focus or database writes. Layout changes
require a bounded measurement; notification grid collapse still performs layout.

Validation will cover unit lifecycle/race tests, frontend and Rust checks, rendered
rapid reversals, keyboard focus, task actions, theme/material preservation and
reduced motion. A locally installed Nightly will be tested separately from browser
checks. Record actual measurements and untested hardware cases below; do not infer
native presentation performance from browser animation-frame timing alone.

## Implementation and validation status — 2026-11-20

Implemented the shared analytical controller, reversible selection-popup presence,
context-menu dismissal, notification-dock presence, delegated tactile controls,
moving sidebar selection fill, task-row FLIP and inert exit snapshots, and task
dialog entrance/exit. Quick Capture now receives `capture-shown` for each native
reveal and cancels stale hides. Capture sizing uses untransformed layout height.
Closing inert shields no longer block subsequent notification keyboard shortcuts.
Glass changes in this pass only remove competing motion declarations; material
colors, coverage, blur, tint calculations and native backdrops are unchanged.

The less frequent native `<details>` profile menu and other dialogs retain their
centralized CSS entrance treatment and existing close lifecycle. They do not yet
have the spring exit lifecycle used by selection popups and task details. Task
reordering is not an existing interaction; this pass does not add one. FLIP retargets
from the current visual position; velocity preservation specifically applies to the
analytical surface/press/selection controllers, not task-layout snapshots.

Verified before installation: production frontend build; frontend regression suite;
Rust formatting, `cargo check`, and Rust tests (63 passed, two manual probes ignored).
Added analytical continuity, stale completion, reduced-motion, popup focus, disabled
control, capture hide/reveal race, task layout/snapshot and navigation-scope checks.
The existing glass prototype script also completed successfully after these changes.

The installed **previous** Nightly (`3.4.5-nightly.20261119.3`) completed five
notification/popup cycles and rapid navigation with zero remaining animations and
no page errors. Renderer frame-interval sampling is in `artifacts/motion/baseline.json`;
it measures scheduling rather than presented frames. Earlier harness attempts failed
because of disclosure/focus state and clicks during surface entry; those attempts
are not successful validation. Process samples collected during harness development
do not constitute a controlled before/after benchmark.

Local installer: `artifacts/nightly-motion-3.4.5-nightly.20261120.1/`.
Installation is currently waiting for the Windows administrator consent prompt.
The installed executable remains the previous glass build until consent succeeds.
Installed motion validation, CPU/GPU comparison, native capture responsiveness,
resize/restore and the theme/material matrix therefore remain **pending**. Do not
describe this pass as visually or performance certified. Real mixed-DPI/multi-monitor
coverage is also pending. Clear and Regular are the saved desktop-material variants;
there is no separate Tinted selector to test without changing the completed glass
system. Strong tint settings should be included in the installed matrix.

A SQLite backup was made before installation. The original task table contains one
record; its fingerprint and integrity check are saved locally in
`artifacts/motion/before-data.json`. Runtime scripts avoid task mutations and restore
the original visual preferences in `finally`. No release has been pushed or published.
