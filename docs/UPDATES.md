# Signed updates

The first updater-enabled installer is a manual bootstrap. Builds through 3.3.1 have no configured feed and cannot discover this bootstrap themselves. Install over the existing matching channel; do not uninstall or delete application data.

After bootstrap, Reprise checks 30 seconds after onboarding finishes and every six hours while running. Quick Capture never starts its own checks. Settings > About / Updates > **Check for updates** performs an explicit check. An available update appears in the existing in-app Notifications panel; installation starts only when its title is clicked. Ignoring or dismissing the offer defers installation.

Automatic checks do not open a panel or create repeated success/error reminders. Manual checks report up-to-date and failure results. Available versions have durable, deduplicated identifiers; read and dismissed offers stay handled. Core tasks and reminders work offline.

## Independent channels

| Channel | Identity              | Manifest                                                                             |
| ------- | --------------------- | ------------------------------------------------------------------------------------ |
| Stable  | `com.reprise.desktop` | `https://github.com/Ninefarer/Reprise/releases/latest/download/latest.json`          |
| Nightly | `com.reprise.nightly` | `https://github.com/Ninefarer/Reprise/releases/download/nightly-updates/latest.json` |

Stable rejects prerelease versions. Nightly rejects Stable versions. Both require a newer version; no downgrade or channel switching is offered. Nightly remains a separate installation and database.

Versioned releases contain the Windows x64 NSIS installer, `.sig`, `.sha256`, and `latest.json`. Stable remains GitHub's Latest release. A single `nightly-updates` prerelease holds the rolling Nightly manifest; only this pointer asset advances, while dated releases and installers remain immutable. No GitHub token or account is needed by the installed application.

## Signing and credentials

The owner creates the signing key using the Tauri CLI and keeps it outside the repository. Only the public key is checked into configuration. Losing the private key prevents further updates to existing clients without another manual bootstrap; keep a secure offline backup.

Actions uses repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Values are exposed only to the signing step, never as command-line arguments. No private key files, environment dumps or passwords are uploaded as artifacts or included in installers. Fork pull requests do not receive signing secrets. Do not use verbose tracing around signing.

`bundle.createUpdaterArtifacts` is enabled. Both channels require signed versions, valid HTTPS and the configured public key. The existing Tauri updater verifies artifact signatures and the version bound into the signature before installation. Manifest version, installer version and signed version must agree. The frontend cannot provide replacement public keys, endpoints or arbitrary installer URLs.

Build scripts independently verify the produced Minisign signature and signed-version comment, then stage the installer, signature, checksum and static manifest. No third-party signing dependency is added.

## Actions and publication gate

- `signed-updater-qa.yml` builds two signed, isolated QA installers and uploads Actions artifacts. It does not create a release. Artifact checks reject tampered bytes, wrong versions and changed signed comments.
- `signed-release.yml` accepts an approved source SHA, channel and `publish` flag. Publication defaults to false. It retains frontend/Rust checks, strict Clippy, formatting, signed-artifact verification and channel-branch validation.
- Publishing requires `UPDATER_ACCEPTANCE_FINGERPRINT`, a repository variable recorded only after an installed signed upgrade passes. It covers the updater backend, verifier, public key, identities and channel configuration; changing those invalidates the gate.
- Publication has release-write permission; builds do not. It rechecks signatures/source metadata, creates a draft, verifies uploaded digests and tag target, then publishes. Existing versioned releases/tags cannot be overwritten.
- Stable descriptions use approved banners and user-facing notes; Nightly retains technical detail. Signing does not change in-app release-note formatting.

Never set the acceptance variable to bypass testing. First-time runs must remain artifacts-only until the installed-upgrade record is complete.

## Installed-upgrade acceptance

QA uses only `com.reprise.updater.qa` and synthetic tasks. The `updater-e2e` Cargo feature permits a loopback HTTP feed only for that exact QA identity. Production builds do not enable this feature and reject insecure transport, invalid TLS certificates/hostnames and downgrades. This test-only transport exercises signed installation before publishing, without modifying Windows trust settings. Signature and signed-version verification remain mandatory.

Install the older QA NSIS artifact manually. Serve the newer manifest/installer on `127.0.0.1:43187`, then use the running app's update notification. Verify that tampered bytes, mismatched signed versions and the wrong channel cannot install. Restore the valid feed and verify download, installation, restart, target version, SQLite integrity and task/profile retention. Record artifact hashes, source SHA, configuration/key fingerprint and outcomes before enabling publication.

The loopback test does not claim GitHub HTTPS was exercised. After publication, independently verify public manifest URLs, signatures, uploaded digests and channel routing. Production HTTPS uses Tauri's normal TLS verification and the strict configuration guard.

The installed upgrade passed on November 12, 2026: QA build `.900` updated to `.901` and restarted, preserving its synthetic task, profile and SQLite integrity. The client rejected tampered installer bytes, a mismatched signed version, a different channel and a stale offer. See [the acceptance receipt](updater-acceptance.json) for source, build run and hashes. This receipt covers the isolated loopback test, not a production GitHub download.

## Failures and recovery

Offers are rechecked before downloading. Superseded offers cannot install. Network, signature and version failures leave the current installation/database intact and show retry information. SQLite is checkpointed before installer handoff. Progress is rate-limited and does not write SQLite for every chunk. Interrupted updates reconcile on restart.

Automatic failures do not claim the app is current. Windows reminders and update history remain independent; neither infers native notification display.

References: [Tauri signing/updater setup](https://v2.tauri.app/plugin/updater/), [verified install API](https://docs.rs/tauri-plugin-updater/latest/tauri_plugin_updater/struct.Update.html), [GitHub release assets](https://docs.github.com/en/rest/releases/releases).
