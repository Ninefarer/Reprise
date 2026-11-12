# Reprise 3.1.0

Packaged Windows x64 release: `src-tauri/target/release/bundle/nsis/Reprise_3.1.0_x64-setup.exe`.

## Final fixes

- All left-navigation counts share padding, minimum width and right alignment. Semantic colors remain separate.
- Removed the redundant bell and Search & commands toolbar buttons. Ctrl+K (or the saved palette shortcut) remains available. Right-edge reveal, Ctrl+Shift+N and palette navigation still open Notifications.
- Notifications retain a noninteractive exit surface until the slide-out completes. Focus returns immediately, rapid reopening cancels the pending close, and animation Off/reduced motion closes immediately.
- Removed Submitted from ordinary notification rows. The underlying submission state remains stored independently from local Read state. Pending and failed submissions retain useful, plain-language indicators; technical state explanations remain in the expandable help and Settings diagnostics.
- Versions in npm metadata, Cargo metadata/lockfile, Tauri configuration and the locally bundled release notes use 3.1.0. Historical notes remain available. The application identifier, SQLite location, task schema and scheduler behavior are unchanged.

## Validation

- 105 frontend tests pass, including exit completion/reopening, immediate close with motion Off, keyboard access after toolbar removal, unchanged submission state after marking history read, version metadata, and earlier contrast/lifecycle/UI regressions.
- 28 Rust tests pass. `cargo check`, TypeScript/Vite production build and optimized Windows/NSIS packaging pass.
- Final desktop verification is left to the user at their explicit request. No Computer Use was performed for this release after that request. The running development app was not terminated or replaced through the UI.

Quit Reprise completely before installing the new package; the already-running development copy continues using its embedded older frontend until replaced/relaunched.
