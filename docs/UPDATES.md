# Manual updates

Settings → About / Updates → **Check for updates** reports whether a feed is configured. Configured check results use the existing in-app notification history and right panel. Checks do not happen automatically. Core task features remain offline.

- A successful check with no newer release says **You're up to date**.
- An available release appears as a clickable notification title. Clicking rechecks the offer, downloads it, verifies its signature and signed version, then runs the Windows installer and restarts Reprise.
- Download progress, verification and errors appear in the notification. Errors can be retried. Duplicate offers for the same version use one durable ID. Old offers are superseded, and interrupted downloads can be retried after restart.
- Update notices are local history entries. They never enter the native notification scheduler and never claim Windows delivery or reading.

## Current feed configuration

GitHub releases exist, but there is no signed release feed or signing public key configured in the application. In current source, Check for updates reports **Update source not configured** without creating a placeholder notification, making a network request, or pretending the app is current. Earlier builds used the message Updates aren't connected yet.

The updater workflow was implemented in 3.1.1, but real feed/download/installation acceptance testing still requires a configured, accessible signed release feed. A first build with the real endpoint and public key must be installed manually; future releases can then update through the notification.

## Connecting a signed release feed

Edit `plugins.updater` in `src-tauri/tauri.conf.json` before publishing the first connected build:

```json
{
  "endpoints": [
    "https://github.com/OWNER/REPO/releases/latest/download/latest.json"
  ],
  "pubkey": "THE_CONTENTS_OF_YOUR_TAURI_PUBLIC_KEY_FILE",
  "requireSignedVersion": true,
  "windows": { "installMode": "passive" }
}
```

Generate a Tauri updater signing key once and keep the private key outside the repository. Publish only the public key in the app configuration. Enable `bundle.createUpdaterArtifacts: true` for the connected release pipeline and provide the signing key through the build environment/CI secrets. Use a current Tauri CLI that records the signed artifact version; the client requires it.

Publish a static `latest.json` with the release version, optional notes/date and a `platforms.windows-x86_64-nsis` (or `windows-x86_64`) entry containing the HTTPS installer URL and the `.sig` contents. Tauri's GitHub release action can generate the manifest. The installer version, manifest version and signature's signed version must agree.

Official references: [Tauri updater setup, signing and static manifests](https://v2.tauri.app/plugin/updater/), [verified download/install and Windows restart API](https://docs.rs/tauri-plugin-updater/latest/tauri_plugin_updater/struct.Update.html).

## Implementation and verification

`src-tauri/src/updates.rs` owns checks, concurrent-operation exclusion, durable local notices, offer revalidation, progress, verified installation and startup reconciliation. It uses `tauri-plugin-updater`; the frontend cannot supply arbitrary download URLs or signing keys. HTTPS and signed versions are required. The database is checkpointed before installer handoff; application identity and task schema are unchanged.

Settings and the existing notification panel call the custom backend commands. Progress is emitted at a bounded rate without SQLite writes for every downloaded chunk. Native reminder preferences and task operations are unchanged.

### Historical verification of the 3.1.1 implementation

At that point, 110 frontend tests and 34 Rust tests passed. Tests cover missing configuration versus no update, persisted results, deduplication, stale offers, interrupted downloads, version reconciliation, operation locking, clickable frontend offers, progress/error/retry behavior and existing regressions. Actual remote signed installation remains unverified until the real release feed exists.

Installed and launched the 3.1.1 NSIS package. Verified the installed executable reports version 3.1.1, Settings shows Check for updates, and clicking it opens Notifications with the persisted Updates aren't connected yet result. Existing profile/task data remained present. No real user tasks were changed during verification.
