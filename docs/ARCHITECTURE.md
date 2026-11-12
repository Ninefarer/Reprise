# Architecture and reliability

[Documentation](README.md) · [Building Reprise](BUILDING.md)

## Local storage

SQLite is authoritative. The database is `reprise.sqlite` in Tauri's application data directory. Stable uses `com.reprise.desktop`; Nightly uses `com.reprise.nightly`. Their data is separate from the executable and from each other.

WAL, foreign keys, transactions, schema migrations, and optimistic task revision checks protect persisted changes. Task history records meaningful transitions. Permanent deletion and notification-history management are backend operations, not frontend hiding.

## Scheduling and return semantics

Lifecycle status, scheduled start, deadline, wake time, review membership, and notification state have separate meanings. Resurfaced is review membership, not a lifecycle status. Snooze and settlement preserve schedule and deadline; Waiting follow-ups do not resolve the dependency.

A Rust worker reconciles events every 15 seconds, including after startup, sleep, or clock changes. Durable event identifiers and persisted processing state suppress repeated work. Quiet hours defer notification submission. Multiple pending reminders can be grouped. Daily Review uses the local calendar date.

UTC timestamps are persisted. Next-day settlement resolves local DST gaps forward and folds to the earlier instant. An already stored wake instant stays fixed when the system timezone changes. Exactly-24-hour settlement is an elapsed-time choice distinct from a preferred next-day local time.

## Windows notifications

Windows toasts and Reprise's internal notification history are independent. Native submission, failure, and interaction are recorded where observable; submission is not a display or read receipt. Clearing local history does not clear Windows Notification Center.

Closing the window hides it by default while the tray process keeps scheduling. Quitting stops reminders until the next launch. Missed events are reconciled on launch. Native notification callbacks support the running process; terminated-process activation and native action buttons are not established supported features.

A crash between OS submission and SQLite acknowledgement can repeat a notification: Windows submission and the database cannot share a transaction. Idempotent event processing does not remove that external-side-effect boundary.

See [Native toasts and Quick Capture](NATIVE-TOASTS-CAPTURE.md), [notification-panel history](NOTIFICATION-PANEL.md), and [local notification fixes](SETTINGS-NOTIFICATION-CLEANUP.md) for implementation-pass evidence. Consult the exact release notes before attributing a development fix to a published build.

## Current boundaries

Do not infer support from a task field, initial specification, or old screenshot. Startup preference wiring, configurable Quick Capture registration, backup/restore/import/export, recurrence generation, subtasks/dependencies, a calendar view, and batch triage are not established completed release capabilities. Notification-history clearing does exist; early README text describing it as unfinished was stale.

## Windows acceptance checks

Install the intended package before checking its registered native identity. Use a dedicated QA profile and test-owned tasks.

- Check a due reminder with the main window visible and hidden in the tray. Observe Windows Focus/DND and permissions without changing them as a test shortcut.
- Check native click routing separately from submission. Do not infer that a banner appeared because Windows accepted a payload.
- Dismiss a Windows toast and verify the task remains in Resurfaced until explicitly handled.
- Quit, let a timer expire, relaunch, and verify one reconciled review entry.
- Exercise sleep/resume, clock changes, timezone changes, and daylight-saving boundaries.
- Verify single instance, Quick Capture, tray reopen, settings persistence, and task persistence after restart.

Historical QA documents retain their original test counts and observations. They are evidence for specific builds, not universal acceptance claims.

## API references

- [Tauri Windows notifications](https://v2.tauri.app/plugin/notification/)
- [Tauri global shortcuts](https://v2.tauri.app/plugin/global-shortcut/)
- [Tauri autostart](https://v2.tauri.app/plugin/autostart/)
