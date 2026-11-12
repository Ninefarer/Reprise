# Visual System 2.0

## Implementation

- Classic retains Light, Dark and System. Pitch Black resolves to dark; Ashen White resolves to light. The saved Classic appearance is retained when switching families.
- Preferences remain in the existing SQLite settings record, with backward-compatible defaults. Task tables and lifecycle semantics are unchanged.
- Shared CSS tokens and `material-menu` / `material-floating` primitives support Flat, Frosted and experimental Glass. Glass defaults to menus only; All floating surfaces and Off retain the saved material selection.
- Blur is bounded to 4–24px. Modal dimming/blur works independently of material. Nested modal filtering is limited to avoid unnecessary stacked blur.
- WebView2 backdrop filtering stays inside the native window. Unsupported effects retain opaque surfaces. Native select/date popups remain native. Windows advanced-effects preferences, reduced transparency, increased contrast and forced colors disable translucent surfaces.
- Native scrollbars remain draggable, with idle/hover/scroll styling. Windows auto-hide preferences are read through UISettings; unknown values default to persistent scrollbars. An Always visible override is available. No scrollbar replacement or layout-shifting overlay is used.
- Both webviews start hidden and apply saved theme/native background before showing. Shortcut requests arriving during capture initialization are retained.
- Locally bundled structured release notes support headings, category accents, nested entries and optional HTTPS links. Historical 0.1.0 content remains available. No updater was added.
- Installed-version comparisons use semver precedence, including prereleases and ignoring build metadata. First installs establish a baseline during onboarding; existing users see new notes at an idle Home view. Open editors, dialogs, menus, searches and other views defer the automatic dialog. Acknowledgment is persisted independently of other Settings edits.
- Sidebar branding was removed. A compact utility toggle shares the General heading row; navigation, collapse, resizing and fixed profile footer remain intact.
- Decorative page-header dates are hidden; release notes retain their release dates. Functional task dates, deadlines, notification timestamps and audit history remain available. Settings no longer displays the Your workspace eyebrow.

## Changed components

Frontend: `App`, `Sidebar`, `Preferences`, `AppearanceSettings`, `ReleaseNotes`, `changelog`, `theme`, `visuals`, `scrollbars`, shared material classes on existing dialogs/menus, semantic visual CSS and model types.

Backend: `visuals` manages validated visual preference patches, native appearance preferences and webview readiness. `releases` manages version precedence and acknowledgment. Existing main setup/snapshot/settings commands reuse these modules. Capabilities allow the supported native background-color API. Version metadata is 0.2.0; semver is the only added direct library dependency.

## Verification

- 86 frontend tests pass, including existing task actions/sidebar tests, fixed-family preference preservation, material changes without native theme re-registration, delayed/repeated release-note behavior, historical browsing and accent contrast in both fixed families.
- 28 Rust tests pass, including settings persistence, invalid visual values, release precedence and first-install behavior. Existing lifecycle, database migration, wake, notification deduplication, deletion and Undo tests remain passing.
- TypeScript/Vite build, Rust check and debug Windows executable build pass.
- Optimized Windows executable and NSIS installer build pass after the date-removal changes (`target/release/bundle/nsis/Reprise_0.2.0_x64-setup.exe`). The running debug instance was left open to avoid interrupting the user.
- Real Windows app checks covered Classic/System dark, Pitch Black, Ashen White, retained Classic preference, Glass coverage controls, blur slider, blurred command palette and keyboard shortcut, profile menu and first What’s New acknowledgment. Native title-bar appearance followed the resolved theme.

## Remaining manual checks

Computer Use was interrupted during restart verification. Final compact-sidebar layout, full restart persistence in the actual UI, Glass Off/Frosted visual comparison, live Windows theme toggling and accessibility preference toggling need a final manual pass. Persistence, native theme callbacks and sidebar interactions have automated coverage. The later date-removal changes passed frontend tests and production frontend build; their final native visual check is outstanding.

CSS effects do not blur other applications or the desktop. Native OS menus/pickers use opaque system styling. Existing notification activation and other earlier implementation boundaries remain documented in README; this visual pass does not claim to complete them.
