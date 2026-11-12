# Reprise 3.2.0 - maintenance release

The native toast submission path and Quick Capture were subsequently refined within 3.2.0. See NATIVE-TOASTS-CAPTURE.md for the current native Windows implementation, updated test counts and verification results.

## Audit and focused refactor

Notification storage/management/daily summary construction now live in `src-tauri/src/notifications.rs`; reminder reconciliation, Windows submission and activation registration live in `scheduler.rs`. This removes the large inline background loop and notification SQL from main/store orchestration. The existing task lifecycle stays in store/actions/domain. Presentation labels, filtering and management action types are centralized in `src/notifications.ts`. Notification history remains separate from Windows Notification Center.

App.tsx still owns task orchestration and page rendering and is a large component. A complete extraction of every task page was deliberately deferred; this release does not replace working task state management. Existing React snapshot state remains authoritative in the frontend, SQLite in the backend. No dependencies added or updated. Rust formatting and strict Clippy exposed and removed one unnecessary tray icon vector allocation. Active legacy CSS glass controls were already removed in 3.1.1; compatibility fields remain inert in saved settings.

Two existing event subscription promises lacked rejection handlers; errors now surface while the component remains mounted. Their late-registration cleanup is preserved. No new continuous animation or rendering loop is introduced.

## Confirmed defects and fixes

| Severity | Defect | Fix |
|---|---|---|
| High | No notification dismissal or bulk management commands | Transactional read/dismiss/clear-read/clear-all operations, stable IDs and retirement records |
| High | Clearing a daily summary could recreate it the same day | Retirement keys survive history removal; event processed flags remain independent |
| Medium | Underlying app text interfered with the translucent notification dock/cards | Opaque semantic dock/card fills; native window Glass remains intact elsewhere |
| Medium | Density affected only a few task rules and hid descriptions | Root-level density styling for navigation, lists, overview, notifications, settings, menus and forms; descriptions retained |
| Medium | Empty daily reviews and singular/plural error | Empty days evaluated silently once; unique eligible task count and correct noun |
| Medium | Old pending daily summaries could be submitted on a later day | Cancel stale pending daily submissions while retaining history |
| Medium | Repeated update checks produced placeholder/error history spam | Unconfigured feed returns a Settings status with no notification; other informational check results use stable slots |
| Medium | View navigation inherited a long Settings scroll position | Reset document/content scroll on destination change, without resetting navigation or notification scrolling |
| Low | Notification categories exposed internal IDs | Central labels used in cards, filter options, search and reminder preferences |
| Low | Undo feedback covered notification controls | Move feedback to the left of an open notification dock |
| Low | New clear confirmation lacked an inset and failed operations were hidden behind it | Dedicated dialog padding, visible modal error and focus restoration |

## Notification semantics and integrity

- Mark read retains history and sets read state. Mark all targets current unread IDs.
- Dismiss retains the historical row but hides it using a retirement key. Dismissed Pending rows are excluded from future scheduler submissions.
- Clear read removes confirmed local read rows and rechecks read state transactionally. Unread rows remain.
- Clear all removes the confirmed local rows. Confirmation captures IDs so newly arriving reminders are preserved.
- Clearing retains only retirement IDs/timestamps needed for deduplication; no removed title/body snapshot is kept in those keys. Dismissal is deliberately different from permanent history removal.
- All operations use the existing database lock and transactions. Update downloads/installations cannot have their history removed mid-operation. Rollback, restart, unknown-action and incoming-reminder cases have regression coverage.
- Migration 3 adds `retired_notifications`. Task schema/data are unchanged. A pre-upgrade SQLite backup is retained in the real profile's backups directory. Older 3.1.1 cannot open schema 3 directly; downgrade requires restoring that backup.

## Daily review and update audit

Daily review remains at the user's saved local time, evaluated by the Rust background process every 15 seconds and on launch. UTC scheduled instants use the existing DST-aware local-time resolver. Inbox, resurfaced, scheduled-today, overdue and due Waiting follow-ups are counted once per task. Completed/dropped tasks are excluded. Summary content is a snapshot at generation, not a continuously updated count. Empty days receive a retirement key instead of a notification; adding a task later that day does not produce an unexpected late summary. Manual review always remains available.

Local-calendar daily IDs deduplicate after restart, sleep/wake reconciliation, history dismissal and clearing. Previous-day pending summaries are not sent on a later day. Existing quiet hours, notification/category preferences and pause state remain enforced at submission. Timers never change task lifecycle by themselves beyond existing review-queue behavior.

Update checks are manual. The configured endpoint list and public key are empty; no update service is invented. An absent feed produces an inline status in About / Updates, not another history entry. Actual update offers remain distinct, version-keyed and signed. Existing historical placeholder entries are preserved for the user to clear.

## Native activation and limits

The installed `tauri-plugin-notification` 2.8.0 supports `on_action` and notification extras. Scheduled notifications now carry stable notice IDs, review context and optional task ID. A reported live Windows tap records Opened/read/interaction time and brings Reprise forward; Daily Review opens its page, other taps open Notifications for the related task action. In-app daily summaries have a direct Open Daily Review action.

The plugin documents that Windows callbacks are reported only while the toast is on screen, not after it moves into Notification Center. Entirely terminated-process activation is unsupported by this implementation. Reprise must remain running in the tray for reminders. Startup reconciliation remains intact.

Plugin submission success is not a Windows display receipt. The prior user screenshot confirmed actual display in 3.1.1. Fresh 3.2.0 native toast display and the new live-tap callback were not visually confirmed during this pass; frontend route handling/cleanup is regression-tested, but this does not substitute for a Windows click test. Focus/Do Not Disturb, disabled notifications, actual sleep/wake, system clock/timezone changes and full minimized/background behavior were not manually replayed. Existing quiet-hour, persistence, DST, event idempotency and lifecycle tests passed.

## Density values

Comfortable retains task-card padding 16px and block margin 9px. Compact uses 10px and 6px. Compact navigation has 30px minimum rows with 5px vertical padding. Overview buttons use 12px padding and 8px grid gaps; section spacing is 14px/8px; Settings sections use 16px inset and 12px separation. Dialog forms use 20px instead of 25px. Notification cards use 8px/10px padding and 6px margins instead of 11px padding and 8px margins; action spacing drops from 12px to 7px. Header and filter insets also tighten. Font sizes and task descriptions remain unchanged. Root scope covers dialogs and detached surfaces; saved density survives theme/navigation changes and restart.

## Actual Windows checks

An isolated `com.reprise.qa` profile used 12 temporary tasks and 16 history entries including a long title/body, mixed read states and Daily Review. No real tasks/history were used for destructive QA. The QA profile/config were removed afterward.

Observed: zero sidebar badges hidden, nonzero counts beside labels; quick capture prompt inset/focus; human-readable category cards and search; long text wrapping; dock scrolling; mark all read from 8 unread to 0; individual dismissal; clear-all confirmation and Escape cancellation; empty history and a single unread item; native Clear revealing sharp browser/video content and native Acrylic blurring it while notifications remain opaque; visible Compact changes across navigation/task lists/cards/Settings; a task moved Inbox -> Do Now -> Settled with immediate counters. Restart restored density, Clear mode, task transition and notification retirement/read state.

Bulk destructive confirmation was exercised through component tests and real SQLite tests; desktop confirmation/cancellation was inspected without clearing the real history. Empty and single-entry desktop fixtures were set up in the isolated QA database. This is not a claim that every listed task/window workflow received a fresh manual end-to-end run.

Screenshots: `qa-3.2.0/compact-acrylic.png`, `qa-3.2.0/comfortable-clear.png` (QA fixtures, before the final small dialog/scroll corrections).

Installed 3.2.0 with NSIS exit code 0, launched the installed executable, observed its bundled What's New v3.2.0 and schema 3 with saved Compact/Pitch Black/Acrylic/Crystal preferences. Task rows match the pre-upgrade backup; notification history row count is preserved. The release notes are left open for the user.

## Checks

- `npm test`: 125 passed across 8 files (previous 113 preserved; coverage expanded).
- `npm run build`: TypeScript and Vite pass.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 39 passed (previous 34 preserved).
- `cargo check --manifest-path src-tauri/Cargo.toml`: pass.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`: pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: pass.
- Prettier check on modified frontend files: pass. No ESLint configuration exists; no lint system was added just for this release.
- `npm run tauri -- build`: optimized executable and NSIS installer pass.

Initial failures were updated version/schema/empty-review expectations, one unused test import, a tray-icon Clippy warning and formatting. They were corrected; no tests removed or skipped.

## Files changed

Backend: `src-tauri/src/main.rs`, `store.rs`, new `notifications.rs`, new `scheduler.rs`, `updates.rs`, `tests.rs`.
Frontend: `src/App.tsx`, `App.test.tsx`, `AppearanceSettings.tsx`, `Preferences.tsx`, `NotificationSidebar.tsx`, new `NotificationClearDialog.tsx`, new `NotificationSidebar.test.tsx`, new `notifications.ts`, `model.ts`, `theme.ts`, `style.css`, `desktop-glass.css`, `notification-sidebar.css`, new `density.css`, `changelog.ts`, `visualPolish.test.mjs`.
Version metadata: `package.json`, root package version in `package-lock.json`, `src-tauri/Cargo.toml`, reprise package in `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`.
Records: `docs/RELEASE-3.2.0.md`, `docs/PROGRESS.md`, two QA screenshots.
