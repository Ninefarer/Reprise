# Manual updates

Settings → About / Updates → **Check for updates** writes the result to the existing in-app notification history and opens the right panel. Checks do not happen automatically. Core task features remain offline.

- A successful check with no newer release says **You're up to date**.
- An available release appears as a clickable notification title. Clicking rechecks the offer, downloads it, verifies its signature and signed version, then runs the Windows installer and restarts Reprise.
- Download progress, verification and errors appear in the notification. Errors can be retried. Duplicate offers for the same version use one durable ID. Old offers are superseded, and interrupted downloads can be retried after restart.
- Update notices are local history entries. They never enter the native notification scheduler and never claim Windows delivery or reading.

## Current pre-repository build

There is no release feed or signing public key configured yet. Clicking Check for updates therefore shows **Updates aren't connected yet**. It does not make a network request or pretend the app is current.

The installed 3.1.1 package supports the workflow, but real feed/download/installation acceptance testing must wait for a repository and signed release. A first build with the real endpoint and public key must be installed manually; future releases can then update through the notification.

## Connecting the future repository

Edit `plugins.updater` in `src-tauri/tauri.conf.json` before publishing the first connected build:

```json
{
  "endpoints": ["https://github.com/OWNER/REPO/releases/latest/download/latest.json"],
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

110 frontend tests and 34 Rust tests pass. Tests cover missing configuration versus no update, persisted results, deduplication, stale offers, interrupted downloads, version reconciliation, operation locking, clickable frontend offers, progress/error/retry behavior and existing regressions. Actual remote signed installation remains unverified until the real release feed exists.

Installed and launched the 3.1.1 NSIS package. Verified the installed executable reports version 3.1.1, Settings shows Check for updates, and clicking it opens Notifications with the persisted Updates aren't connected yet result. Existing profile/task data remained present. No real user tasks were changed during verification.
