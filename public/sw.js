const CACHE_NAME = "projeto-gt-static-v3";
const STATIC_ASSETS = [
  "/",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/js/core/appConfig.js",
  "/js/core/appState.js",
  "/js/core/domElements.js",
  "/js/features/chatPanel.js",
  "/js/features/pwaRegistration.js",
  "/js/shared/formattingValues.js",
  "/js/ui/avatarRenderer.js",
  "/js/ui/iconRenderer.js",
  "/js/ui/toastNotifications.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/vendor/livekit-client/livekit-client.esm.mjs"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
