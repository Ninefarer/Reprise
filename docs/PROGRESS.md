# Reprise implementation record

- Inspected empty repository; Windows Rust and Node available.
- Architecture: Tauri 2, typed React UI, SQLite WAL with foreign keys. Rust owns all transitions, durable reminders and notification history.
- Resurfaced is independent queue membership. Waiting follow-ups retain Waiting status. Snoozing and settling preserve schedule and deadline.
- Native notifications use the maintained Tauri 2 plugin. Installed Windows testing is required; submission never means delivery.
- First release prioritizes durable lifecycle and scheduler. Advanced recurrence and notification activation need explicit verification before release.

- Frontend production build passed; Rust check passed; nine domain/storage tests passed.
- Connected task editing, lifecycle actions, notification history, onboarding, settings, tray and quick capture.
- Debug Windows executable build in progress. Full requirements are not yet complete; see README boundaries.

- Debug executable built and launched; process startup confirmed. UI behavior and native notification display have not been manually verified.
- Stopped the test process before packaging to release the executable file lock.

- Fixed startup race: configured windows now defer creation until after SQLite state is managed. Rebuilt NSIS installer; nine Rust tests pass.
- Verified onboarding loads in rebuilt app; user confirmed the app works.
- User screenshot confirms a native Windows toast was displayed. Notification activation/actions remain unverified.

- UI refinement completed: grouped navigation, Daily Review, active paused views, semantic themes and shared task editor. See docs/UI-REFINEMENT.md for verification and limits.

- Added Settings changelog. Search is now limited to task views and hidden in Settings/Notification History.
- Finished and Dropped task cards suppress context menus without opening details.
- Added confirmed permanent deletion from task details/actions. SQLite transaction removes task-owned history, notification records and scheduled events; children are retained and detached. Stale confirmations are rejected. Existing editors cannot recreate a deleted task.
- 14 frontend tests and 14 Rust tests pass. Previously submitted Windows toasts may remain in OS Notification Center; the confirmation explains this.

- Completed quality pass: local profile/cropped pictures, persisted sidebar, status-aware menus, distinct Resume/Start/Wake/Resurface operations, global command palette, Undo and native diagnostics. See docs/QUALITY-PASS.md.
- 41 frontend and 23 Rust tests pass. Desktop checked existing database, footer/menu, palette, sidebar controls, closed-task keyboard history, Undo and native notification submission. Real-photo and installed-identity checks remain documented manual verification items.

- Sidebar polish completed: General/Tasks/History/App, Space name presentation, independently persisted groups, accessible icon-rail tooltips, useful sidebar context actions and restrained scrollbar/divider.
- 47 frontend and 24 Rust tests pass; Windows executable and installer built. Real Windows checks covered names, group/rail/width/space persistence across full restarts, Ctrl+K, menu actions, themes and compact-height scrolling. Test values restored; user handles final window sizing. See docs/SIDEBAR-POLISH.md.

- Semantic colors completed: centralized dark/light palette, neutral labels/sage selection retained, status accents across existing task surfaces, separate teal review-queue membership.
- Notifications label and Waitin' for ya subtitle implemented without route changes. 70 frontend and 24 Rust tests pass; production frontend and Windows installer builds pass. Real Windows UI inspected in System dark and Light, with original preferences restored. See docs/SEMANTIC-COLORS.md.

- Visual System 2.0 adds persisted theme families, reusable floating materials, independent modal backdrops, native-compatible scrollbars and structured local release notes with version acknowledgment. Sidebar branding and decorative dates removed; Settings workspace eyebrow removed. 86 frontend and 28 Rust tests pass. Windows visual checks partially completed; remaining checks are listed in docs/VISUAL-SYSTEM.md.

- Removed the App navigation group. Settings stays in the profile menu; Notifications move into an edge-revealed right panel with independently persisted pinning, keyboard access, filtering and existing history/task actions. 90 frontend and 28 Rust tests pass. See docs/NOTIFICATION-PANEL.md.

- Finishing pass: neutral fixed families, curated interactive accents, saved motion preferences with Windows suppression, finite sidebar/menu/dialog motion, persisted-first completion feedback and deduplicated resurfacing highlights. Generic content eyebrows removed; recent navigation retained. 101 frontend and 28 Rust tests pass. See docs/FINAL-POLISH.md.

- Released 3.1.0: aligned all navigation counts, removed redundant toolbar utilities, added reliable notification slide-out and simplified notification row state presentation. 105 frontend and 28 Rust tests pass; optimized Windows executable and NSIS installer built. User will perform desktop checks. See docs/RELEASE-3.1.md.

- Added manual update checks and clickable, persisted in-app update notifications in 3.1.1. Official signed updater handles verified installation/restart; no feed is configured before repository setup, so checks explain that accurately. 110 frontend and 34 Rust tests pass. See docs/UPDATES.md.

- Added opt-in native Windows Glass using Tauri transparent windows and Acrylic. Real browser-through-window Clear transparency, native Acrylic blur, startup restoration and return to opaque defaults were visually verified. 111 frontend and 34 Rust tests pass; frontend, native check, debug and optimized NSIS builds pass. Remaining platform acceptance checks are documented in docs/NATIVE-GLASS.md. No new dependencies.

- Refined Glass into separate canvas/navigation/card materials with static edge reflections, modest elevations and denser readable controls. Subtle/Balanced/Crystal use existing tint persistence. Native effects and version 3.1.1 remain unchanged. 111 frontend and 34 Rust tests pass. See docs/GLASS-REFINEMENT.md for token values and desktop observations.

- Settings cleanup 3.1.1: conditionally render positive sidebar counts beside labels, correct capture inset/nested fill, retire legacy CSS material/coverage/blur controls and rendering, retain native Glass presets and modal backdrop, move live diagnostics behind an on-demand Advanced disclosure. 113 frontend and 34 Rust tests pass; frontend build, Rust check and Windows debug build pass. See docs/SETTINGS-CLEANUP.md for actual release UI observations and notification-display limits.
- Final optimized 3.1.1 Windows executable and NSIS installer rebuilt successfully after cleanup.

- Shipped 3.2.0 maintenance release: focused notification/scheduler modules, schema-3 retirement metadata, transactional dismissal/read/bulk clearing, human category labels, readable notification dock over native Glass, functional root-level density, daily-review empty/grammar/dedup/stale fixes, non-spamming unconfigured updater status, live-toast review routing, navigation scroll and Undo overlap fixes. 125 frontend / 39 Rust tests, strict Clippy, formatting, TypeScript/Vite and optimized NSIS builds pass. Installed and launched 3.2.0; real tasks/history preserved and backup retained. Isolated Windows QA covered density, native Glass, notifications and basic transitions; explicit limitations in docs/RELEASE-3.2.0.md.

- Refined 3.2.0 native Windows toasts and Quick Capture: category/task-specific single and grouped native payloads; Windows Show acknowledgment and Failed handling via existing Windows crate; borderless draggable capture shell, scoped controls, saving guard and capture-only scrollbar-gutter correction. 128 frontend/42 Rust tests, Clippy, formatting, TypeScript/Vite and NSIS build pass. Installed and visually checked capture; Windows history independently retains the exact grouped test payload. Banner visibility awaits user confirmation. Owned test data cleaned, real data preserved. See docs/NATIVE-TOASTS-CAPTURE.md.
