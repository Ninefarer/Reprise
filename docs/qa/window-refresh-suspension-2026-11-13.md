# Native-window refresh suspension

Development work on `develop` after the 3.3.3 releases. No installer or release was published by this pass. Runtime measurements were collected November 12, 2026; final automated checks and cleanup were completed November 13.

## Scope and implementation

The main and Quick Capture webviews previously read all tasks and notification history on both their 15-second timer and the Rust worker's refresh event, even when hidden. Browser visibility stayed `visible` in these native-hidden observations. A minimized window also retained native `is_visible = true`.

Periodic, worker-event and restore refreshes now check Tauri's native visibility and minimized flags before acquiring the database mutex. A skipped request returns `null`; the frontend retains its existing view and drafts. Initial bootstrap and explicit user actions remain available. Focus requests fresh data immediately, and native resize/restore requests catch up after a skipped read without requiring a browser focus event. Countdown time updates with the successful snapshot. Ordinary resizing does not trigger extra snapshots once caught up.

This suspends full presentation reads, not the application engine. The Rust worker, reconciliation, durable event processing, native notification submission, writes and automatic update checks remain independent. Small visibility-check IPC requests still occur on the existing timer/events. This is not a claim of zero hidden-window CPU activity.

Quick Capture now reads only settings and system/release presentation metadata. It does not query task or notification lists or load an avatar. Its create command saves directly and emits a refresh so the main window can catch up immediately. A failed refresh notification does not turn an already committed capture into a failed save that could be retried as a duplicate.

No schema, dependencies, scheduling rules, lifecycle states, native-glass code or production release configuration changed.

## Measured result

Release-mode Windows x64 QA builds used the isolated identity `com.reprise.performance.qa`, Classic dark/opaque appearance, 100 synthetic tasks and 100 synthetic notices. Each row represents the first complete 90 seconds of a native-state-validated observation; startup, focus and transitions are excluded. See the [before record](refresh-activity-2026-11-12.json) and [after record](window-refresh-suspension-2026-11-13.json).

| Main window / Quick Capture | Full snapshots before | Full snapshots after | Lightweight Capture reads after | Skipped requests after |
| --- | ---: | ---: | ---: | ---: |
| Visible / hidden | 24 | 12 | 0 | 12 |
| Hidden / hidden | 24 | 0 | 0 | 24 |
| Minimized / hidden | 24 | 0 | 0 | 24 |
| Hidden / visible | 24 | 0 | 12 | 12 |

The visible Capture case returned 15,315 logical JSON bytes over 90 seconds, compared with approximately 2.78 MB from two full lists before. Capture responses contained zero task and notice rows. These are logical serialized data sizes, not measured network traffic, IPC framing bytes, CPU or battery usage. The main window's visible full-snapshot frequency remains unchanged.

An initial attempt at the last case left the main window visible. The analyzer rejected the state mismatch; that observation was excluded and repeated with the correct native states. Raw metadata logs and observation markers remain ignored local QA artifacts.

## Engine and restore checks

- Created one temporary intention through the actual Quick Capture UI; verified its single persisted Inbox record in the QA database.
- Opened its task dialog and entered an unsaved title and notes. Verified that neither draft had been written to SQLite, then hid the window.
- With both windows hidden, made a second test-owned Snoozed fixture due. The running Rust worker processed its event, retained the Snoozed lifecycle status, set review membership and recorded exactly one Resurfaced history entry. No full presentation reads occurred during that hidden interval.
- Native Windows notification submission was deliberately disabled in this synthetic profile. The reminder remained Pending. This test establishes engine reconciliation, not a visibly delivered Windows banner.
- On restoration, metadata recorded a focus-triggered full snapshot containing the updated 102 tasks and 101 notices before the next timer request. This confirms immediate retrieval rather than waiting for polling.
- Final visual inspection of the restored dialog, fresh theme and Resurfaced screen could not be completed after the session interruption: Computer Use reported `native pipe is unavailable` with OS error 2, including after its documented recovery attempt. Do not treat those visual assertions as verified. Automated tests cover fresh countdowns/queue counts and preservation of task and Settings drafts, including stale-revision save rejection.
- Six hours of elapsed time were simulated in a frontend regression test; the live hidden-engine test used a short due interval, not a physical six-hour wait. Sleep/resume and real native toast display were not retested in this pass.

With the QA process no longer running, cleanup removed only the two explicitly created fixture tasks and their owned rows and restored the QA settings. The original 100 tasks and 100 notices remained. Task/notice/event/history row SHA-256 matched the baseline: `3cc6f9b87f9dd7a271eedbe57136894c413ec156079791c76113f2fd96740d0d`. SQLite integrity was `ok`. Installed Stable/Nightly applications and real user databases were not modified.

## Regression checks

Frontend regression coverage includes skipped reads retaining the view, six-hour countdown/queue catch-up on focus, native restore without browser focus, task draft conflict handling, Settings drafts with fresh appearance, queued refresh reason preservation and asynchronous listener cleanup. The Rust Capture regression deliberately poisons unrelated task/notice list rows; lightweight bootstrap and creation still succeed while the full-list read correctly fails.

Final commands and results:

- `npm test`: 179 frontend tests passed across 11 files.
- `npm run build`: TypeScript and Vite production build passed.
- `npx prettier --check src/App.tsx src/App.test.tsx`: passed. No separate frontend lint script is configured.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 50 passed, 2 intentionally ignored.
- `cargo test --manifest-path src-tauri/Cargo.toml --features performance-qa`: 51 passed, 2 intentionally ignored.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed; also passed with `--features performance-qa`.
- `npm run tauri -- build --features performance-qa --no-bundle --config artifacts/performance-qa/config.json`: optimized Windows QA executable built successfully. No installer, tag, push or release was produced.
- The metadata analyzer passed against all four complete after-observations. SQLite integrity and baseline row-hash checks passed after fixture cleanup.

The Rust suite's manual benchmark and real-toast probe remain intentionally ignored. These checks do not close the visual and sleep/resume acceptance gaps above.
