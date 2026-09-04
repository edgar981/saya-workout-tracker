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
 *
 * Actualización CONTROLADA (§5): la app está en uso real. Un SW nuevo NO se
 * auto-activa (sin skipWaiting en install): queda "waiting" hasta que la app se
 * lo pida por mensaje, y la app solo lo pide cuando no hay sesión activa. Así
 * una versión nueva —y cualquier migración de Dexie que traiga al recargar— no
 * entra a mitad de entrenamiento.
 */

const CACHE = "saya-shell-v4";
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
  // Sin skipWaiting: un SW nuevo se instala pero espera. En el primer install
  // (sin SW previo que lo bloquee) igual se activa de inmediato, así que el
  // primer arranque no cambia. La activación de una ACTUALIZACIÓN la dispara la
  // app con el mensaje SKIP_WAITING, no el install.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

// La app pide activar el SW en espera solo cuando decide (sin sesión activa).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
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

  // Las rutas de respaldo (/api/*) nunca se cachean: son dinámicas y deben ir
  // siempre a la red. Sin `respondWith`, el navegador hace su fetch normal. Sin
  // señal fallan, y el cliente lo trata como "pendiente" — que es lo correcto.
  // (Los POST ya salieron arriba por el filtro de método.)
  if (url.pathname.startsWith("/api/")) return;

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
