# Sidebar polish — November 9, 2026

## Completed

- Sidebar headings now read **General / Tasks / History / App**. Existing destination order, route values and lifecycle names are unchanged. The command palette reads the same destination catalog.
- Settings retains **Your space** and now labels the existing `workspace` field **Space name**. The profile subtitle uses its saved value, or **Personal** when blank. No database field, Rust type, API key or space-switching model was renamed or added.
- Four independently collapsible groups with SVG chevrons, `aria-expanded`, controlled content IDs and keyboard support. Left/Right collapse/expand; Enter/Space activate the native buttons. A collapsed group containing the current view keeps an active indication.
- Group state is saved in the existing SQLite-backed settings JSON under stable group IDs. Partial group updates merge on the backend, avoiding loss of unrelated group preferences. Full Settings saves preserve live sidebar preferences.
- Icon rail retains every destination even when an expanded-mode group is closed. Mouse and keyboard focus show portal-rendered, screen-reader-associated tooltips that are not clipped by the scrolling navigation.
- Preserved drag resizing, keyboard width adjustment, saved expanded width, collapse persistence and width restoration. Removed the immediate resize-end snap back to an older preference value while IPC was pending.
- Preserved the pinned profile footer, existing image/name controls and menu, without restoring the removed footer arrow.
- Sidebar right-click menus perform real actions: open a destination, expand/collapse its group, show only that group, expand/collapse all, collapse/expand the rail and reset expanded width. The rail offers only actions meaningful in rail mode. Menus use the same bounded, keyboard-accessible popup implementation as task menus.
- Compact aligned rows, subtle active/hover/focus states, a subdued thin scrollbar, and a 10px invisible resize target that paints only a 1px hover line. Existing light/dark semantic tokens are reused.

## Verification

- `npm test`: **47 frontend tests passed**.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **24 Rust tests passed**.
- TypeScript/Vite build, Windows executable and NSIS installer packaging passed.
- Existing task, review, notification, deletion, Undo, profile and Quick Capture regression tests remain passing.
- Actual Windows app checked with Computer Use:
  1. All four new headings and destination order visible.
  2. Your space / Space name visible in Settings.
  3. Temporary saved space name updated the profile subtitle immediately.
  4. Full Quit/relaunch retained that name. Original user value was restored and saved afterward.
  5. Tasks collapsed independently; the other groups remained available.
  6. Group context menu collapsed all groups. Those states survived a full Quit/relaunch; groups were expanded again after testing.
  7. Icon rail showed every destination with collapsed group preferences.
  8. Keyboard Tab focus displayed the Home tooltip without clipping.
  9. Drag resizing worked. Saved width and rail state survived another Quit/relaunch; expanding restored the resized width.
  10. Navigation scrolling in a compact-height window left the profile footer fixed and the main content independently positioned.
  11. Thin theme-aware scrollbar and one-pixel divider observed.
  12. No horizontal overflow observed in the exercised layouts.
  13. Sidebar context actions changed real group state and persisted it.
  14. Ctrl+K opened the palette; typing Settings and pressing Enter opened Settings while groups were collapsed.
  15. Light, Dark and System app preferences rendered correctly. System preference was restored.
  16. Automated tests passed after cleanup.

The original profile image and display name were preserved. No task data was changed. Temporary Python scripts and six superseded test executable copies were removed. The current executable and installer are retained.

## Limits

- Windows' own OS theme setting was not changed; the app's three appearance choices and current System palette were exercised. Existing native-theme-event regression coverage remains passing.
- Not every screen scale or window width was exhaustively tested. The user confirmed resizing was fine and requested no further resizing work; the final window size was left to the user.
- Native notification activation and other previously documented application limits are unchanged by this sidebar-only pass.

## Files

- `src/navigation.tsx`: visible group names and stable group IDs.
- `src/Sidebar.tsx`: grouped controls, rail tooltips, context actions and resize behavior.
- `src/PopupMenu.tsx`, `src/TaskMenu.tsx`: shared keyboard/pointer popup behavior; existing task action catalog retained.
- `src/Preferences.tsx`: Space name label; storage field stays `workspace`.
- `src/model.ts`, `src/App.tsx`: typed group preferences and existing IPC integration.
- `src/style.css`: compact groups, subdued scrolling/divider, focus and rail tooltip styling.
- `src/App.test.tsx`: group, persistence, space subtitle, context and tooltip regressions.
- `src-tauri/src/domain.rs`, `store.rs`, `main.rs`, `tests.rs`: compatible settings defaults, validated partial preference updates and persistence tests.
