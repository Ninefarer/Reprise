# Semantic task colors — November 9, 2026

## Implemented

- Visible **Notification History → Notifications** label, including sidebar, page title and command palette. The internal `Notification History` route remains unchanged.
- Notifications subtitle is **Waitin' for ya**.
- `src/task-colors.css` is the single palette source: the nine requested dark swatches, contrast-tested light counterparts, theme selection and shared category styles. No new dependencies.
- Task sidebar icons and counts use matching accents. Labels stay neutral, and active rows retain the existing sage background. Count surfaces preserve contrast even on selected rows; no category-colored row backgrounds.
- Existing icon rail, independent groups, widths, footer, tooltips and sidebar menus are preserved.
- Task cards have narrow accent edges, colored completion/status indicators and readable status badges, with neutral surfaces.
- Resurfaced review membership has a separate teal indicator and explicit label. Its underlying lifecycle badge remains intact; no lifecycle or schema changes.
- Semantic accents extend to detail/history badges, status selectors, contextual action icons, Home overview icons/counts, Daily Review groups, notification categories and filters, and queue headings/empty-state icons. General commands and unrelated notification categories stay neutral.
- Do Now and Finished retain distinct green shades. Settled is lavender; Snoozed is amber; Waiting is coral without error styling.

## Verification

- `npm test`: **70 frontend tests passed**.
- `cargo test --manifest-path src-tauri/Cargo.toml`: **24 existing Rust tests passed**. No Rust backend or schema changes in this pass.
- `npm run build`: passed; Windows executable and NSIS installer packaged successfully.
- Palette contract tests verify every supplied dark swatch, 4.5:1 contrast for category text on the intended count/badge surfaces in both themes, and 3:1 for selected-row category icons.
- Regression tests cover visible Notifications naming with the old route retained, neutral general navigation, matching category attributes on sidebar items, and lifecycle/queue indicators staying separate. Existing theme-event, sidebar, menu, task-action, deletion and Undo tests remain passing.
- Used Computer Use on the actual Windows app. Observed all nine sidebar accents, matching counts, neutral labels, existing active selection, colored icon rail and Home overview.
- Inspected existing Finished and Settled tasks: matching narrow card accents, distinct badges and countdown color, with neutral card surfaces.
- Opened the Settled right-click menu and dismissed it by keyboard without changing task state. Menu icon accents matched their target categories while labels stayed neutral.
- Verified Notifications page title, exact subtitle and existing persistent records.
- Switched the real app to Light, inspected sidebar and cards, then restored the original System preference and collapsed-sidebar preference. No task states or content were changed.
- One Computer Use capture temporarily returned “no monitor found for window” during theme switching. Refreshing the returned window binding and activating Reprise resolved it; light-mode inspection then succeeded.

## Limits

- Windows' own OS appearance setting was not toggled. System/native-theme-event handling remains covered by existing automated tests; the current System dark appearance and manual Light switching were visually exercised.
- The existing live database contains Finished and Settled tasks. Other card states and resurfaced membership were covered by automated fixtures; their sidebar colors were all inspected in the real app. No sample tasks were inserted into the user's database.
- No exhaustive multi-monitor/DPI or every-width inspection was performed. No horizontal overflow was visible in the inspected layouts. Window sizing was left to the user.

## Changed files

- `src/task-colors.css`, `src/taskColors.ts`: centralized palette and presentation-only category helpers.
- `src/model.ts`: display label mapping; internal route unchanged.
- `src/Sidebar.tsx`, `src/App.tsx`: semantic hooks on existing components, renamed page/subtitle.
- `src/TaskDialog.tsx`, `src/TaskMenu.tsx`, `src/PopupMenu.tsx`, `src/CommandPalette.tsx`: detail, filter and action-icon accents.
- `src/taskColors.test.mjs`, `src/App.test.tsx`: contrast, mapping, semantics and naming regression tests. The CSS contract test uses Node's built-in file reader without adding production dependencies.
- `src/changelog.ts`: release notes.

Temporary typing files were removed, and no patch scripts remain. The prior test executable copy was removed after closing the previous app. The new executable and installer are retained.
