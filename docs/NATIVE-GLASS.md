# Native desktop Glass

Uses the installed Tauri 2.12.5 transparent webview/window support and `set_effects` Acrylic API. No new dependencies or direct Win32 composition calls were added. Existing native window decorations, resizing, focus, taskbar, tray and capture paths are retained.

Windows are transparency-capable at creation, hidden until their saved appearance has been applied. Default appearance is still opaque. Switching backgrounds/effects uses the already-capable window rather than assuming the transparent flag can be changed live. Existing processes created by older builds require one restart.

Settings separates **Window appearance → Default / Glass** from the existing palette and floating-surface material. Native Glass offers Clear or Acrylic and a 35–90% application background tint. The tint is a CSS surface over a fully transparent WebView2 background, not an attempt to blur the desktop with CSS. Foreground cards, inputs, dialogs and Settings panels retain opaque surfaces. Windows controls native Acrylic blur and its title-bar rendering.

Preferences use backward-compatible defaults in the existing SQLite Settings record. Task schema and lifecycle are unchanged. Windows advanced-effects and high-contrast preferences cause an opaque fallback; CSS forced-colors/reduced-transparency preferences also retain opaque application surfaces. Theme/palette and floating-menu preferences are preserved.

## Verified here

- Real Clear transparency: browser video, text and browser controls were visible sharply through the Reprise window, including through main background and tinted sidebar.
- Real Acrylic: the same native window changed to a visibly blurred backdrop over the browser. This was native Windows composition, not React content underneath a translucent div.
- Initial launch restored Clear from persisted preferences; switching the saved material to Acrylic applied without recreating the window. Opaque defaults were restored after QA and visually verified. Real user tasks/profile were not altered.
- Frontend production build, Windows debug and optimized NSIS installer builds, 111 frontend tests and 34 Rust tests passed. Rust tests also cover persistence of native Glass options and rejection of invalid material/tint values.

## Remaining manual acceptance checks

Wallpaper-only positioning, resize/drag/maximize/minimize behavior with Acrylic, the full light/dark matrix, and live accessibility setting changes have not been exhaustively tested. Tauri documents Windows decoration/shadow caveats and native effect color limitations on Windows 11. These remain platform acceptance checks, not claims of verified behavior.

Modified files: native window creation and preference preservation in `src-tauri/src/main.rs`; native effect command and validation in `visuals.rs`; defaults/tests in domain/tests; frontend model/defaults/theme hook, Appearance Settings, and `desktop-glass.css` imported by App.

References: https://v2.tauri.app/reference/config/ and https://v2.tauri.app/reference/javascript/api/namespacewindow/ .
