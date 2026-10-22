// Minimal service worker so Dawakraft can be installed on a phone's home screen.
// Pages always come from the network (the catalog lives in Cloudflare D1); only the app's
// built files are cached, and an offline notice is shown when there is no signal.
const CACHE = "dawakraft-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            '<!doctype html><meta name="viewport" content="width=device-width"><title>Offline</title><body style="font-family:system-ui;padding:24px"><h1>You are offline</h1><p>Dawakraft needs internet to load your catalog. Reconnect and reload.</p></body>',
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
  }
});
