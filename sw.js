const APP_VERSION = "2026.08.21-105";
const CACHE = "ecr-shell-" + APP_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./legal.html",
  "./manifest.webmanifest",
  "./icons/eClassRecord192.png",
  "./icons/eClassRecord512.png",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: "VERSION_ACTIVE", version: APP_VERSION }));
  })());
});

self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  if (d.type === "GET_VERSION" && e.source) {
    e.source.postMessage({ type: "VERSION", version: APP_VERSION });
  }

  if (d.type === "PURGE") {
    e.waitUntil(
      caches.keys()
        .then(ks => Promise.all(ks.map(k => caches.delete(k))))
        .then(() => e.source && e.source.postMessage({ type: "PURGED" }))
    );
  }
});

function isHTML(req, u) {
  return req.mode === "navigate" || req.destination === "document" ||
         u.pathname.endsWith("/") || u.pathname.endsWith(".html");
}

function isVersionCritical(u) {
  return u.pathname.endsWith("version.json") || u.pathname.endsWith("sw.js");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);


  if (u.hostname.endsWith("firebaseio.com") || u.hostname.endsWith("firebasedatabase.app") ||
      u.hostname.endsWith("googleapis.com") || u.pathname.includes("__/auth")) return;

  if (isVersionCritical(u)) {
    e.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  if (isHTML(req, u)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res && res.ok) {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return res;
      } catch (_) {
        return (await caches.match(req)) ||
               (await caches.match("./index.html")) ||
               (await caches.match("./"));
      }
    })());
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
