# Windows desktop icon investigation, 2026-11-12

## Finding

No legacy icon packaging bug was reproduced in the published Stable 3.3.3 or Nightly 3.3.3-nightly.20261112.1 installers. Their application executables, installers, and installed uninstallers contain all six frames of the correct approved channel ICO, byte-for-byte. Installed app executables also contain the correct icons. The user reports the updated tray icons and the old icon only on the desktop. The Nightly desktop link points to the correct installed Nightly executable without an icon override. These findings support stale Explorer shortcut presentation; the shell's internal cache state was not inspected and a visual remedy was not applied or verified.

No app was stopped, installed, upgraded or launched. No shortcut, user data, shell cache, release asset, tag, artwork or performance QA process was changed. This investigation ran in the separate `t3/fix-windows-channel-icons` worktree based on develop `68ef81e`.

## Binary evidence

Downloaded the two public release installers and extracted them with 7-Zip, without executing them. Installer SHA256 values match the supplied immutable release hashes:

- [Stable 3.3.3](https://github.com/Ninefarer/Reprise/releases/tag/v3.3.3), source `bd3066245d3270718c68a2d157765fc60e7e65dd`: `45fd1d342cc712d739157797ece9376ecf76d5c1cc60895aca5ff7e9ee4a5123`.
- [Nightly](https://github.com/Ninefarer/Reprise/releases/tag/v3.3.3-nightly.20261112.1), source `bac6001accc6f53c9d07365aef91e9f043e25a99`: `bf8842bd9b2741e5a545a81e2afbcf51564e92d8cbf3a9ac992e63531b52acf5`.

Read PE resources using `LoadLibraryExW(LOAD_LIBRARY_AS_DATAFILE)`, `FindResourceW`, and `LoadResource`, bypassing Explorer. App group ID is 32512; NSIS installer/uninstaller group ID is 103. Each group contains six frames (16, 24, 32, 48, 64, 256 pixels). SHA256 of concatenated frame image bytes in group order:

- Stable approved ICO, published installer, extracted app, installed app, installed uninstaller: `ceda5eee5b3276dbd8c9da222775ae2d356ee4e4902e9930f413763f926aa04f`.
- Nightly equivalent five resources: `5e1c816c29741f0e185b6c233787ee512f3f8a3a0cca7b6f6082f3496e86d801`.
- Legacy root ICO payload, absent from both application resources: `833e36acb08b96f9f358ce8519f61f4e329b2784a0f774a2273fdace19919d6b`.

Whole-file hashes differ from those payload hashes. Approved ICO file hashes: Stable `0668da6b9cc95e347affdae280420d3064959341f3c90415a644b9babb536dc9`; Nightly `3604110be61834d67a946d7dd6ebd534cbd0fd022aedc093491fb3bc147f9bbd`.

Extracted Stable app SHA256: `c968edfdd08aa7a01136979665b4b177f9556743fb6f876c850f06274011cd50`. Installed Stable was version 3.3.0, SHA256 `b74c2aac456d02a2d3ce28273e5213aad79b17eb641e229c774090b916a930ad`; it nevertheless has identical approved Stable icon frames. Installed Nightly is byte-identical to the extracted published Nightly app: `a475ac7a5de2c8820a087345f6c2aef955491b027e6775070ab7cccab3af4a95`. Do not infer that the latest Stable is installed from this icon check.

Branding and channel icon files have no differences against either supplied release source commit. No artwork was regenerated.

## Shortcut and build path evidence

Read existing links via `WScript.Shell.CreateShortcut` getters only, without `Save`:

- Desktop `Reprise Nightly.lnk`: target `%LOCALAPPDATA%\Reprise Nightly\reprise.exe`, `IconLocation` is `,0` (no explicit icon source).
- Start Menu `Reprise Nightly.lnk`: same target and icon setting.
- Start Menu `Reprise.lnk`: target `%LOCALAPPDATA%\Reprise\reprise.exe`, same icon setting. No Stable desktop link was found in the inspected user Desktop.

The locked `tauri-build` 2.7.4 source selects the first configured `.ico` and only falls back to `icons/icon.ico` when none is configured. Both channels configure their own ICO. Actual binaries confirm that selection; no explicit `window_icon_path` override is needed.

The locked Tauri CLI is 2.12.4. Its [NSIS template](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi#L959) creates links without an icon override. `/UPDATE` and `/NS` skip ordinary shortcut creation; migration can update targets and return early. Thus an updater can retain the existing link. Installer and uninstaller artwork are configured independently and already correct. No custom NSIS template or hooks are configured here.

## Verification and scoped remedy

`scripts/icons/verify-windows-icon.py` passed on both extracted apps, both installed apps, both published installers, and both installed uninstallers. Negative controls correctly rejected the legacy ICO and Stable ICO against the Nightly app. It checks dimensions/depth/size and all image bytes, excluding only the planes header normalized by the Windows resource compiler. No Rust/frontend code changed, so no new build, Rust suite or UI automation was run.

The least disruptive next user check is desktop Refresh (F5). If the stale image remains, use the affected desktop shortcut's Properties > Change Icon, browse explicitly to `%LOCALAPPDATA%\Reprise Nightly\reprise.exe`, select its icon and Apply. This confines the change to that link; it does not require stopping the app, touching Start Menu links, reinstalling either channel or deleting global Windows icon caches. It is a proposed remedy, not a verified visual fix. If necessary, create a fresh desktop shortcut to that same EXE under a temporary different name to distinguish a stale existing link display from the executable resource. Preserve the old link until the replacement is visually checked.

No cache manipulation or shortcut changes were performed autonomously. No new release is required by the observed packaging evidence.
