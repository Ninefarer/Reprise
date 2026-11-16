/*
 * Reprise Nightly service worker.
 *
 * Precaches the app shell under /Reprise/ so the installed app can open
 * offline. The cache name is versioned; activate deletes older
 * reprise-nightly-shell-* caches. The web build replaces CACHE_VERSION
 * with a hash of that build's index.html.
 *
 * Push display and notification clicks stay in this file. Payloads should
 * stay minimal. Task notes are not required here.
 */
const CACHE_VERSION = "reprise-nightly-shell-v1";
const SHELL_PREFIX = "/Reprise/";
const SHELL_PATHS = [
  "/Reprise/",
  "/Reprise/index.html",
  "/Reprise/manifest.webmanifest",
  "/Reprise/icons/icon-128.png",
  "/Reprise/icons/icon-256.png",
  "/Reprise/icons/icon-512.png",
  "/Reprise/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("reprise-nightly-shell-") && key !== CACHE_VERSION,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  if (!url.pathname.startsWith(SHELL_PREFIX)) return;
  event.respondWith(fromNetworkThenCache(event.request));
});

async function precacheShell() {
  const cache = await caches.open(CACHE_VERSION);
  let html = "";
  for (const path of SHELL_PATHS) {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) continue;
    if (path === "/Reprise/" || path.endsWith("/index.html")) {
      html = html || (await response.clone().text());
    }
    await putClean(cache, path, response);
  }
  if (!html) throw new Error("The Reprise app shell could not be cached.");
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) continue;
    let pathname;
    try {
      pathname = new URL(raw, self.registration.scope).pathname;
    } catch {
      continue;
    }
    if (!pathname.startsWith(SHELL_PREFIX) || pathname.endsWith("/sw.js")) {
      continue;
    }
    assets.add(pathname);
  }
  await Promise.all(
    [...assets].map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error(`Missing shell asset ${path}`);
      await putClean(cache, path, response);
    }),
  );
}

async function putClean(cache, key, response) {
  const headers = new Headers(response.headers);
  // The body is already decoded. Leaving these headers makes the browser
  // reject or miss the cached script when the page asks for it offline.
  for (const name of ["content-encoding", "content-length", "transfer-encoding", "vary"]) {
    headers.delete(name);
  }
  await cache.put(
    key,
    new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

async function fromNetworkThenCache(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) await putClean(cache, request, fresh.clone());
    return fresh;
  } catch {
    const cached = await matchShell(cache, request);
    if (cached) return cached;
    return Response.error();
  }
}

async function matchShell(cache, request) {
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  if (request.mode !== "navigate") return undefined;
  return (
    (await cache.match("/Reprise/", { ignoreVary: true })) ||
    (await cache.match("/Reprise/index.html", { ignoreVary: true }))
  );
}

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
