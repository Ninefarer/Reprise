# Reliability pass

## Branch configuration

On GitHub, configure a rule for `develop` requiring pull requests and the
`Validate / validate` status check before merging. Disable bypass if the owner
wants the same guarantee for their changes. These settings are not encoded by
workflow YAML and have not been changed by this pass. Signed Windows release
verification remains a separate publication gate; PR checks use no signing secrets.

## Release metadata

`src-tauri/tauri.conf.json` defines the Stable version. Package metadata, the lock,
and Cargo package must agree. `docs/releases/VERSION.md` supplies publication prose;
`src/changelog.ts` supplies installed-app prose. The historical root changelog is
explicitly frozen through 3.4.3. `scripts/check-release.mjs` checks version agreement
and presence of both current note surfaces in PR CI and before signed builds.
It does not prove that independently written prose is equivalent.
Nightly retains its separate config, identity, data directory and update feed.

## Startup

Reminders settings now includes Start Reprise with Windows. The existing Tauri
autostart plugin is the only registration mechanism. Saving verifies Windows
registration before recording success; database failures attempt OS rollback.
Snapshots reconcile the stored checkbox with OS registration, including external
changes. Query failures surface as errors. Full settings saves preserve this field.

## Backup format and recovery

About settings accepts a full path to a `.reprise-backup` file. No third-party
import/export is implemented. The format is SQLite with a `reprise_backup` table
containing format version 1 and the referenced avatar bytes. Creation uses SQLite
online backup under the Store mutex, checks integrity and references, and never
overwrites an existing destination. Backups contain private data and are unencrypted.

Restoration opens the source read-only, verifies integrity/references and format,
copies it to staging, and runs existing schema migrations only on that copy.
Future schemas and invalid task/settings/notification data are rejected. Avatar
bytes are decoded with existing PNG limits and stored under a fresh UUID. Existing
assets are preserved. The live database is snapshotted to a uniquely named
`before-restore-UUID.reprise-backup` in the installation's app data directory before
replacement. SQLite backup replaces the live connection transactionally under the
Store mutex. Startup registration is retained from the current machine. Successful
restoration restarts the app to discard stale drafts, timers and updater state.

If validation or safety-backup creation fails, live data is untouched. SQLite backup
transaction failure rolls back replacement. Staged files are removed best-effort;
an interrupted operation may leave staging files or unreferenced avatar assets.
Keep safety backups until the restored data has been checked. Use the same Restore
operation to recover from a safety backup. Stable and Nightly keep their identities;
users can explicitly restore a portable backup into either installation.

## Release acceptance still required

Do not infer readiness from compilation. Verify in an isolated Windows identity:
enable/disable startup, registry state, sign-out/login launch, external registration
changes, failure feedback, and Stable/Nightly registration independence. Verify
backup/restore with avatar/history/reminders, restart, older-schema fixtures, future
schema rejection, invalid archives, unwritable destinations, interrupted restore,
disk-full failure and recovery from the safety backup. Exercise signed installed
upgrades with data retention. Never use a real user's database for these probes.

Maintainability changes are limited to dedicated startup, backup and backup-settings
modules. No broad Application component rewrite is warranted for this pass.

## Verification results for this working tree

- Frontend: 28 files, 246 tests passed.
- Rust: 67 tests passed; two existing manual probes ignored.
- `npm ci`, production frontend build, `cargo check`, `cargo fmt --check`, strict
  Clippy, release metadata check and `git diff --check` passed.
- Initial verification caught an incorrect rusqlite API import and a missing jsdom
  test annotation; both were corrected before the final passing runs.
- New tests cover restore round-trip, avatar recovery without overwriting existing
  assets, safety-backup recovery, existing-file protection, corrupt/future-schema
  rejection, staged version-2 migration, startup enable/disable and registration
  failure, rollback after settings-write failure, and UI restore confirmation/error
  feedback. Startup tests use simulated registration; they do not touch Windows
  startup settings.
- Native Windows UI, startup login, restore/restart, disk-full interruption and
  signed installed-upgrade acceptance remain unverified. GitHub Actions has not
  run these uncommitted files. This pass is not yet cleared for Stable publication.
- No application version changed; no commit, push, merge, tag or publication.
