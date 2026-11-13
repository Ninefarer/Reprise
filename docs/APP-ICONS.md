# Native application icons

Stable uses the original `assets/branding/reprise icon.png`; Nightly uses `assets/branding/reprise nightly icon.png`. The supplied artwork is unchanged. Windows ICO and desktop PNG derivatives live separately under `src-tauri/icons/stable/` and `src-tauri/icons/nightly/`.

`tauri.conf.json` selects Stable derivatives. `tauri.nightly.conf.json` overrides the complete icon list and NSIS installer/uninstaller icons with Nightly derivatives. Tauri embeds the configured ICO in the Windows executable and uses it as the default native window icon. The tray now clones that configured default icon instead of drawing a solid-colored square, so it follows the selected build channel without separate runtime channel logic.

Generate derivatives with the existing official Tauri CLI: `npm run tauri -- icon "assets/branding/reprise icon.png" --output <temporary-stable-directory>` and the corresponding Nightly source/output. Retain `icon.ico`, `icon.png`, `32x32.png`, `128x128.png`, and `128x128@2x.png` in each channel directory. The CLI also creates platform outputs for unsupported targets; do not add those to this Windows-only project. No image generator or new dependency is needed. Do not redraw or change original artwork.

The ICOs contain 16, 24, 32, 48, 64 and 256 pixel layers. These are derived native application resources, not GitHub release banners. Original high-resolution branding, wordmarks and release banners are not added to Vite public assets or Tauri resource globs.

Build Windows Nightly with `npm run tauri -- build --config src-tauri/tauri.nightly.conf.json`; build Stable with `npm run tauri -- build`. Neither command installs the result. Windows can cache taskbar/shortcut icons for an existing installation. Native icon appearance after installing an updated build still needs a user check; this integration does not change installed shortcuts or clear the Windows icon cache.

## Diagnosing an old desktop icon

Inspect the actual installed executable and shortcut before blaming the cache. The locked `tauri-build` 2.7.4 selects the first `.ico` from the merged `bundle.icon` configuration; `icons/icon.ico` is only its fallback. The root ICO is legacy artwork, but is not selected by either channel configuration. Do not replace approved channel artwork or change the build script based on the fallback's existence alone.

On Windows, the standard-library Python verifier compares every frame's dimensions, depth, size and complete image bytes directly against the approved ICO, bypassing Explorer. The Windows resource compiler normalizes the ICO planes header from 0 to 1; that field is excluded. It maps PE files as data and never starts them:

```powershell
python scripts/icons/verify-windows-icon.py --ico src-tauri/icons/nightly/icon.ico "$env:LOCALAPPDATA/Reprise Nightly/reprise.exe"
python scripts/icons/verify-windows-icon.py --ico src-tauri/icons/stable/icon.ico "$env:LOCALAPPDATA/Reprise/reprise.exe"
# Use --resource-id 103 for an NSIS installer or installed uninstall.exe.
# Default resource ID 32512 is the Tauri application icon.
```

The stock NSIS template creates desktop and Start Menu links with the executable target and no separate icon path. Update mode normally preserves existing links (with migration handling for renamed binaries). Installer/uninstaller icons do not control the desktop shortcut. See the [2026-11-12 investigation](qa/windows-icons-2026-11-12.md) for release binary evidence and a scoped desktop remedy.
