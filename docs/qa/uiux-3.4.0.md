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

- `npm test`: **194 passed**, no failed tests or suites, including the final
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
`09e02a3d0fb7a31ad2da84e24236cdf6d791b194e2f37e45f7095c169741b381`.
This is an unlaunched local executable, not a signed installer or published
Nightly. The ignored build-output path can be overwritten by later local builds.

## Regression coverage and its limits

| Requirement                          | Evidence                                                                                                                                                                    | Remaining native check                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Hidden/minimized refresh suppression | Existing application tests retain skipped-read state and hidden-window snapshots; backend gate retained by diff review                                                      | Physical hide/minimize with metadata observations                  |
| Immediate restoration                | Tests cover focus/resize restoration, fresh countdowns and simulated six-hour suspension                                                                                    | Physical restore after a due timer                                 |
| Lightweight Quick Capture            | Rust test proves bootstrap/creation succeeds despite invalid unrelated task and notice list rows; UI tests cover Enter/Escape, duplicate submission and failure recovery    | Native capture focus/drag/shortcut and measurements                |
| Draft preservation                   | Settings and task drafts survive refresh/restore; stale task revision saves remain rejected                                                                                 | Native focus and window transitions                                |
| Scheduling while hidden              | Durable scheduler, snooze/settlement, quiet hours, DST and reconciliation tests pass; Rust worker implementation unchanged                                                  | Actual hidden-window scheduling and real toast delivery            |
| Notifications                        | Search/category/unread filters, clearing, pinning, dismissal, Undo and update operations covered                                                                            | Hover edge, pointer transfer into popups and notification lifetime |
| Custom controls and editing          | Keyboard choice, disabled options, type-ahead, modal containment, cancellation, invalid/partial dates, leap dates, year navigation and draft-preserving transitions covered | WebView2 top layer, clipboard, keyboard and screen-reader behavior |
| Persistence and channels             | Store reopen/migration/revision tests; shortcut remount test; separate update feeds and symmetric release-history filtering                                                 | Installed candidate upgrade and restart                            |

The [earlier performance QA](window-refresh-suspension-2026-11-13.md) remains
historical evidence for that source. No new physical window-state timings or
claims of reduced CPU/battery consumption were inferred from unit tests.

## Native acceptance pending

Both `@oai/sky` and the alternate native inventory interface return:
`Computer Use native pipe is unavailable ... The system cannot find the file
specified. (os error 2)`. Session resets and retry after the user's Codex update
did not restore access. The user authorized continued implementation and assigned
helper diagnosis separately. No app was launched against personal Stable or
Nightly data for this pass.

When the helper is available, use an isolated QA identity/profile and disposable
fixtures. Record actual observations for:

- Classic Light, Classic Dark, System-following appearance, Pitch Black and
  Ashen White, each in Comfortable and Compact.
- Opaque, native Clear and Acrylic; reduced motion, forced colors and reduced
  transparency. Do not change Windows security/privacy settings for testing.
- Minimum supported window size, narrow sidebar with large counts/long names,
  long tasks/notes and display scaling at available 100/125/150/200% settings.
- Native popup placement/clipping, Escape/Tab/Enter, context menus, clipboard
  undo/redo, tooltips, keyboard focus and accessible announcements.
- Hidden and minimized windows, due scheduling with both windows hidden,
  lightweight visible Capture, immediate restore and preserved conflicting drafts.
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
