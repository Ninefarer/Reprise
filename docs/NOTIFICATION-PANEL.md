# Notification panel

- Left navigation contains General, Tasks and History. The obsolete App group is removed. Settings remains in the profile menu; Settings and Notifications remain available in the command palette.
- Notifications reuse the existing persisted history, category/state labels, read command and task details. No task lifecycle or notification scheduling changes.
- Moving the cursor into the final 12px of the app's content width reveals the panel after 160ms. Leaving it tucks it away after 350ms, unless pinned or keyboard focus remains inside. The gesture observes pointer movement without intercepting native scrollbar dragging. Dialogs and task menus suppress edge activation.
- The pin button saves `notification_panel_pinned` in the existing SQLite Settings record. Profile preference saves preserve the latest pin state. Unpinned panels overlay the content; pinned panels reserve space on wide windows and remain overlays on narrow windows.
- The bell button, keyboard focus target, Ctrl+Shift+N and command palette provide alternatives to the pointer gesture. Escape closes an unpinned panel and restores focus. The pin state is independent of temporary visibility; hiding or leaving the panel never marks a reminder read.
- Added chronological browsing, local notification search, category/unread filters and explicit empty results inside the panel. Mark read and Open task retain their persisted behavior.

Implementation: `NotificationSidebar.tsx`, `notification-sidebar.css`, App/navigation/palette wiring, Settings field and independent `notification_panel_preferences` backend command. Legacy internal utility route names and saved sidebar group keys remain readable.

Verification: 90 frontend tests and 28 Rust tests pass; TypeScript/Vite, Rust check and Windows debug executable builds pass. Regression tests cover edge reveal/hide, modal suppression, pinning/remount, filters/read/task links, keyboard and command-palette routing, profile access and existing sidebar/task behavior. Pin persistence is included in the Rust settings reopen test.
