# Unreleased - develop

First development push after stable 3.2.0.

## Confirmed fixes

- Native notification activation previously ignored its task ID and always opened Notifications. It now queues the task ID and fetches its current snapshot only when the existing workflow closes, with cancellation of superseded requests. Deleted tasks fall back to Notifications rather than reopening a stale copy. If a task editor or modal is already open, the task is queued until that workflow closes. A missing task falls back to Notifications. Regression coverage checks correct task selection, preservation of an unsaved editor and deletion while activation is queued.
- Quiet hours can leave Scheduled/Deadline notifications Pending after their events have been processed. Finishing/dropping a task previously cancelled only pause/follow-up notices, allowing obsolete start/deadline toasts to send later. Terminal transitions now cancel all queued notices for that task. Rescheduling or removing a deadline cancels only the obsolete queued start/deadline notices; an edit that keeps the same dates preserves valid queued reminders. Existing submitted history is untouched.

- Undo now restores only the pending reminders cancelled by the transition being undone. Cancellation IDs are recorded as additive history JSON metadata, not in task data. Already submitted, retired/dismissed or deleted history is never re-created. Task/history/queue changes remain in one SQLite transaction.

No database schema, stable version, release asset, or user-data changes. No installer was installed for these development fixes. Windows visual/banner activation was not manually replayed; behavior is covered by frontend integration and real SQLite tests.

Validation: 131 frontend tests, 45 Rust tests, TypeScript/Vite build and strict Clippy pass. Formatting and git diff checks pass.


## First nightly

The separately packaged test channel uses product name Reprise Nightly, version 3.2.1-nightly.20261112 and app identity com.reprise.nightly. It installs beside stable and uses a separate database; it does not import real tasks automatically. Quit stable before testing the shared Ctrl+Shift+Space shortcut. This is an opt-in testing artifact, not a replacement for stable 3.2.0. Stable main/release remain unchanged.
