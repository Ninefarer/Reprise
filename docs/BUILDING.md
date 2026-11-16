# Building Reprise

[Documentation](README.md) · [Architecture](ARCHITECTURE.md)

Reprise is a Windows 11 desktop application using Tauri 2, Rust, React, TypeScript, Vite, and SQLite. Ordinary users should [download an installer](GETTING-STARTED.md); these instructions are for working on the source.

## Prerequisites

- Windows with Microsoft Edge WebView2 Runtime.
- Node.js supported by the checked-in Vite version, with npm.
- Stable Rust with the MSVC toolchain.
- Visual Studio C++ Build Tools, including the Windows SDK.

Run the commands below from the repository root. Keep the npm and Cargo lockfiles; do not update dependency versions merely to build.

## Run locally

```powershell
npm ci
npm run tauri -- dev
```

The default configuration uses the Stable identity, `com.reprise.desktop`. Development runs can therefore access that identity's local data. Do not use real personal task data for automated QA; use a separate Tauri identifier and temporary profile for tests. Close an installed instance before running a build with the same identity.

## Build Windows installers

Stable configuration:

```powershell
npm run tauri -- build
```

Nightly configuration:

```powershell
npm run tauri -- build --config src-tauri/tauri.nightly.conf.json
```

NSIS installers are written under `src-tauri/target/release/bundle/nsis/`. Building does not install or publish them. Nightly overrides the product name, version, app identifier, and icon configuration. Its identifier, `com.reprise.nightly`, gives it separate local data from Stable.

Official installers are signed by the approved GitHub Actions workflow. With updater artifacts enabled, a local installer build also needs the existing signing credentials in its environment; the public key in configuration cannot sign a build. Do not generate a replacement key or put credentials in a command, file inside the repository, or log. Contributors can use `tauri dev` and the checks below without the publisher's private key. See [signed update operations](UPDATES.md) for the artifact-only workflow and release gate.

Both channels use Ctrl+Shift+Space for Quick Capture. Run one at a time when checking that shortcut.

## Checks

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The frontend build includes TypeScript checks. Rust tests cover domain, persistence, scheduling, and notification logic. `installed_native_toast_probe` stays ignored unless `REPRISE_TOAST_TEST_ID` names an installed app identity. A passing Show means Windows accepted the payload. See [Architecture](ARCHITECTURE.md) for the Windows submission path.

Test runtime behavior separately on Windows, especially notification clicks, tray operation, native transparency, sleep/wake, and saved settings. Preserve real user tasks and clean up only test-owned data.

## Nightly web build

The Nightly PWA is a separate Vite build. It does not change `npm run build` or the Windows installer. `src/platform/types.ts` is the seam. `src/platform/tauri.ts` keeps the desktop commands. `src/platform/web.ts` is the browser implementation. Persistence goes through `src/platform/storage.ts`, which currently uses a localStorage placeholder.

```powershell
npm run dev:web
npm run build:web
npm run check:pwa
```

`dev:web` serves the app at `http://127.0.0.1:5173/Reprise/` so asset URLs match GitHub project Pages. The web build writes `dist-web/` and leaves `dist/` for Tauri. See [Nightly PWA](PWA.md) for what is implemented, what is intentionally left for other branches, and the Pages setup.

## Working and releasing

Development work belongs on `develop`. Do not merge, push, tag, publish, or replace installer assets without authorization. Follow [GitHub release conventions](RELEASING.md) for separate Stable and Nightly descriptions. Local changes and engineering notes are not evidence that a feature has shipped.
