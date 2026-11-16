/**
 * Registers the Nightly service worker. Caching, push display, and
 * notification clicks live in `pwa/public/sw.js`.
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
