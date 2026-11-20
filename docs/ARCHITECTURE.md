# Architecture and reliability

[Documentation](README.md) · [Building Reprise](BUILDING.md)

## Local storage

SQLite is authoritative. The database is `reprise.sqlite` in Tauri's application data directory. Stable uses `com.reprise.desktop`; Nightly uses `com.reprise.nightly`. Their data is separate from the executable and from each other.

WAL, foreign keys, transactions, schema migrations, and optimistic task revision checks protect persisted changes. Task history records meaningful transitions. Permanent deletion and notification-history management are backend operations, not frontend hiding.

Schema version 2 added notification error text. Version 3 adds `retired_notifications`. A database newer than version 3 is rejected rather than overwritten. Legacy task and settings JSON stays readable.

Profile pictures are 256×256 PNGs. Rust checks the encoding, dimensions, and resource limits, then writes a UUID-named file under the app data `profile` directory. The original file is not kept.

Saved settings still accept the older `material`, `glass_coverage`, and `blur_intensity` fields so existing rows round-trip. Those fields no longer change what the interface draws.

## Scheduling and return semantics

Lifecycle status, scheduled start, deadline, wake time, review membership, and notification state have separate meanings. Resurfaced is review membership, not a lifecycle status. Snooze and settlement preserve schedule and deadline; Waiting follow-ups do not resolve the dependency.

A Rust worker reconciles events every 15 seconds, including after startup, sleep, or clock changes. Durable event identifiers and persisted processing state suppress repeated work. Quiet hours defer notification submission. Multiple pending reminders can be grouped. Daily Review uses the local calendar date and is a snapshot of eligible tasks at generation time, not a live count. An empty day records a retirement key instead of a notification. A pending daily summary from an earlier day is cancelled rather than sent late.

UTC timestamps are persisted. Next-day settlement resolves local DST gaps forward and folds to the earlier instant. An already stored wake instant stays fixed when the system timezone changes. Exactly-24-hour settlement is an elapsed-time choice distinct from a preferred next-day local time.

The latest reversible history row can be undone while the task revision still matches. Created, Edited, Undone, and Resurfaced rows are not undone. Undo restores pending reminders cancelled by that transition and does not recall a Windows toast.

Permanent deletion removes the task and its owned history, events, and in-app notification rows in one transaction. Child tasks stay and are detached. The running process keeps a deletion receipt, and the notice offers Undo for 30 seconds. Opening the database again discards every receipt. Restore skips notification rows whose ids are already retired, and it does not remove a toast Windows has already accepted.

## Windows notifications

Windows toasts and Reprise's internal notification history are independent. Native submission, failure, and interaction are recorded where observable; submission is not a display or read receipt. Clearing local history does not clear Windows Notification Center.

On Windows, reminder text is ToastGeneric XML sent with `ToastNotifier.Show` for the installed app identity. Explicitly disabled notification settings block submission. A missing permission record (`0x80070490` from `ToastNotifier.Setting`) is treated as unknown, and Show is still attempted. Other permission-query failures are reported. Asynchronous Failed events are stored on the matching history rows. The process keeps at most 32 live toast callback pairs and drops older handlers. Non-Windows builds use the Tauri notification plugin. An ignored test, `installed_native_toast_probe`, sends a real toast only when `REPRISE_TOAST_TEST_ID` is set. A passing Show means Windows accepted the payload.

Single reminders name the task and distinguish a scheduled start, an ended snooze, a settled return, a Waiting follow-up, and a deadline. Grouped reminders list up to three of those lines and a remainder count. User text is XML-escaped. Titles are shortened on Unicode scalar boundaries.

Closing the window hides it by default while the tray process keeps scheduling. Quitting stops reminders until the next launch. Missed events are reconciled on launch. Native notification callbacks support the running process; terminated-process activation and native action buttons are not established supported features. Windows reports a click while the toast is on screen, not after it has moved into Notification Center.

Stable 3.4.0 skips full presentation snapshots while the native window is hidden or minimized. Rust scheduling and notification delivery continue independently. Focus and restore request fresh data and countdown time immediately. Existing editor drafts are retained, with optimistic revision checks on save. Quick Capture bootstraps settings without reading task and notification lists and saves through the same Store. Measurements are in the [window refresh record](qa/window-refresh-suspension-2026-11-13.md).

A crash between OS submission and SQLite acknowledgement can repeat a notification: Windows submission and the database cannot share a transaction. Idempotent event processing does not remove that external-side-effect boundary.

### In-app history

Mark read keeps the row and clears its unread flag. Dismiss records a retirement key and hides the row without deleting it. Clear read and clear all delete the confirmed rows after recording those keys. The confirmation list is the set of ids the user saw, so a reminder that arrives during the operation is kept. An update that is downloading or installing cannot be removed until that operation finishes. Nightly Settings can send a diagnostic toast from Advanced / Diagnostics, and only while that section is open. That section is Nightly-only. Its copy reports the notifier setting and whether Show was accepted.

The notification panel opens when the pointer rests in the last 12 pixels for 160ms, and it tucks away 350ms after the pointer leaves, unless it is pinned or focused. Pin state is `notification_panel_pinned`. Ctrl+Shift+N and the command palette open it as well. An unpinned panel overlays the content. Hiding it leaves each reminder's read state unchanged.

## Appearance, Glass, and editing menus

Native Glass is opt-in. Each window is created transparent and stays hidden until the saved appearance is applied. The default appearance is opaque. Clear uses a transparent WebView2 background with a CSS tint (`desktop_tint`, 35 to 90). Acrylic calls Tauri `set_effects` with the Acrylic window effect. Windows controls that blur. High contrast, or Windows advanced effects turned off, forces an opaque window. Theme families are Classic, Pitch Black, Ashen White, and Peach. Pitch Black resolves to dark and Ashen White to light. Peach keeps Light, Dark, and System.

Task and text menus use the Popover API when the webview provides it. A menu opened from a dialog is placed inside that dialog so it stays interactive. Clipboard actions use the Tauri clipboard plugin for read-text and write-text only, and only when the user chooses the action. Cut, paste, undo, and redo go through `document.execCommand` so WebView2 can keep its own undo buffer. Password fields and other specialized native controls keep the WebView2 menu.

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
- [Tauri clipboard](https://v2.tauri.app/plugin/clipboard/)
- [ToastNotifier.Show](https://learn.microsoft.com/en-us/uwp/api/windows.ui.notifications.toastnotifier.show)
- [`document.execCommand` editing constraints](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
