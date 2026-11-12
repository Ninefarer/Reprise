# Stable 3.3.1 hotfix verification

Only the task-dialog draft-retention fix is promoted from ongoing Nightly development. The branch starts at main's existing README update, preserving the owner's repository changes.

The defect was reproduced with three regression cases before the fix: Do now, Settle, and Finish passed original task fields instead of the edited draft. Each failed on unpatched Stable source. With the one-line payload correction, all three pass. A fourth case verifies rejected transitions keep the edited draft open.

- 160 frontend tests passed across 10 files.
- 45 Rust tests passed.
- TypeScript/Vite build and optimized Windows x64 NSIS build passed.
- Rust formatting, strict all-target Clippy, Prettier and git diff checks passed.
- Isolated Windows QA used `com.reprise.hotfix.qa`, with notifications disabled and one synthetic task. Edited title and notes were saved by Finish; read-only SQLite inspection verified Finished status, both edited fields, history and integrity. Real Stable/Nightly profiles were not modified.
- QA used the debug Windows build of the same source with a separate identifier. The distributable uses the standard Stable identifier.

Installer: `Reprise_3.3.1_x64-setup.exe` (4,543,821 bytes).

SHA-256: `2d13c5929abaea22ac0ce2c1eb627de5411601f6b7774b4cbd14561e2706eaa6`.

An initial build check found unsupported `exact` options in the new testing-library calls; removing those redundant options corrected test typing. Existing tests and checks were retained. No task schema, scheduling, native Glass, or notification changes are included. Discarded unsaved edits from older versions cannot be recovered by this update.
