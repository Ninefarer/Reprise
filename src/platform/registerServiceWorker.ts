/**
 * Registers the Nightly service worker. The worker file is a stub: it does
 * not cache. `feature/pwa-storage` owns the caching strategy. Push display
 * and notification clicks already live in `pwa/public/sw.js`.
 */
export function registerServiceWorker(
  nav: Pick<Navigator, "serviceWorker"> = navigator,
  base = import.meta.env.BASE_URL,
) {
  if (!("serviceWorker" in nav)) return;
  const scope = base.endsWith("/") ? base : `${base}/`;
  void nav.serviceWorker.register(`${scope}sw.js`, { scope }).catch(() => {
    /* A missing worker must not block opening the app. */
  });
}
