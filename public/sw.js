/**
 * Service worker de MangaTotal.
 *
 * Estrategias:
 *  - Navegación: red primero, con la última versión cacheada como respaldo
 *    (y /offline si nunca se visitó la página).
 *  - Estáticos de Next (/_next/static): cache primero, no cambian nunca.
 *  - Páginas de manga (/api/images): cache primero con límite, para releer
 *    sin gastar datos.
 *  - Todo lo demás (APIs, sesión): siempre red, nunca cache.
 */

const VERSION = "v1";
const SHELL_CACHE = `mangatotal-shell-${VERSION}`;
const STATIC_CACHE = `mangatotal-static-${VERSION}`;
const PAGES_CACHE = `mangatotal-pages-${VERSION}`;
const IMAGES_CACHE = `mangatotal-images-${VERSION}`;

const OFFLINE_URL = "/offline";
const MAX_IMAGES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("mangatotal-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Recorta un cache cuando pasa de cierto número de entradas. */
async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const key of keys.slice(0, keys.length - max)) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // navegación entre páginas
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(PAGES_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })()
    );
    return;
  }

  // estáticos versionados de Next: nunca cambian bajo la misma URL
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // páginas de manga ya leídas
  if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(IMAGES_CACHE);
          await cache.put(request, response.clone());
          trimCache(IMAGES_CACHE, MAX_IMAGES);
        }
        return response;
      })()
    );
  }

  // el resto (sesión, APIs de datos) va siempre a la red
});
