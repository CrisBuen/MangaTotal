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

const VERSION = "v3";
const SHELL_CACHE = `mangatotal-shell-${VERSION}`;
const STATIC_CACHE = `mangatotal-static-${VERSION}`;
const IMAGES_CACHE = `mangatotal-images-${VERSION}`;

const OFFLINE_URL = "/offline";
const MAX_IMAGES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll([OFFLINE_URL]);
      // Si existe la caché de páginas de una versión anterior, el navegador
      // puede estar mostrando HTML roto: se toma el control de inmediato en
      // vez de esperar a que la persona acepte actualizar.
      const keys = await caches.keys();
      if (keys.some((k) => k.includes("pages"))) await self.skipWaiting();
    })()
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

  // Navegación: siempre de la red. El HTML de Next referencia archivos JS
  // con el hash del build, así que una copia cacheada de un deploy anterior
  // pediría archivos que ya no existen y rompería la página.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error())
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

// La página avisa cuando el usuario acepta actualizar: recién ahí el
// worker nuevo toma el control (evita recargas sorpresa mientras se lee).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
