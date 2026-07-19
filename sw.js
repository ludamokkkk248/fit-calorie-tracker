/* ============================================================
 * Service Worker：让应用可离线使用、可安装
 * 策略：App Shell 预缓存 + 运行时缓存（OCR引擎等CDN资源）
 * ============================================================ */
const VERSION = "fitcal-v1.0.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/foods.js",
  "./js/calc.js",
  "./js/storage.js",
  "./js/ocr.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // 同源资源：缓存优先，回退网络（离线可用的关键）
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html")))
    );
    return;
  }

  // CDN 资源（Tesseract 引擎/语言包）：先缓存后网络，下载过一次后离线也能用
  if (/jsdelivr\.net|unpkg\.com|tessdata/.test(url.href)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION + "-cdn").then((c) => c.put(e.request, copy));
        }
        return res;
      }))
    );
  }
});
