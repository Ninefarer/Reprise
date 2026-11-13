# Reprise 3.4.0 UI/UX implementation and acceptance

Issue: [#2](https://github.com/Ninefarer/Reprise/issues/2). Work belongs to
`develop`; no 3.4.0 application changes have been promoted to `main` or published.
Candidate Nightly version: `3.4.0-nightly.20261113.1`.

## Implementation record

| Batch | Local commit | Scope                                                                                                                                              |
| ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `ffe16cc`    | Hub/Ongoing/Archive, Current display name, removed All Tasks destination, Avatar wording, capture/page/deletion cleanup, release-channel filtering |
| 2     | `6eaf78b`    | Shared custom selects and inline capture validation                                                                                                |
| 3     | `eda9412`    | Custom calendar/time controls, local typed-input validation, Apply/Cancel/Clear                                                                    |
| 4     | `5af242e`    | Settings tabs, atomic allowlisted section patches, Save/Discard, legacy Space name hidden, simplified profile menu                                 |
| 5     | `954c295`    | Intent-specific task editing, validation, grouped fields and on-demand destination-colored history                                                 |
| 6     | `9d09d32`    | Notification category retention, popup-aware dismissal, redundant close button removed                                                             |
| 7     | `1653047`    | Custom shortcut recorder, exact modifier matching, shared frontend/Rust validation and conflict rejection                                          |
| 8     | `1a1064f`    | Compact spacing, typography, tooltips, greetings, calendar year editing and modal/label accessibility checks                                       |

The previously implemented performance changes remain in `d5a05b4`. Diff review
against that baseline found no subsequent change to `scheduler.rs`, `domain.rs`,
`store.rs`, `view_data.rs`, or native `visuals.rs`. `main.rs` adds the settings
patch command and shortcut validation; its snapshot suspension logic is retained.
Desktop-glass CSS extends the existing material treatment to custom controls;
the Windows composition implementation is unchanged.

## Automated verification

Executed November 13, 2026 on Windows x64:

- `npm test`: **199 passed**, no failed tests or suites, including the final
  3.4.0 version metadata and bundled release notes.
- `npm run build`: TypeScript and Vite production build passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **52 passed**, two existing
  explicit ignores (manual Store benchmark and real installed-toast probe).
- `cargo test --manifest-path src-tauri/Cargo.toml --features performance-qa performance_probe::`:
  the metadata-only probe test passed.
- `cargo check`, `cargo fmt --check` and Clippy for all targets with warnings
  denied passed.
- `node --test scripts/github/issue-report.checks.mjs scripts/updater/manifest.checks.mjs`:
  **11 passed**. The updater artifact test used existing signed QA fixtures;
  it does not establish an installed upgrade of the 3.4.0 candidate.

The final frontend report is local test output, not an assertion of visual
correctness in WebView2. The full Rust suite and Clippy were rerun successfully
after preparing the 3.4.0 metadata.

The command `npm run tauri -- build --no-bundle --config src-tauri/tauri.nightly.conf.json`
successfully built the optimized Windows executable at
`src-tauri/target/release/reprise.exe`. Its Windows version resources report
`Reprise Nightly` / `3.4.0-nightly.20261113.1`. SHA-256 at verification time:
`a958f9fe1b92e7567749504650b8748906b1d37a0b3ade7049cd7d01eb6fa41d`
after rebuilding application source `4c95ab9` with the native-review fixes.
This is an unlaunched local executable, not a signed installer or published
Nightly. The ignored build-output path can be overwritten by later local builds.

## Regression coverage and its limits

| Requirement                          | Evidence                                                                                                                                                                    | Remaining native check                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Hidden/minimized refresh suppression | Application regression tests plus current native metadata: zero full reads in hidden/minimized intervals                                                                    | Hours-long/sleep-resume observations                               |
| Immediate restoration                | Current native focus snapshot retrieved the due fixture before timer refresh; tests also cover resize and simulated six-hour suspension                                     | Physical sleep/resume                                              |
| Lightweight Quick Capture            | Rust poisoned-list regression, frontend capture tests and current native capture-only reads returning zero list rows                                                        | Native dragging and multiple-DPI behavior                          |
| Draft preservation                   | Current native task and Capture drafts survive window transitions; automated settings/task tests retain revision conflict protection                                        | Native conflicting task revision and all settings draft paths      |
| Scheduling while hidden              | Current native due fixture reconciled once while both windows hidden; scheduler/DST/quiet-hour tests pass                                                                   | Real toast delivery/activation                                     |
| Notifications                        | Search/category/unread filters, clearing, pinning, dismissal, Undo and update operations covered                                                                            | Hover edge, pointer transfer into popups and notification lifetime |
| Custom controls and editing          | Keyboard choice, disabled options, type-ahead, modal containment, cancellation, invalid/partial dates, leap dates, year navigation and draft-preserving transitions covered | WebView2 top layer, clipboard, keyboard and screen-reader behavior |
| Persistence and channels             | Store reopen/migration/revision tests; shortcut remount test; separate update feeds and symmetric release-history filtering                                                 | Installed candidate upgrade and restart                            |

The [earlier performance QA](window-refresh-suspension-2026-11-13.md) remains
historical evidence for that source. No new physical window-state timings or
claims of reduced CPU/battery consumption were inferred from unit tests.

## Native acceptance follow-up

The Windows helper reconnected on November 13. The follow-up used an optimized
`performance-qa` build with the isolated `com.reprise.performance.qa` identity,
disabled native notifications, no updater endpoint and synthetic fixtures.
Personal Stable and Nightly profiles were not opened or modified.

User feedback and native inspection led to local commit `4c95ab9`:

- Replace the tiny text select glyph with a consistent SVG chevron; keep keyboard
  and type-ahead selection. Scope onboarding popups to their themed setup surface.
- Put clock buttons inside their inputs and give each input/picker an explicit,
  contextual accessible name.
- Accept explicit English dates such as `march 3rd, 2027`, optional AM/PM or
  24-hour times, and existing ISO local values. Format readable dates on blur,
  retain partial drafts, reject invalid/ambiguous dates and keep stored local
  timestamp conversion unchanged. A date without a time retains the field's
  previous clock, or uses the existing 9am picker default for a new date.
- Tighten Settings tabs and Quick Capture; remove the decorative capture plus.
  Fit the capture window to its content with capture-only resize permission.
  Retest blank-title feedback below the field after correcting its old negative
  margin. No dependencies, schema changes or scheduler changes were introduced.

Observed in WebView2 on the current Windows desktop:

- Appearance settings and native custom-select changes in Classic Light, Classic
  Dark, System (current Windows dark mode), Pitch Black and Ashen White, each in
  Comfortable and Compact. These are layout smoke checks, not every interaction
  in every theme. No live Windows theme-transition test was performed.
- Native Clear transparency and Acrylic blur. Opaque mode restored correctly.
- Clock buttons sit inside inputs in both densities; readable `2:30pm` typing,
  picker placement/theme, Escape retaining the draft and Discard restoring saved
  settings were observed. Existing user feedback confirms navigation hover and
  shortcut-recorder Escape behavior.
- Quick Capture is compact in light/Comfortable and dark/Compact, grows for its
  blank-title feedback, saves once through Enter and preserves drafts across hide
  and reopen. The validation text is below the field without overlap.
- A disposable task accepted `march 3rd, 2027`, displayed `March 3, 2027 at 9:00 AM`
  and persisted the expected local timestamp (`2027-03-03T09:00`).
- Both windows hidden: the worker processed a short due Snoozed fixture exactly
  once, added review membership and one Resurfaced history record, and retained
  its Snoozed lifecycle. The notice remained Pending because native delivery was
  disabled. Metadata recorded zero full snapshots and 16 skipped requests during
  the approximately one-minute observation. Native states confirmed both hidden.
- Main minimized/Capture hidden: zero full snapshots, eight skipped requests in
  a 33-second observation; native main state was visible and minimized. The task
  title draft survived both hidden and minimized restoration without being saved.
- Capture visible/main hidden: eight lightweight reads, zero task/notice list
  rows and zero full snapshots in 55 seconds. The restored main window retrieved
  all 102 tasks and 101 notices on focus, before its next timer refresh.
- At the supported 800x600 client minimum, Settings wrapped into one column in
  both densities and lower controls remained reachable by scrolling. Inbox,
  task-editor and setup scrolling were also exercised. The setup select and
  time picker retained the Nightly palette and Escape dismissed the picker.
- Ctrl+Shift+N closed the unpinned notification panel. Settings appearance
  choices and the saved task date survived an app restart.

After quitting QA, a SQLite backup restore returned its original 100 tasks,
100 notices and settings. All six application table row digests matched the
baseline (`dc989bdfe82f1e2696db31542e87e74b05af9f7c2e795d7797e2bf19ba2b3b26`);
integrity was `ok`. The pre-cleanup QA database was retained locally as evidence.

Local screenshots and raw metadata are retained under ignored
`artifacts/uiux-qa/`; they are not release artifacts. The source fixes were rebuilt
and visually retested. The earlier OS error 2 is historical, not the current
native-inspection status.

Remaining acceptance scenarios:

- Exhaustive task/notification interactions in every theme/density/material
  combination, live Windows light/dark transitions and reduced motion, forced
  colors and reduced transparency. System accessibility settings were not changed.
- Multi-monitor and 100/125/150/200% scaling, extreme sidebar counts and long
  notes beyond the exercised synthetic fixtures.
- Full screen-reader announcements, clipboard undo/redo, all context menus and
  keyboard focus paths. Scoped control names were inspected through native AX;
  that is not a screen-reader test.
- Physical sleep/resume or hours-long suspension. Hidden scheduling used a short
  real due interval; six-hour behavior remains simulated frontend coverage.
- Real native toasts, task routing, quiet hours, restart persistence and the
  signed installed-upgrade path. A submitted payload is not a display receipt.

## Deliberate scope decisions

- The conflicted proposal to add tasks from every view remains deferred. Capture
  stays on Home/Inbox, through Quick Capture and the command palette.
- `Updated “task”` remains temporary Undo feedback rather than a persistent
  activity notification. No activity-feed behavior was added.
- The settings duplicate What's New button is removed; automatic post-update
  announcements remain. Diagnostics stay Nightly-only.
- Existing `DoNow` values, workspace strings and saved sidebar group identifiers
  are retained. No task data migration or schema change was introduced.
- Actual visual sign-off, native interactions and installed Nightly evaluation
  are incomplete. Issue #2 stays open; no release publication is authorized.

## GitHub App reporting

Automation alone was promoted through [PR #3](https://github.com/Ninefarer/Reprise/pull/3)
and the reporting compatibility follow-up [PR #4](https://github.com/Ninefarer/Reprise/pull/4).
The [test comment](https://github.com/Ninefarer/Reprise/issues/2#issuecomment-6857210668)
was independently confirmed as `reprise-bot[bot]` (`Bot`). Subsequent reports use
the workflow with secrets confined to GitHub Actions; they do not use personal
account commenting. See [reporting operations](../CODEX-ISSUE-REPORTS.md).
The [native review follow-up](https://github.com/Ninefarer/Reprise/issues/2#issuecomment-6863500096)
was verified under the same bot identity after Actions run `43497737438` succeeded.
