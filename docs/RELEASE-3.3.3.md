# Stable 3.3.3 engineering record

Base: origin/main 5002cffad78a2fd9208d1dd43c0b0c80c07c3609. Targeted port from bac6001accc6f53c9d07365aef91e9f043e25a99; no develop merge.

Scope: Settings draft baseline/save/discard and error handling, modal choices before navigation, setup replay, profile-menu Quit and update installation, immediate-appearance distinction, sticky save bar, focused tests and 3.3.3 metadata/notes. Existing Stable copy, diagnostics, task lifecycle and native Windows behavior remain unchanged.

Verification (November 12, 2026):

- npm ci: passed, zero reported vulnerabilities.
- npm test: 168 passed across 10 files, including Settings keep/discard/save/failed-save, appearance-only clean state and update installation gated until save.
- npm run build: passed TypeScript and production Vite build.
- cargo test --manifest-path src-tauri/Cargo.toml: 48 passed.
- cargo fmt --manifest-path src-tauri/Cargo.toml --check: passed.
- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings: passed.
- node --test scripts/updater/manifest.checks.mjs: channel test passed; real-artifact check skipped locally before signed artifact exists. Signed release workflow and post-publication verification must validate real bytes/signature/signed version.
- git diff --check: passed. Dependency versions and updater backend/verifier/key/security configuration unchanged.
- Acceptance fingerprint matches 3.3.2 and repository variable: 330528a8f0aa36c4879a5eeffa884304950a2671b1aed8d5c96939b6c0e2a51c.
- Original immutable Bugfixes banner authenticated via GitHub contents API; blob 94962519a6074eb42972d8e3ce2de0be0275e9ca matches local Git object. GitHub Markdown API renders the expected image and Hotfix heading.

Limitations: no fresh Windows UI or installed-upgrade run in this worktree. Parent supplied actual isolated desktop verification for the same shared guard paths and previously accepted signed QA upgrade. Native tray/OS quit paths are outside the profile-menu Quit safeguard. No private signing material accessed. Stable publication uses existing signed-release.yml; Nightly publication remains the parent's responsibility.
