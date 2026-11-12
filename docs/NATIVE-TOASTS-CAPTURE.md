# Native toast and Quick Capture refinement - 3.2.0

## Windows notifications

This refinement concerns Windows toasts, not the local notification-panel presentation. `src-tauri/src/toasts.rs` centralizes native content. Single reminders name the intention and distinguish scheduled starts, expired snoozes, returning settled work, Waiting follow-ups and deadlines. Daily Review keeps its generation-time count. Grouped toasts list up to three category/task details plus a remainder count, replacing the generic invitation to open Reprise. Deadlines and Waiting reasons provide extra context where available. Titles are bounded without splitting Unicode characters; XML escapes user text and filters XML-invalid controls.

Inspection of installed tauri-plugin-notification 2.8.0 found that its desktop tracked send spawns a thread, then silently returns when notification.show fails. Its initial return was insufficient evidence of Windows accepting the toast. On Windows, the existing windows crate now sends ToastGeneric XML directly through ToastNotificationManager/ToastNotifier.Show using Reprise's installed identity. Disabled notification settings and synchronous rejection return errors to the scheduler. Native Failed events persist asynchronous errors and refresh the UI. Submitted still does not mean displayed or seen. Windows continues to control Focus/Do Not Disturb and permission behavior.

The durable Rust scheduler, quiet hours, category preferences, deduplication and local history remain authoritative and unchanged. Activated callbacks reuse the existing persisted interaction/navigation handler; no lifecycle transition or review acknowledgment is inferred from submission/dismissal. At most 32 native toast references/callback pairs are retained, with handlers removed on eviction. This supports the running process only; no COM activator for terminated-process launches was added. Notification Center activation and real live-banner activation were not verified during this pass. The old notification plugin remains as the non-Windows fallback, with no new dependency version; only Data_Xml_Dom/Foundation features were enabled on the existing Windows dependency.

## Quick Capture

Capture alone now uses decorations=false, a 560x200 centered utility window, native shadow, no resize/maximize/minimize controls and no separate taskbar entry. Main-window decorations are preserved. `src/QuickCapture.tsx` provides a small draggable header, Inbox destination, explicit close button and Enter/Escape hints. Dragging permission is scoped to the capture window in its own capability. Shared capture logic remains in App; there is no duplicated capture state or persistence path.

Successful capture clears the text and hides the window after SQLite success. A database error preserves the text/window. The close button and Escape hide the draft without saving it; a synchronous in-flight guard prevents duplicate Enter submissions. Controls show Saving and cannot close via Escape during a pending save. Errors from native hide/drag commands are surfaced.

The right-hand gap was the shared html scrollbar-gutter:stable rule reserving scrollbar space in this non-scrolling utility window. A capture-only :root:has(.quick) rule sets gutter:auto and hides document overflow. The installed window was visually checked after the correction and the user confirmed the improvement. The dashboard/sidebar scrollbar rules remain unchanged.

## Checks and actual Windows observations

- 128 frontend tests pass, including borderless/scoped capability configuration, repeated-submit guard, retained draft on close, save failure, Enter success and Escape behavior.
- 42 Rust tests pass, including native content categories, grouped details, Daily Review content, XML escaping and Unicode title limits.
- Strict Clippy, Rust format check, frontend formatting, TypeScript/Vite and optimized NSIS build pass.
- Installed build opened borderless capture via Ctrl+Shift+Space from Brave. The input received focus. Enter persisted exactly one owned QA task in Inbox and hid the window.
- The actual scheduler, with the main window tucked into the tray, submitted two owned test reminders. Both were Submitted with no error. Windows ToastNotificationManager.History.GetHistory for com.reprise.desktop independently returned the exact native ToastGeneric payload: title "2 reminders to review", body "Scheduled: QA: plan tomorrow" and "Follow-up: QA: check a reply". This proves Windows retained the toast, not that a visible banner appeared.
- The user did not notice the banner and intends to check later. Visible banner delivery remains unconfirmed. No Windows notification/privacy settings were changed.
- Removed only the owned QA capture task and two local test rows. The native test toast is intentionally retained in Windows Notification Center for the user's inspection. Real tasks, preferences and timers were not modified.
- Rebuilt, installed (NSIS exit 0) and launched the final 3.2.0 build. Visually verified the gutter-free capture window. Live drag motion, full light/clear background matrix and fresh native click activation were not manually verified.

Files: new src-tauri/src/toasts.rs, src-tauri/src/scheduler.rs, diagnostics.rs, main.rs, src-tauri/Cargo.toml (existing dependency feature flags), src-tauri/tauri.conf.json, new src-tauri/capabilities/capture.json; new src/QuickCapture.tsx, src/App.tsx, src/style.css, src/App.test.tsx, src/visualPolish.test.mjs; docs/NATIVE-TOASTS-CAPTURE.md and PROGRESS.md. Version remains 3.2.0; task schema unchanged.

References: https://learn.microsoft.com/en-us/uwp/api/windows.ui.notifications.toastnotifier.show and https://v2.tauri.app/reference/config/ ; exact installed API signatures verified against windows 0.62.2 and Tauri 2 sources.
