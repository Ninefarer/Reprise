# Pass 3 — final polish and verification

Date: 2026-11-20. Branch: `develop`. Scope: the existing glass/motion system;
no redesign, new rendering framework, refraction implementation or release publication.
Current maintenance reference: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## Audit and fixes

Reviewed native appearance/backdrop policy, WebView2 transparency, theme/tint
recipes, CSS and spring ownership, anchored geometry shells, connected controls,
navigation/task layout motion, capture presence, dialogs, pickers and notifications.
Task/scheduler/storage/update behavior was exercised rather than rewritten.

| Confirmed defect                                                                                                                                                             | Focused correction and evidence                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A settled popup reused its original geometry/material when closing after content or theme changes. A regression reproduced 180px closing geometry for a resized 270px popup. | Dispose settled morph snapshots; rebuild each leg from current bounds/material. Settle active snapshots on content resize. Unit regression and rendered growing-month picker checks pass. Active reversals retain the same controller.                                                                         |
| Delayed native-glass IPC could restore Clear after a newer accessibility request disabled it.                                                                                | Latest-request revision guard covers success and failure. Deferred-response regression failed before correction and passes afterward.                                                                                                                                                                          |
| Connected rims/surface snapshots could outlive media/theme or layout changes.                                                                                                | Shared policy observation settles transient animation; connected SVG clears on policy/scroll/resize, with listener cleanup tests. Forced colors bypass spatial motion.                                                                                                                                         |
| Task FLIP measured every unrelated application render.                                                                                                                       | Measure on task/view/search/feedback changes; settle/clear positions on resize. Regression confirms unrelated renders cause no additional bounds reads.                                                                                                                                                        |
| Quick Capture animated a shadow captured at mount, potentially carrying a previous theme's lighting.                                                                         | Current material CSS owns the shadow; remove the cached animation layer. Existing capture interruption/focus tests pass.                                                                                                                                                                                       |
| Installed hidden Capture retained the previous theme because its worker refresh was correctly suspended.                                                                     | A targeted `visual-refresh` loads Capture's existing settings-only snapshot without enabling hidden task polling. Installed .3 reproduced stale Pitch Black after selecting Ashen White; .4 synchronizes before the checked reveal. Frontend regression also verifies worker suspension and listener disposal. |
| Forced-colors selected navigation could receive a Chromium text backplate that hid its label.                                                                                | Selected button and descendants share system Highlight/HighlightText. Rendered .4 screenshot shows the label again; native policy runner checks the descendant palette.                                                                                                                                        |

Removed unused `--material-response`/`--press-distance` definitions and CSS
entrance/exit keyframes superseded by JS presence. Retained live settings/menu
aliases and fallback animations. No canvas alpha, material coverage, native
backdrop recipe or task-state rule changed in this pass.

## Builds and environment

Actual installed `C:\Program Files\Reprise Nightly\reprise.exe` was tested,
not just Vite. .2 is the pre-polish reference; .3 contains the initial fixes;
**3.4.5-nightly.20261120.4** contains the final Capture/forced-colors fixes and is
the installed result. The local NSIS update completed with exit 0. Installation
was per-machine, as configured; updater signature verification remains enabled.
Only generation of signed updater artifacts was disabled in the untracked local
build config because this local test does not publish an update feed.

Builds include pre-existing uncommitted Profile Card work already in this working
tree. Those files/dependency changes are excluded from the Pass 3 commit. They
were not reset, rewritten or bundled into a remote release.

Host: Windows 11 Home build 26300, 16 logical processors, NVIDIA RTX 4060 driver
32.0.16.1088; 1920×1080, 100% system scaling, renderer cadence approximately
165Hz. Installed WebView2 runtime: 157.0.4341.60. Tauri release compilation and
Vite production assets were packaged into NSIS. Debug build samples are not
used in the following production comparison.

## Performance method and observations

`motion-installed.mjs ... <label> stress` opens/closes/reopens a real notification
category popup through 120 rapid cycles (240 openings), then navigates between
sections. Clear 90%, Pitch Black, Dark, Expressive; identical workload code for
the three installed builds. CDP records renderer rAF intervals, long tasks,
JS heap checkpoints and transient cleanup. Automation timing varies per run.

Concurrently, `measure-glass-process.ps1 -RootProcessId <installed PID>` samples
the installed process and refreshed descendant tree. CPU is per-PID CPU delta
divided by elapsed time and all 16 processors. Owned PDH GPU Engine counters
provide busiest-engine utilization, and GPU Process Memory provides dedicated/
shared adapter bytes. Invalid counters are excluded; missing counters remain
null. DWM is shared and is never attributed to Reprise. The table includes only
sample endpoints inside each recorded workload interval; query overhead makes
the intervals longer than one second and short peaks can be missed.

| Installed build   | Workload            | CPU mean, machine % | Owned GPU engine peak % | Private bytes peak MiB | Dedicated GPU peak MiB | rAF p95 / max ms |
| ----------------- | ------------------- | ------------------- | ----------------------- | ---------------------- | ---------------------- | ---------------- |
| .2 before polish  | 21.64s / 12 samples | 12.86               | 6.22                    | 575.33                 | 99.52                  | 6.2 / 12.2       |
| .3 initial polish | 26.27s / 16 samples | 11.75               | 7.19                    | 597.49                 | 94.13                  | 6.2 / 13.7       |
| .4 final polish   | 25.62s / 15 samples | 12.21               | 6.97                    | 591.79                 | 98.49                  | 6.2 / 12.2       |

All three runs recorded zero long tasks, page errors and final active animations.
Valid owned GPU engine counters were available; these are actual utilization/
allocation samples, **not GPU frame times**. No ETW/PIX/GPU presentation trace was
collected. rAF is renderer scheduling, not DWM presentation, input latency or a
proof of zero dropped frames. These single runs do not establish a statistically
significant improvement/regression. Rapid scripted blur/geometry interactions
produce material CPU work; they are not ordinary idle or typical-use estimates.

The final stress heap checkpoints varied from 5.25MB to 12.08MB with collections
between batches; final transient shells/ghosts/animations were zero. Short-run
allocation fluctuation is expected. This does not certify multi-hour memory
stability. An earlier aborted/noisy profiling attempt overlapped other tests;
it is excluded. The retained run labels are `polish-before-measured`,
`polish-after-measured`, `polish-final-stress` and `polish-final-idle`.
`summarize-polish.mjs` regenerates the comparison JSON and chart from raw files.

Final .4 Clear idle, without the finite rAF sampler running: 12 PDH samples over
19.83s averaged **0.49% machine CPU**. Busiest owned GPU engine was 0% in those
samples (13 valid engine counters); this does not exclude work between samples.
Private bytes ranged 369.74–376.65MiB and dedicated GPU memory was 84.53MiB.

Additional sequential .4 workloads used the same process sampler, with finite
rAF/long-task observation during each scenario:

| Scenario                                           | Recorded duration / PDH sample endpoints | CPU mean, machine % | Owned GPU engine peak % | rAF p95 ms |
| -------------------------------------------------- | ---------------------------------------- | ------------------- | ----------------------- | ---------- |
| 60 rapid navigation changes                        | 8.38s / 2                                | 4.78                | .66                     | 6.1        |
| 48 theme/material/tint changes                     | 8.30s / 6                                | 3.43                | 1.05                    | 6.2        |
| Task completion/status/edit/picker/search workflow | 6.03s / 5                                | 6.35                | 5.00                    | 6.2        |

All recorded zero long tasks, page errors, transient shells and running spatial
animations. Six completed `notice-expand`/`notice-slide-in` CSS effects remained
attached to their live task toasts until dismissal; these finished effects are
not ongoing animation work. A first harness assertion counted those finished
effects as active; the final runner records their names/play states and checks
running effects separately. The initial sampler query limits the navigation case
to only two overlapping endpoints, so these scenario numbers are exploratory,
not strong comparative benchmarks. Raw final data: `artifacts/polish/workloads.json`
and `artifacts/glass/runtime/polish-workloads-final-process.json`.

## Automated and rendered verification

- `npm test`: **241 passed**, 26 test files, including new geometry freshness,
  media/policy cleanup, response ordering, hidden Capture appearance and layout-read regressions.
- `cargo fmt --check`, `cargo check`: passed. `cargo test`: **63 passed, 2 ignored**.
  The authorized installed native-toast probe was also run explicitly and passed:
  Windows accepted the submission. That does not prove a banner was displayed.
  The other ignored Store performance benchmark remains opt-in/manual.
- Production TypeScript/Vite build and Tauri release/NSIS packaging completed;
  installed .4 version was checked after its successful update.
- Glass prototype: 48 theme/material/tint contrast cases plus solid/motion
  fallbacks passed. Geometry prototype: 30 reversals, changing SVG silhouette,
  stable press-label bounds and no leaked animation/shell passed.
- Installed .4 matrix: four families (Classic, Pitch Black, Ashen White, Peach),
  requested light/dark, Clear/Regular, tint 35/60/90. All 48 requested cases
  keep menus on screen, fully visible at rest, without a residual transform;
  animation Off leaves zero animations. Fixed families deliberately resolve
  both requested modes to their own effective appearance. A harness assertion
  now rejects mismatched requested/actual themes instead of silently recording them.
- Actual installed task exercise: create three test-owned tasks; finish,
  snooze, settle, schedule, edit date/month, search and Daily Review navigation;
  remove only those tasks and verify the original task fingerprint. User task
  rows are preserved. The test uses a unique title prefix and original-ID guard.
  Final read-only SQLite comparison against the pre-test backup confirmed exact
  task-row equality, no changed settings keys and `integrity_check = ok`.
- Rendered accessibility lab at emulated DPR 1, 1.25, 1.5 and 2: keyboard open/
  Escape/focus return, growing picker dismissal geometry, held-rim policy cleanup,
  forced colors and reduced transparency passed. Screenshots at 1× and 2× were
  inspected: labels and focus outlines are intact, no clipped control text.
- Actual installed WebView media emulation plus read-only DWM attribute query:
  Clear uses backdrop type 3, transparent HTML and Pitch Black canvas alpha .74;
  reduced transparency/forced colors use type 1 and solid backgrounds; reduced
  motion keeps type 3 with no animation; restoring media restores type 3.

## Native visual and lifecycle observations

Using a temporary local Windows background fixture, actual .4 native window
screenshots were inspected over white, near-black and 64px black/white checker
patterns. Clear 90% retains visible desktop contribution, diffusion and readable
labels. Dense task/overview content keeps its stable fill. The checker pattern
is diffused rather than sharply visible. This is DWM Acrylic, not refraction.
The fixture was closed afterward without changing wallpaper or Windows settings.

Quick Capture opens through the real global shortcut; typing immediately lands
in its task field, with visible focus. A disposable draft was cleared without
saving. Escape, reopen and Escape dismiss correctly. The actual native hidden
state is used in sync checks: WebView2 can report `document.visibilityState`
as visible even when its HWND is hidden.

Minimize/second-instance restore, maximize/restore, foreground/background and
native keyboard resizing were observed. The window settled to the correct
layout/material after resizing. Windows' own restore animation can temporarily
scale its window image; this is not a glass content-morph implementation.
No persistent opaque surface or stale material was observed in these checks.
Native accessibility inspection exposes navigation buttons, capture edit field,
dialogs and menu roles. Task dialog, empty workspace and forced-colors screenshots
were also inspected. RustDesk was never operated or changed.

## Limitations and manual certification

- Tinted remains an internal lab recipe, not a shipping persisted option.
  Adding that product setting is outside this defect-only pass.
- WebView media emulation is not a test of actual Windows settings transitions;
  physical 125/150/200% scaling, mixed-DPI/multiple monitors and display hot-plug
  still need manual hardware testing. No desktop refraction is supported.
- Sleep/resume was not forced on the remotely controlled desktop. Long sessions,
  GPU loss/unsupported hardware, battery saver and actual Windows accessibility
  settings need manual certification. Safe fallback code/tests are present.
- Screen-reader roles/focus were checked; live NVDA/JAWS narration was not.
  Native toast submission passed, but banner visibility/focus policy remains manual.
- Quick Capture and native resize/restore were functionally/visually checked,
  but no isolated CPU/GPU benchmark or GPU frame-time trace was captured for
  those native interactions. Do not extrapolate the popup workload to them.
- All available default automated tests pass. These results support the scoped
  fixes; they do not certify every Windows/GPU/display combination or replace
  the manual checks above. No Stable or Nightly release was published.

The installed app was finally restarted normally with the original Clear 90%,
Pitch Black/Dark and Expressive preferences. Local diagnostic port 9228 is closed;
the normal installed HWND still reports native backdrop type 3. No testing
background window remains open.
