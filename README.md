# Reprise

Later should actually arrive. A local Windows task workspace using Tauri 2, Rust, React, TypeScript and SQLite.

## Development

Install Node, stable Rust, Visual Studio C++ build tools and Windows WebView2. Run `npm ci`, then `npm run tauri dev`. `npm run tauri build` produces an NSIS installer. Run `cargo test --manifest-path src-tauri/Cargo.toml` for domain/storage tests and `npm run build` for the typed frontend build.

## Storage and scheduling

The authoritative database is `reprise.sqlite` in Tauri's app data directory for `com.reprise.desktop`. WAL, foreign keys, transactions, schema versioning and optimistic task revision checks protect persisted changes. Resurfacing is queue membership independent of lifecycle. Snooze and settlement retain schedule and deadline. Waiting reminders retain Waiting status. A Rust worker reconciles events every 15 seconds, including after startup, sleep or clock changes. Durable event IDs prevent repeated history entries and reminders. Quiet hours defer native submissions; multiple pending notifications are grouped. Daily review uses the current local calendar date. Next-day settlement resolves DST gaps forward and folds to the earlier instant; an already stored wake instant stays fixed after timezone changes.

Closing hides the main window by default; the tray process continues scheduling. **Quit completely stops reminders until the next launch.** Missed events are reconciled on launch. Notifications have Pending/Submitted/Failed states; Submitted is not proof of display. A crash between OS submission and database acknowledgement can cause a repeated notification because Windows submission and SQLite cannot share a transaction.

## Current implementation boundaries

This is an initial implementation, not yet a release satisfying the full requested specification. A user-provided screenshot confirms native Windows notification display. Notification activation has not been verified. Windows notification actions/activation routing, startup preference wiring, configurable shortcut registration, backup/restore/import/export, recurrence generation, subtasks/dependencies, calendar view, batch selection and notification history clearing remain unfinished. The currently registered shortcut is Ctrl+Shift+Space. Shortcut registration errors are reported in Settings diagnostics. The command palette supports Ctrl+K or Ctrl+Shift+P. Settings fields for unsupported integrations are not exposed as working controls.

## Windows acceptance checklist

Install the NSIS package before checking notifications: Tauri documents that Windows notifications require an installed app. Check a due reminder while visible and while hidden in the tray; confirm Focus/DND behavior and Windows permission settings. Confirm dismissal leaves Resurfaced untouched. Quit, let a reminder expire, then relaunch and check one reconciled queue entry. Test sleep/resume, clock changes and timezone changes. Verify single instance, capture shortcut, tray reopen and persistence after restart. Notification activation and action buttons are not implemented and must not be represented as passing.

API references: https://v2.tauri.app/plugin/notification/ Â· https://v2.tauri.app/plugin/global-shortcut/ Â· https://v2.tauri.app/plugin/autostart/



UI refinement details, file map and QA: [docs/UI-REFINEMENT.md](docs/UI-REFINEMENT.md).


Quality pass, file map and verification: [docs/QUALITY-PASS.md](docs/QUALITY-PASS.md).

Sidebar navigation refinement and verification: [docs/SIDEBAR-POLISH.md](docs/SIDEBAR-POLISH.md).

Visual System 2.0, component map and verification limits: [docs/VISUAL-SYSTEM.md](docs/VISUAL-SYSTEM.md).

Manual update checks, notification actions and future repository setup: [docs/UPDATES.md](docs/UPDATES.md).

Native Windows Clear/Acrylic Glass, implementation and verification limits: [docs/NATIVE-GLASS.md](docs/NATIVE-GLASS.md).
