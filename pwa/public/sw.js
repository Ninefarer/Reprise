/*
 * Reprise Nightly service worker.
 *
 * Caching is intentionally absent. feature/pwa-storage replaces the fetch
 * listener. This file only makes the page controlled, shows a Web Push
 * payload, and focuses the open app when a notification is clicked.
 *
 * Push payloads should stay minimal. Task notes are not required here.
 * A useful closed-app alert can be a title of "Reprise" and a generic body.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  if (!payload || typeof payload !== "object") payload = {};
  const title = typeof payload.title === "string" ? payload.title : "Reprise";
  const body = typeof payload.body === "string" ? payload.body : "A reminder is ready.";
  const tag = typeof payload.tag === "string" ? payload.tag : payload.id;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: typeof tag === "string" ? tag : undefined,
      data: {
        url: typeof payload.url === "string" ? payload.url : "./",
        taskId: typeof payload.taskId === "string" ? payload.taskId : null,
        review: payload.review === true,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "./", self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          client.postMessage({
            type: "reprise-notification-click",
            review: data.review === true,
            taskId: data.taskId ?? null,
          });
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
