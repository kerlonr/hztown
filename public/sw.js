const CACHE_NAME = "projeto-gt-static-v6";
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
  "/js/features/settingsPanel.js",
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

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // API e tempo real sempre na rede, sem cache.
  if (url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/api/")) {
    return;
  }

  // O bundle do LiveKit e grande e versionado -> cache-first (rapido e economico).
  if (url.pathname.startsWith("/vendor/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchAndCache(request))
    );
    return;
  }

  // App shell e assets proprios -> network-first para que cada deploy apareca na hora,
  // com fallback ao cache quando estiver offline.
  event.respondWith(
    fetchAndCache(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/"))
    )
  );
});

function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (response && response.status === 200 && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}
