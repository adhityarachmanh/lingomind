const CACHE_VERSION = "v1";
const APP_SHELL = [
  "/",
  "/chat",
  "/voice-chat",
  "/login",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== `shell-${CACHE_VERSION}`).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((c) => c || caches.match("/chat"))
        )
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(`shell-${CACHE_VERSION}`).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
  }
});
