/*
 * Service worker a mano, sin dependencias.
 *
 * El objetivo no es rendimiento: es que la app abra y opere con el teléfono en
 * modo avión, porque en el gym no hay señal (D2). Los datos ya viven en
 * IndexedDB; lo único que falta cachear es el shell.
 *
 * Estrategias:
 *   - navegaciones: red primero, cache como respaldo. Así un deploy nuevo se
 *     ve apenas hay señal, y sin señal se abre lo último que se vio.
 *   - assets de /_next/static: cache primero. Los nombres llevan hash, así que
 *     un archivo cacheado nunca queda obsoleto — cambia el nombre, no el
 *     contenido.
 */

const CACHE = "saya-shell-v3";
const APP_SHELL = [
  "/",
  "/sesion",
  "/sesion/cerrar",
  "/datos",
  "/plantillas",
  "/catalogo",
  "/historial",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll es atómico: si un recurso falla, no se instala nada. En el
      // primer arranque eso es preferible a un shell a medias.
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/"))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});
