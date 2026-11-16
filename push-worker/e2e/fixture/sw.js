self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      let notificationError = null;
      try {
        await self.registration.showNotification(payload.title || "Reprise", {
          body: payload.body || "",
          tag: payload.tag,
          data: { url: payload.url || "/" },
        });
      } catch (error) {
        notificationError = String(error);
      }
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: "push", payload, notificationError });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const windowClient of windows) {
        if (windowClient.url.startsWith(self.location.origin)) {
          return windowClient.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
