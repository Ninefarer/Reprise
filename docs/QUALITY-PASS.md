# Quality and interaction pass — November 9, 2026

## Inspection and scope

Kept Tauri 2, SQLite, Rust scheduling, existing task lifecycle, notification submission, grouped navigation, shared task editor, deletion confirmation, theme handling and Quick Capture. Existing code already provided transactional deletion, history, per-view task selectors and persisted settings. Extended these paths rather than adding a second state store or replacing the application.

## Features

- **Local profile:** pinned sidebar footer with an initial-based fallback or circular image, display name and workspace; compact Profile / Appearance / Settings / Quit menu. Onboarding and Settings use the same fields and image controls. Changes refresh both windows through the existing event/snapshot path.
- **Pictures:** choose PNG/JPEG/WebP, crop using zoom and horizontal/vertical controls, replace or remove. Canvas emits a 256×256 PNG; Rust validates decoding, dimensions and resource limits before writing a UUID-named file under the app data `profile` directory. No original file dependency, remote image service or account.
- **Sidebar:** independently scrolling navigation, fixed footer, persisted collapse and width (190–340px), pointer resizing and keyboard resize with the separator's Left/Right keys. Labels remain available to assistive technology when collapsed.
- **Task menus:** one shared status-aware action catalog for mouse right-click, Shift+F10, overflow buttons and palette task actions. Menus stay within the window and support arrows, Home/End, Enter and Escape. Finished and Dropped now have Reopen/Restore, View History and Delete Permanently, superseding the earlier no-right-click behavior. Closed cards open a read-only detail/history panel.
- **Resume:** Rust searches persisted transition history for the prior Inbox, Do Now or Scheduled state. A prior Scheduled state requires a retained schedule. Missing or unusable history falls back to Inbox; Settings documents this.
- **Start Now:** explicit Do Now transition using the existing save command, clearing wake/review state while preserving schedule/deadline and history.
- **Wake Now / Resurface Now:** Rust transaction keeps the paused lifecycle, clears the wake time, records review reason/time and history, consumes the pending wake event and cancels pending pause-notification submissions. No implicit Do Now and no extra native notification for a deliberate manual action.
- **Deletion:** retained and regression-tested existing atomic deletion of tasks, owned history, events and in-app notification records; children survive detached. Deleted records cannot be recreated by stale editors. Submitted Windows notifications cannot reliably be recalled by this operation; the confirmation explains that limit.
- **Search:** compact per-view filtering with Clear; global search and navigation through the palette on every page, including Settings and Notification History. Global results span all lifecycle statuses with status filters. Task pages default to their own membership.
- **Command palette:** Ctrl+K by default, or Ctrl+Shift+P in Settings; find tasks, navigate all destinations, create an Inbox task from the query, and execute relevant actions. Native dialog containment, explicit input focus, keyboard selection and scrolling.
- **Undo:** 30-second affordance for transitions; Rust verifies revision, history and elapsed time. It refuses stale, repeated, expired or inappropriate reversals. Restores persisted task state and records `Undone`. It does not recall OS notifications or undo permanent deletion.
- **Diagnostics:** native notification test with a persistent history entry, live scheduler heartbeat and errors, tray-process state, shortcut errors, last submission, recent persisted submission errors, application identity and the Windows ToastNotifier settings result. It never labels submission as delivery or user interaction.
- **Appearance/layout:** existing semantic light/dark palette extended to every new control; smaller empty states, bounded menus, compact action rows, accessible focus, responsive sidebar/content widths and typed/format-checked modules.

## Reliability fixes

- Consumed wake events now get a new durable episode identifier when rearmed by Undo. Scheduled/deadline reminders retain their existing stable IDs.
- Editing an already surfaced task no longer rearms an expired wake timer.
- Pending pause notices are cancelled when changing the pause state.
- Snapshot refresh requests arriving during an in-flight load are queued rather than lost.
- Settings saves preserve current managed-image and sidebar metadata, avoiding overwrites from an older open form.
- Database migration to version 2 adds persisted notification error text. Newer unknown schema versions are rejected rather than overwritten. Legacy task/settings JSON remains readable.
- Profile/workspace names are trimmed and length-checked. Image paths are generated locally and validated before reading/removing.

## Tests and desktop checks

- `npm test`: **41 frontend tests passed**. Coverage includes all context-action catalogs and lifecycle views, right-click and keyboard menus, deletion confirmation/cancel/error, per-view filtering, global search from Settings, palette actions, Undo IPC, profile footer, sidebar preferences, theme persistence/events and Quick Capture focus/Enter/Escape/error handling.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **23 tests passed**. Existing scheduler/lifecycle/deletion tests plus Resume/fallback, manual wake/resurface consumption, Undo guards/rearming, no rearming on edits, profile/sidebar persistence, PNG validation/managed-file persistence and v1→v2 migration.
- TypeScript/Vite production build and Windows executable/NSIS packaging passed. TypeScript now also checks unused imports/parameters.
- Ran the Windows app with the existing database. Observed the profile footer/menu, shared Settings fields, dark System palette, Ctrl+K palette, collapse/expand, drag resizing, and native diagnostics. Tested right-click on the existing Finished QA task, arrow/Enter navigation into history, Reopen followed by Undo, and correct counts. The QA task was restored to Finished.
- Tested native notification submission from Settings. The history count and last submission changed; the UI accurately said Submitted, without claiming display. The development app's own Windows identity lookup returned “Element not found”; this is surfaced with installation guidance rather than hidden.

## Manual verification limits

- Real-photo choose/crop/replace/remove controls are implemented; a complete real-photo round trip through the Windows chooser was not performed. Backend PNG validation and managed-file persistence are tested.
- Windows' OS theme setting was not changed. Existing theme-event tests pass, and the current System dark appearance was checked.
- Install the package to verify Windows identity/permission status for the installed application. A successful notification test is not a display receipt. Existing notification activation/action-button support remains outside this pass.
- Normal Windows focus return applies when Quick Capture hides; arbitrary external-app focus restoration is not guaranteed.
- The command shortcut is configurable between two supported in-app choices. The existing global Quick Capture shortcut remains Ctrl+Shift+Space.
- Full process exit stops reminders. Existing startup reconciliation and tray behavior are unchanged.

## Changed files

- `src/App.tsx`, `src/TaskDialog.tsx`, `src/Preferences.tsx`: integrate existing state, settings and task operations.
- `src/Sidebar.tsx`, `src/Profile.tsx`: profile, cropping and sidebar controls.
- `src/taskActions.ts`, `src/TaskMenu.tsx`, `src/CommandPalette.tsx`: shared action catalog and keyboard interaction surfaces.
- `src/Diagnostics.tsx`, `src/model.ts`, `src/style.css`, `src/changelog.ts`: diagnostics, types, styling and release notes.
- `src/App.test.tsx`, `src/taskActions.test.ts`: new and updated UI regression coverage; existing selector tests retained.
- `src-tauri/src/actions.rs`, `profile.rs`, `diagnostics.rs`: backend task operations, managed images and runtime diagnostics.
- `src-tauri/src/main.rs`, `store.rs`, `domain.rs`, `tests.rs`: wire commands, migration, settings and tests.
- `src-tauri/Cargo.toml`, `Cargo.lock`: bounded PNG decoding/base64 and Windows notification-setting API dependencies.
- `src-tauri/tauri.conf.json`: permits local blob image previews; network CSP remains restricted.
- `tsconfig.json`, `README.md`, `docs/PROGRESS.md`: checks and documentation.
