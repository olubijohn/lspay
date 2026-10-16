/* Offline mode, part 2: keeps the app itself (page, scripts, styles, fonts) on the device so it opens with no
   internet. School data is NOT cached here: it comes from Supabase, and the app keeps its own copy of the last
   data loaded (src/lib/offline.ts). Bump VERSION to drop old caches. */
const VERSION = "lspay-shell-v1";
const SHELL = ["/", "/index.html", "/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && res.ok && (res.type === "basic" || res.type === "cors")) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;                       // Supabase, Paystack ...: always the network

  // pages: the newest version when online, the saved app when offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => put("/index.html", res)).catch(() => caches.match("/index.html").then((r) => r || caches.match("/"))));
    return;
  }
  // built files have content hashes in their names, so a saved copy is always right; fonts change rarely
  if (sameOrigin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/vendor/")) || fonts) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  // anything else from this site: network first, saved copy when offline
  e.respondWith(fetch(req).then((res) => put(req, res)).catch(() => caches.match(req)));
});
