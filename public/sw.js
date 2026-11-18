/*
 * Doctor Handbook service worker (spec app-install, design §3). Hand-written on purpose, no
 * dependency.
 *
 * - /_next/static/* (hashed names, never change): cache-first.
 * - The icons, /icon.svg and the offline page (names without a hash): network-first, cached copy
 *   when offline, so a deploy that changes them is picked up.
 * - Page navigations: always the network (with navigation preload); on a network error, the
 *   offline page.
 * - Everything else (Server Actions, /api/*, avatars, signed Storage URLs): not touched.
 *
 * Pages are NEVER cached, so no patient data can end up in this cache.
 */
const CACHE = "dh-static-v1";
const MAX_ENTRIES = 300;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icons/icon-192.png"];

/** The allow-list: same origin, and only these static paths. */
function isCacheableStatic(url, origin) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  const path = parsed.pathname;
  return (
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/") ||
    path === "/icon.svg" ||
    path === OFFLINE_URL
  );
}

/** Hashed build files can be served from the cache forever; the rest is checked first. */
function isImmutable(url) {
  return new URL(url).pathname.startsWith("/_next/static/");
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
  for (let index = 0; index < extra; index += 1) {
    const key = keys[index];
    if (key && !PRECACHE.includes(new URL(key.url).pathname)) await cache.delete(key);
  }
}

/** Stores a copy in the background: a cache failure (quota…) never breaks the response. */
function store(event, request, response) {
  if (response.status !== 200 || response.type !== "basic") return;
  const copy = response.clone();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.put(request, copy).then(() => trim(cache)))
      .catch(() => undefined),
  );
}

async function cacheFirst(event) {
  const hit = await caches.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  store(event, event.request, response);
  return response;
}

async function networkFirst(event) {
  try {
    const response = await fetch(event.request);
    store(event, event.request, response);
    return response;
  } catch (error) {
    const hit = await caches.match(event.request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("dh-static-") && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.registration.navigationPreload?.enable())
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) ?? (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }
  if (!isCacheableStatic(request.url, self.location.origin)) return;
  event.respondWith(isImmutable(request.url) ? cacheFirst(event) : networkFirst(event));
});
