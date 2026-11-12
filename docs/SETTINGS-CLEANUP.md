# Settings cleanup - 3.1.1

## Causes and changes

- Sidebar: rendering every non-null count included zero. The count had auto margin, a 24px minimum width, and a flex-growing label. Positive counts now render conditionally beside their label; no badge elements are created for zero, null, or icon-only mode. Existing navigation row hit targets, semantic colors and tooltips remain.
- Quick capture: `.capture input` had zero horizontal padding. Native Glass then gave the input its own dense background inside the capture container. It now has a 12px text inset, flexible width/min-width zero, and a transparent background specifically inside capture. The plus/text gap and Enter submission are unchanged.
- Experimental Glass was an independent, older CSS backdrop-filter path for profile/context menus, command palette and task/delete/release dialogs. Coverage selected menus/all/off. Its blur slider adjusted CSS only, never Windows Acrylic. The material selector, coverage controls, slider, experimental section, dataset writes, CSS effects and unused tokens have been removed. Floating surfaces use their existing opaque baseline and native Glass edge treatment.
- Native Clear/Acrylic and layered canvas/sidebar/card materials are unchanged. Native intensity presets and custom tint remain functional. The separate Dim / Dim and blur / None modal backdrop remains, using a fixed internal 8px blur, with existing accessibility fallbacks. No adjustable native blur is claimed.
- Legacy material/glass_coverage/blur_intensity fields remain only in persisted settings and backend validation for round-trip compatibility. They no longer affect frontend rendering or appear in active VisualPreferences. No task schema or native integration changes.
- Diagnostics mount and poll only when Settings > Advanced / Diagnostics is expanded. Closing it stops polling. Test Windows notification stays alongside notification preferences. Errors clear on retry; submission feedback explicitly does not confirm display.

## Verification

Actual optimized Windows release inspected over a playing Brave video: zero sidebar counts gone, positive Daily Review/Snoozed/All Tasks counts beside labels, capture prompt inset and single surface, consolidated Appearance, collapsed Advanced disclosure and live diagnostics. Clear showed sharp video/browser content; switching back to Acrylic restored native external blur. Existing Crystal 38% / Pitch Black settings survived launch, Clear-to-Acrylic persisted and original Acrylic preference restored. No real tasks edited or deleted.

Live diagnostics reported Windows notifier Enabled, scheduler Running with current heartbeat, tray running and shortcut Registered. Test submission succeeded. The Windows toast was not observable through the available window capture, so current display is unverified; prior actual display was user-confirmed with a screenshot. No receipt is fabricated. Enabled notifier alone does not prove installation registration; existing installed app identity was not changed. Sleep/wake, terminated-process behavior and full Focus Assist/disabled-notification scenarios were not manually retested. Existing Rust reminder/deduplication/quiet-hour tests remain intact.

Frontend tests cover badge absence/positive counts/icon rail, removed controls, native intensity persistence, lazy diagnostics and test-notification failure/recovery. Full frontend/Rust checks and optimized Windows build results are recorded in PROGRESS.md.

Files: src/Sidebar.tsx, src/style.css, src/desktop-glass.css, src/AppearanceSettings.tsx, src/visuals.ts, src/model.ts, src/theme.ts, src/visual-system.css, src/Diagnostics.tsx, src/Preferences.tsx, src/App.test.tsx, src/visuals.test.ts, docs/SETTINGS-CLEANUP.md, docs/PROGRESS.md.
