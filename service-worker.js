/* =========================================================
   service-worker.js
   Enables offline support for UnitKit.

   Strategy:
     - APP SHELL (HTML/CSS/JS/icons): cached on install,
       served "cache-first" so the whole app — including the
       Distance and Temperature converters — works fully
       offline, instantly, every time.
     - CURRENCY API requests (open.er-api.com): NEVER cached
       by the service worker. They go straight to the network
       so rates stay live. Offline handling for currency is
       handled separately by the localStorage cache inside
       js/api/currency.js (see that file for details).

   Cache versioning:
     Bump CACHE_NAME (e.g. "unitkit-v3") whenever you change
     any cached file, so returning users automatically get the
     new version instead of a stale cached copy.
========================================================= */

const CACHE_NAME = "unitkit-v3";

// Every file needed to run the app fully offline.
// Keep this list in sync whenever you add new pages/scripts/icons.
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/config/constants.js",
  "./js/utils/dom.js",
  "./js/utils/format.js",
  "./js/utils/storage.js",
  "./js/modules/distance.js",
  "./js/modules/temperature.js",
  "./js/modules/weight.js",
  "./js/modules/calculator.js",
  "./js/modules/bmi.js",
  "./js/api/currency.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

/* ---------- INSTALL: pre-cache the app shell ---------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting()) // activate new SW immediately, don't wait for old tabs to close
      .catch((err) => {
        // If even one file in the list fails to fetch/cache (e.g. a typo'd
        // path), addAll() fails atomically and installs nothing. Logging
        // this loudly makes that failure obvious in DevTools instead of
        // silently leaving the app with no offline support.
        console.error("[UnitKit] Service worker install failed:", err);
      })
  );
});

/* ---------- ACTIVATE: clean up old cache versions ---------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME) // delete any cache that isn't the current version
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim()) // take control of open tabs right away
  );
});

/* ---------- FETCH: serve cached app shell, bypass API calls ---------- */

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Never intercept calls to the currency exchange rate API —
  // always let those go straight to the network so rates stay fresh.
  // (Offline fallback for currency data is handled by currency.js's
  // own localStorage cache, not by the service worker.)
  if (requestUrl.hostname === "open.er-api.com") {
    return; // let the browser handle this request normally
  }

  // Only handle GET requests for our own app files (same-origin)
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Cache-first: serve instantly from cache when available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not cached yet (e.g. a new page added later) — try the network,
      // and quietly cache it for next time.
      return fetch(event.request)
        .then((networkResponse) => {
          // Only cache genuinely successful responses. Caching an
          // error response (e.g. a 404 or 500) would mean the app
          // keeps serving that broken response offline forever,
          // even after the real file is fixed on the server.
          if (!networkResponse || !networkResponse.ok) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Totally offline and not cached — fall back to the home
          // page shell so the user still sees the app, not a browser error.
          return caches.match("./index.html");
        });
    })
  );
});
