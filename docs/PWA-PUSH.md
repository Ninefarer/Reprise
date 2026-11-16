# PWA push

[Documentation](README.md) · [Nightly PWA](PWA.md)

Reprise on iPhone is a Nightly home-screen web app. It is not the Windows app, and it is not part of Stable. iOS does not keep a closed web app awake to run a local timer, so a reminder that must arrive while Reprise is closed has to be delivered by a push service. This Worker is that clock. It stores a reminder id, a unix time, and a category, then asks Apple's push service to wake the installed app.

The Windows app does not call this Worker. Release workflows do not deploy it. Nothing here is published until someone follows the deploy steps below.

## What is stored

For each device:

- The push subscription: the endpoint URL, the browser's P-256 public key, and the 16-byte auth secret. Those three values are what Web Push encryption requires.
- Reminders, each exactly `{ id, at, category }`. `id` is the event id already stored on the device. `at` is unix seconds. `category` is one of Scheduled, Deadline, Snoozed, Settled, Waiting, or DailyReview.
- A device id the PWA generates and keeps in local storage (`reprise.nightly.push-device`). It is not an account.
- The last 50 push attempts: time, device id, endpoint host, HTTP status, the push service's response body, Apple's `apns-id` when present, the reminder id, and whether it was a reminder or a test.

An internal attempt counter is kept after a failed send so a rejected reminder is not retried forever. It is not task data.

Task titles, notes, descriptions, projects, and tags are rejected if a client sends them. They are not written to KV.

## Why the payload is generic

`PUT /reminders` accepts only the fields in `ReminderTime` from `src/platform/push.ts`. The Worker turns a category into the notification text:

| Category | Title | Body | Extra |
| --- | --- | --- | --- |
| Scheduled | Reprise | Scheduled reminder | |
| Deadline | Reprise | Deadline reminder | |
| Snoozed | Reprise | Snoozed reminder | |
| Settled | Reprise | Settled reminder | |
| Waiting | Reprise | Waiting reminder | |
| DailyReview | Reprise | Time for your daily review | `review: true` |

The JSON the service worker receives is:

```json
{
  "title": "Reprise",
  "body": "Deadline reminder",
  "tag": "6f1c2a40-1111-4111-8111-111111111111:Deadline:1700000000",
  "url": "./"
}
```

Daily review adds `"review": true`. `tag` is the reminder id. There is no `taskId`. The id is an event id, not a task id. `url` is `./`, which the service worker resolves against its scope (`/Reprise/` on GitHub Pages).

`pwa/public/sw.js` already shows `title` and `body`, uses `tag`, and copies `url` and `review` onto the notification. A click focuses an open window and posts `reprise-notification-click`. This Worker does not change that file.

Every push must call `showNotification`. After repeated silent pushes, WebKit drops the subscription.

## API

The browser origin must match `ALLOWED_ORIGIN` exactly, for example `https://ninefarer.github.io`. Requests with no `Origin` header, such as curl, are allowed. A different `Origin` is `403`.

```json
{ "error": "origin is not allowed" }
```

`GET /vapid-public-key` is public, because the browser needs it to subscribe. Browser requests from any other origin than `ALLOWED_ORIGIN` are rejected. The Worker never answers with `Access-Control-Allow-Origin: *`. CORS is only a browser rule: a program that can set its own `Origin` header is not stopped by it.

`VITE_PUSH_SHARED_SECRET` is compiled into the GitHub Pages JavaScript. The site is public, so that value is not a secret. Treat it as a speed bump that keeps random scanners off the Worker. It must not be the only control.

What a person who reads the bundle can do is limited:

- They can create a device, up to 8 devices and 20 new subscriptions an hour.
- `POST /subscribe` returns a random device token. Later changes to that device require `X-Reprise-Device-Token`. The token is stored in the browser, not in the bundle. One device's token cannot edit another device.
- `PUT /reminders` and `DELETE /reminders/:id` are limited to 30 writes an hour for that device.
- `POST /test-push` is limited to 6 an hour for that device and 12 an hour for the whole Worker.
- Request bodies are capped at 32 KB. A device can store 200 reminders. The notification JSON sent to the push service is capped at 1 KB.
- `GET /push-log` ignores the shared secret. It requires `X-Reprise-Admin-Secret`, which is the Wrangler secret `PUSH_ADMIN_SECRET`. Do not add that value to Vite, the Pages build, or this repository.

The shared secret is still sent as `X-Reprise-Push-Secret` so the PWA can be told apart from a completely open URL. Losing it does not reveal the push log or another install's reminders.

Responses are JSON. `2xx` means the Worker accepted the call. The push client returns `"accepted"` only for a `2xx` from `PUT /reminders`.

### `GET /vapid-public-key`

```json
{ "publicKey": "BElG..." }
```

This is the uncompressed P-256 point, base64url, for `pushManager.subscribe({ applicationServerKey })`.

### `POST /subscribe`

```json
{
  "deviceId": "2f6d1c0a-3b4e-4f5a-8c7d-91ab23cd45ef",
  "subscription": {
    "endpoint": "https://web.push.apple.com/Qexample",
    "keys": { "p256dh": "BElG...", "auth": "dGVzdA" }
  }
}
```

`deviceId` is 8 to 80 characters from `A-Z`, `a-z`, `0-9`, `_`, and `-`. A UUID is fine. The first response is `{ "ok": true, "deviceToken": "..." }`. The PWA stores that token in `localStorage` under `reprise.nightly.push-device-token` and sends it as `X-Reprise-Device-Token` after that. Replacing an existing subscription requires the same token. The Worker stores only a hash of the token.

### `PUT /reminders`

Replaces the full set for that device. An empty array clears it.

```json
{
  "deviceId": "2f6d1c0a-3b4e-4f5a-8c7d-91ab23cd45ef",
  "reminders": [
    {
      "id": "6f1c2a40-1111-4111-8111-111111111111:Deadline:1700000000",
      "at": 1700000000,
      "category": "Deadline"
    }
  ]
}
```

```json
{ "ok": true, "count": 1 }
```

`id` may contain the colons the web app already uses in event ids. `at` is an integer unix second, and it must be within 366 days. Up to 500 reminders are kept. Any other category is `400`, and the previous set is left as it was.

### `DELETE /reminders/:id`

Send `X-Device-Id` or `?deviceId=`. The id is one path segment. `{ "ok": true }` even when that id was already gone.

### `DELETE /subscribe`

Same device header or query. Removes the subscription and that device's reminders.

### `POST /test-push`

```json
{ "deviceId": "2f6d1c0a-3b4e-4f5a-8c7d-91ab23cd45ef", "title": "Reprise", "body": "Test notification", "url": "/" }
```

`title`, `body`, and `url` are optional. The tag is always `reprise-test`. A `2xx` from the push service returns:

```json
{ "ok": true, "status": 201, "endpointHost": "web.push.apple.com" }
```

The endpoint path is not returned. `404` or `410` from the push service deletes the subscription and returns `410`.

### `GET /push-log`

Requires `X-Reprise-Admin-Secret`. The Pages bundle cannot call this. `X-Reprise-Push-Secret` is rejected here.

```json
{
  "entries": [
    {
      "at": "2026-11-16T18:00:00.000Z",
      "deviceId": "2f6d1c0a-3b4e-4f5a-8c7d-91ab23cd45ef",
      "endpointHost": "web.push.apple.com",
      "status": 201,
      "reason": "",
      "apnsId": "apple-id",
      "reminderId": "6f1c2a40-1111-4111-8111-111111111111:Deadline:1700000000",
      "kind": "reminder"
    }
  ]
}
```

`reason` is the push service's response body, cut at 500 characters. Compare `status`, `reason`, and `apnsId` with what the iPhone shows. `endpointHost` is only the host, for example `web.push.apple.com`.

## Schedule

A cron trigger runs every minute. It loads each device's reminders, sends the ones whose `at` is at or before that tick, and deletes the ones the push service accepted. A `404` or `410` deletes the stale subscription and stops the rest of that minute. Reminders that were not attempted stay, so a later subscribe can still deliver them. Any other failure is retried on the next minute, up to five times, and then dropped. The log keeps the response.

The request uses RFC 8291 `aes128gcm` and RFC 8292 VAPID (`Authorization: vapid t=..., k=...`). `aud` is the origin of that subscription's endpoint, such as `https://web.push.apple.com`. `TTL` is one hour for a reminder and five minutes for a test. `Urgency` is `high`. The same VAPID token is reused for an hour, which is what Apple asks for.

KV is eventually consistent. A reminder saved in the same minute it is due can miss that tick and go out on the next one. Set times at least a minute ahead.

## Frontend

`src/platform/push.ts` keeps the existing function signatures.

- `subscribeToReminders` returns `unsupported` when the browser has no Push API. With the env vars unset, it returns the existing `unconfigured` reason and does not call the network. When both are set, it waits for the service worker, fetches the VAPID key, calls `pushManager.subscribe({ userVisibleOnly: true })`, and `POST /subscribe`. `subscribed` is returned only after that post is `2xx`.
- `syncReminderTimes` still strips every field except `id`, `at`, and `category`. It `PUT`s `/reminders` only when both env vars are set and this install already has a device token. It returns `accepted` only on `2xx`. It never sends an admin secret.

```bash
VITE_PUSH_WORKER_URL=https://reprise-pwa-push.<account>.workers.dev
VITE_PUSH_SHARED_SECRET=<the same value as PUSH_SHARED_SECRET>
```

Those two variables are embedded in the Pages JavaScript. Anyone who can load the site can read `VITE_PUSH_SHARED_SECRET`. Do not put `PUSH_ADMIN_SECRET` in a `VITE_` variable.

`http://` is accepted only for `localhost` and `127.0.0.1`. A missing or empty variable leaves the build in the unconfigured state, so `npm run build:web` does not need a deployed Worker.

The device id is remembered in `localStorage` under `reprise.nightly.push-device`. That key is not the task document in `src/platform/storage.ts`.

## VAPID keys

From `push-worker/`:

```bash
npm ci
npm run vapid
```

The public key is safe to put in `wrangler.toml` as `VAPID_PUBLIC_KEY`. The private key is only a Wrangler secret. Do not commit it, and do not pass it on a command line that gets logged.

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

Paste the private key and press Enter. A trailing newline becomes part of the secret and the signature will not match. `VAPID_SUBJECT` must be a `mailto:` address or an `https://` URL. Apple rejects `localhost`.

## Cloudflare setup

This uses the free plan only: a Worker, one cron trigger, and one KV namespace. No Durable Objects and no paid storage.

1. Create a free Cloudflare account.
2. Install Node.js 22.
3. In `push-worker/`, run `npm ci`.
4. Run `npx wrangler login` and approve the browser prompt.
5. Run `npx wrangler kv namespace create PUSH_KV`.
6. Copy the printed `id` into `push-worker/wrangler.toml`, replacing the placeholder. Local `wrangler dev` works before that. `wrangler deploy` does not.
7. Set `ALLOWED_ORIGIN` to the Pages origin, `VAPID_SUBJECT` to your mailto, and `VAPID_PUBLIC_KEY` to the public key.
8. Run `npx wrangler secret put VAPID_PRIVATE_KEY`, `npx wrangler secret put PUSH_SHARED_SECRET`, and `npx wrangler secret put PUSH_ADMIN_SECRET`. Keep the admin secret off the Pages build.
9. Run `npx wrangler deploy`.

The free `workers.dev` hostname is enough. Note the URL and use it as `VITE_PUSH_WORKER_URL`. Deploy is manual. This repository's release workflows do not run it.

For local development, put the secrets in `push-worker/.dev.vars` and do not commit that file:

```bash
ALLOWED_ORIGIN=http://127.0.0.1:5173
VAPID_SUBJECT=mailto:push@example.com
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
PUSH_SHARED_SECRET=<secret>
PUSH_ADMIN_SECRET=<admin secret, not a VITE_ variable>
```

Then `npx wrangler dev`.

## Free plan limits

Checked against Cloudflare's published free plan:

- 100,000 Worker requests per day. One cron tick is one request, about 1,440 per day, plus the calls the PWA makes.
- 10 ms of CPU per request and per cron tick. Waiting on KV or on Apple does not count. A single user's due reminders fit. A large burst can be cut off.
- 50 subrequests per invocation.
- KV: 100,000 reads, 1,000 writes, 1,000 deletes, and 1 GB per day. A quiet minute does not write. A send writes the reminder list and the log. A few reminders a day stay inside the write budget. A tight loop of test pushes can spend it.
- Five cron triggers per free account, shared by every Worker. The shortest schedule is one minute.

## Privacy

The Worker sees when a reminder fires, its category, and which push service the browser uses. It does not see the task. The endpoint URL is a capability: anyone who has it and the VAPID private key can send a notification, so it stays in KV and out of the push log. The log records the host only.

KV lives on Cloudflare's network. The shared secret is the only access check.

## Checks

From `push-worker/`:

```bash
npm test
npm run test:e2e
```

`npm test` checks the RFC 8291 example, the VAPID JWT, routing, which reminders are due, and deletion of a subscription when the push service returns 404 or 410.

`npm run test:e2e` needs Playwright's Chrome channel (`npx playwright install chromium` does not by itself provide Google's push credentials). It starts `wrangler dev`, opens Chrome, and asks the page to subscribe. When that registration is accepted, the script calls `/test-push` and a reminder one minute ahead, and the service worker has to receive both. Headless Chrome can report notification permission as granted and still fail subscription with `Registration failed - permission denied`. That is what happened while preparing this branch, including under a virtual display, so a service worker push event was not observed here. Apple's push service is separate again: what an iPhone shows has to be compared with `GET /push-log` on a device.
