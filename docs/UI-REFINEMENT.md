# UI refinement — November 9, 2026

## Completed

- Grouped sidebar with all 15 destinations, consistent stroke icons, active-page semantics and meaningful counts. Daily Review is a primary destination.
- Dedicated Settled and Snoozed pages backed by the same SQLite snapshot as the rest of the app. Returned tasks appear only in Resurfaced, not in the active paused views. Counts use the same selectors as their views.
- Settled cards show the original pause timestamp, recorded mode, wake time and countdown. Older timestamps are recovered from task history. Older modes were never stored and are explicitly labeled as unavailable.
- Shared task detail dialog and action handlers across cards, review groups and notification history. Native dialog focus containment, Escape dismissal, notes, dates, priority, tags/project, history and snooze presets. Right-click opens the same detail editor. Failed saves preserve the dialog and show the error.
- Daily Review groups Inbox, Resurfaced, today's plans, overdue tasks and due Waiting follow-ups with direct actions. Closed tasks are excluded.
- Semantic light/dark tokens replace inversion. Persisted System/Light/Dark preferences use Tauri Window.setTheme, Window.theme, onThemeChanged and a media-query fallback. Main and capture windows share theme behavior and refresh settings via events. Native date/select controls use color-scheme.
- Search remains reachable on every main page; Ctrl+K focuses it. Responsive cards, scrollable navigation, compact density and visible keyboard focus.
- Notification History includes category/unread filtering and task links. Windows submission states retain their existing meaning.
- Quick Capture retains the global shortcut, Enter submission and Escape hiding. Failed captures keep the typed text. Settings drafts no longer reset on scheduler refresh.

## Verification

- `npm run build`: passed.
- `npm test`: 9 tests passed (selectors, every sidebar destination, search availability, appearance persistence and native theme event handling).
- `cargo test --manifest-path src-tauri/Cargo.toml`: 11 tests passed, including legacy JSON compatibility and settlement metadata preservation in addition to existing lifecycle/scheduler/persistence tests.
- Windows executable and NSIS installer built successfully.
- Desktop checks: existing Settled records and history-derived timestamps; Daily Review; Settings; Light and System appearance; actual dark system palette; global capture shortcut; capture input and Enter; real SQLite capture; snooze presets/editor; Snoozed countdown; wake early into Do Now; settlement with new metadata; completion and immediate counts.
- A clearly named QA intention was created and finished. Existing personal tasks were not modified.

## Limits

- Runtime Windows OS theme toggling was not performed: the user's OS appearance was left alone. Native event handling is covered by automated tests; current Windows System mode and manual app appearance switching were exercised.
- Every destination is exercised in component tests; desktop spot checks focus on the changed workflows rather than claiming exhaustive visual coverage.
- Existing notification activation/action-button limitations remain outside this UI refinement. The scheduler and notification submission behavior are preserved.
- Legacy settlement mode cannot be reconstructed reliably. Future settlements record it without a database schema rewrite; optional JSON fields preserve compatibility.
- No guarantee of restoring focus to an arbitrary external application after capture; normal Windows focus behavior applies.

## File map

- `src/App.tsx`: application state, grouped destinations, review/card views and shared actions.
- `src/model.ts`: typed models, membership/search/countdown selectors.
- `src/navigation.tsx`: groups and dependency-free SVG icon set.
- `src/TaskDialog.tsx`: task editor, scheduling, snoozing and history.
- `src/Preferences.tsx`: stable settings form and appearance control.
- `src/theme.ts`: native and webview theme synchronization.
- `src/style.css`: semantic palettes and responsive component styling.
- `src/main.tsx`: application entry point.
- `src/*.test.*`: frontend regression coverage.
- `src-tauri/src/domain.rs`, `store.rs`: compatible settlement metadata.
- `src-tauri/src/main.rs`: save-settings refresh event and theme validation.
- `src-tauri/src/tests.rs`: metadata and compatibility tests.
- `src-tauri/capabilities/default.json`: native theme permission.
- `package.json` / lockfile: test and formatting development tools.
