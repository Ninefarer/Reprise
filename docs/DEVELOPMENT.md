# Unreleased - develop

First development push after stable 3.2.0.

## Confirmed fixes

- Native notification activation previously ignored its task ID and always opened Notifications. It now fetches the current task snapshot and opens the matching task details. If a task editor or modal is already open, the task is queued until that workflow closes. A missing task falls back to Notifications. Regression coverage checks correct task selection and preservation of an unsaved editor.
- Quiet hours can leave Scheduled/Deadline notifications Pending after their events have been processed. Finishing/dropping a task previously cancelled only pause/follow-up notices, allowing obsolete start/deadline toasts to send later. Terminal transitions now cancel all queued notices for that task. Rescheduling or removing a deadline cancels only the obsolete queued start/deadline notices; an edit that keeps the same dates preserves valid queued reminders. Existing submitted history is untouched.

No schema, version, release asset, or user-data changes. No installer was installed for these development fixes. Windows visual/banner activation was not manually replayed; behavior is covered by frontend integration and real SQLite tests.

Validation: 130 frontend tests, 44 Rust tests, TypeScript/Vite build and strict Clippy pass. Formatting and git diff checks pass.
