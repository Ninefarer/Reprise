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

The frontend build includes TypeScript checks. Rust tests cover domain, persistence, scheduling, and notification logic. Development branches may also contain an explicitly ignored real Windows toast probe; it is not part of the selected 3.3.0 Stable source. See [the local notification cleanup record](SETTINGS-NOTIFICATION-CLEANUP.md) for that separate work. A passing submission test is not proof of visible display.

Test runtime behavior separately on Windows, especially notification clicks, tray operation, native transparency, sleep/wake, and saved settings. Preserve real user tasks and clean up only test-owned data.

## Working and releasing

Development work belongs on `develop`. Do not merge, push, tag, publish, or replace installer assets without authorization. Follow [GitHub release conventions](RELEASING.md) for separate Stable and Nightly descriptions. Local changes and engineering notes are not evidence that a feature has shipped.
