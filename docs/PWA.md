# Nightly PWA

This is a Nightly-only browser build of Reprise. It is not part of Stable, and it is not a published release. The Windows Tauri app still builds with `npm run build` and `npm run tauri -- build`.

## Where the seam is

| Piece | Path | Owner |
| --- | --- | --- |
| Platform interface | `src/platform/types.ts` | This branch |
| Windows implementation | `src/platform/tauri.ts` | This branch. Forwards the existing invoke, window, and clipboard calls. |
| Web implementation | `src/platform/web.ts` | This branch |
| Active import | `reprise:platform` in `vite.config.ts` | `tauri.ts` unless `vite build --mode web` |
| Storage interface and localStorage placeholder | `src/platform/storage.ts` | Interface here. IndexedDB, `navigator.storage.persist()`, and JSON backup are for `feature/pwa-storage`. |
| Web task behavior on top of that storage | `src/platform/webStore.ts` | This branch. It is not the IndexedDB layer. |
| Push client | `src/platform/push.ts` | Calls the worker in [PWA push](PWA-PUSH.md) when `VITE_PUSH_WORKER_URL` and `VITE_PUSH_SHARED_SECRET` are set. Otherwise it stays unconfigured. |
| Service worker | `pwa/public/sw.js` | Push and notification click are here. Caching is not. |
| Pages workflow | `.github/workflows/nightly-pwa.yml` | Dispatch only. Refuses `main` and tags. |

UI code should call `platform` from `reprise:platform`. Do not import `@tauri-apps/api` from a component.

## Storage contract

`WebStorage` in `src/platform/storage.ts` is the whole persistence API:

- `read()` returns the version 1 `StoredDocument`, or `null` when the key is new. If bytes exist and the version is not 1, throw and do not write.
- `write(document)` replaces the document. A failed write leaves the previous bytes alone.
- `requestPersistence()` is called from the Allow notifications tap. The placeholder returns `false` and does not call `navigator.storage.persist()`.
- `exportBackup()` and `importBackup()` reject with `WebStoragePendingError`. They must not upload task text.

The placeholder key is `reprise.nightly.pwa.v1`. On iOS, a Home Screen install does not share that key with a Safari tab. Deletion undo receipts are kept in memory for the open page only, matching the desktop rule that reopening the database discards them.

`createWebSession` is the only reader of the document. Replace `createLocalStoragePlaceholder` without changing `StoredDocument` or the session.

## What the web build does

- Reuses the existing React UI.
- Saves tasks, settings, history, and in-app notification rows through the placeholder, so a reload in the same origin keeps them.
- While the page is open, a 15 second pass resurfaces due snooze, settlement, and waiting reminders and can show a browser notification after the user taps Allow notifications.
- Registers `sw.js`. The fetch handler is network-only so the page can be controlled. It does not cache.
- `push` and `notificationclick` are implemented. A click focuses an open window and emits `notification-route`.
- `subscribeToReminders` and `syncReminderTimes` send a request only when the push worker URL and shared secret are set. The sync body is only `{ id, at, category }`. Without that configuration they stay unconfigured and send nothing.

## What it does not do

- IndexedDB, durable-storage permission, or JSON backup.
- A deployed push service. The worker in [PWA push](PWA-PUSH.md) is not deployed by this repository. iOS cannot schedule a local notification, so a reminder after the app is closed waits on that service.
- Windows tray, native glass, global Quick Capture, or the signed updater. Settings still say so in the web diagnostics.
- A 192px icon. The manifest uses the existing 128, 256, and 512 Nightly derivatives. Those files were copied, not redrawn. Chrome's install criteria ask for a 192 and a 512. The 256 satisfies "at least 192" and the 512 is exact. A generated 192 was not added.

## GitHub Pages

The workflow is manual (`workflow_dispatch`) from `develop` or this branch. It will not run for `main` or a tag. Haru still has to point the repository Pages source at GitHub Actions before the first deploy. This branch does not change that setting. The site base path is `/Reprise/`.

Build locally with `npm run build:web`, then `npm run check:pwa`.
