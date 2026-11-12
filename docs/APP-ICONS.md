# Native application icons

Stable uses the original `assets/branding/reprise icon.png`; Nightly uses `assets/branding/reprise nightly icon.png`. The supplied artwork is unchanged. Windows ICO and desktop PNG derivatives live separately under `src-tauri/icons/stable/` and `src-tauri/icons/nightly/`.

`tauri.conf.json` selects Stable derivatives. `tauri.nightly.conf.json` overrides the complete icon list and NSIS installer/uninstaller icons with Nightly derivatives. Tauri embeds the configured ICO in the Windows executable and uses it as the default native window icon. The tray now clones that configured default icon instead of drawing a solid-colored square, so it follows the selected build channel without separate runtime channel logic.

Generate derivatives with the existing official Tauri CLI: `npm run tauri -- icon "assets/branding/reprise icon.png" --output <temporary-stable-directory>` and the corresponding Nightly source/output. Retain `icon.ico`, `icon.png`, `32x32.png`, `128x128.png`, and `128x128@2x.png` in each channel directory. The CLI also creates platform outputs for unsupported targets; do not add those to this Windows-only project. No image generator or new dependency is needed. Do not redraw or change original artwork.

The ICOs contain 16, 24, 32, 48, 64 and 256 pixel layers. These are derived native application resources, not GitHub release banners. Original high-resolution branding, wordmarks and release banners are not added to Vite public assets or Tauri resource globs.

Build Windows Nightly with `npm run tauri -- build --config src-tauri/tauri.nightly.conf.json`; build Stable with `npm run tauri -- build`. Neither command installs the result. Windows can cache taskbar/shortcut icons for an existing installation. Native icon appearance after installing an updated build still needs a user check; this integration does not change installed shortcuts or clear the Windows icon cache.
