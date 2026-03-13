// Minimal service worker — required for Chrome Android PWA install prompt.
// Does not cache anything; all requests pass through to the network.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  // Only handle http/https — ignore chrome-extension:// and other schemes
  if (!e.request.url.startsWith("http")) return;
  e.respondWith(fetch(e.request));
});
