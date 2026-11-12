# Stable 3.3.0 release record

## Scope

The owner selected integrated task/navigation context menus, working text editing, focused onboarding and replay, and original branding/repository presentation for Stable. Stable onboarding follows the saved theme; Nightly alone uses the star field and testing disclosure. The native notification permission-record fix and subsequent diagnostics/channel-history cleanup were not selected. Their local work is preserved separately on develop. Notification routing and Undo fixes already merged through PR #1 remain included.

The full user-facing record is [CHANGELOG.md](../CHANGELOG.md); the in-app entry is in `src/changelog.ts`. [GitHub notes](releases/3.3.0.md) use the original banners and the owner's supplied personal message. GitHub-only artwork does not change the in-app presentation.

## Automated checks

- `npm test`: 156 tests passed in 9 files, including Stable/Nightly onboarding separation and context-menu/clipboard regressions.
- `npm run build`: TypeScript and Vite production build passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 45 tests passed for the selected Stable source, with no ignored tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- Prettier checks passed for changed frontend components, styles, and release documentation.
- `npm run tauri -- build`: optimized Windows x64 executable and NSIS installer passed.
- `git diff --check`: passed. Changed documentation links were checked against their local targets.

The packaging version regression now checks 3.3.0 across npm, Tauri, Rust metadata and Cargo.lock while retaining historical release checks. Initial failures were the obsolete 3.2.0 expectation and a line-ending-sensitive lockfile assertion; both were corrected without removing checks.

## Windows and GitHub observations

- Installed the generated Stable NSIS package successfully with exit code 0. Installed file/product version is 3.3.0. The installed executable SHA-256 matches the executable extracted from that package.
- Launched the installed Stable app and observed the original Stable icon, 3.3.0 What's New entry, unchanged sidebar/task counts, and existing profile.
- Observed Stable onboarding in the saved Classic theme with no stars, main navigation, or Nightly label. Opened the shared editing menu on a profile text field.
- Prior isolated Windows QA for this same menu implementation verified real Cut, Undo, Redo, cross-field Paste, task-dialog Paste, persisted notes and task transitions, dialog layering, rapid retargeting, and light/dark/Clear Glass presentation; see [context-menu record](CONTEXT-MENUS.md).
- Backed up Stable's SQLite data before installation. Read-only comparison after installation confirmed existing task rows were unchanged; integrity and foreign-key checks passed.
- GitHub API verified the four uploaded banners against local Git blob hashes. A signed-in repository reader rendered all four in the committed release description, including ...HEY. Anonymous preview correctly could not access this private repository. Visibility remains private.
- NSIS archive inspection contains the application executable and installer helpers, without repository banners, source branding files, or README screenshots. Vite output contains only its HTML, JavaScript, and CSS assets.

## Artifact

- Installer: `Reprise_3.3.0_x64-setup.exe` (4,539,860 bytes).
- SHA-256: `7e475c2586ff53472104565f6cb21aa1fd5eadaca156d752614e30c621de080d`.
- Companion file: `Reprise_3.3.0_x64-setup.exe.sha256`.

## Boundaries

This pass does not connect a signed updater feed or provide terminated-process Windows toast activation. A new visible Windows notification test, physical trackpad gestures, multi-monitor DPI, older WebView2 Popover fallback, and a fresh Acrylic-specific desktop-composition pass were not repeated for this release. Native Clear/Acrylic code and task schema are unchanged. Existing channel data is not reset or imported. Windows may retain cached shortcut/taskbar icons until its cache refreshes.

The installer was built from runtime source at `2edd3c2567b89fd8327bc70a8911ef1e3032d9b2`; subsequent commits add the two onboarding regression cases and this documentation only. No runtime build input changed afterward.
