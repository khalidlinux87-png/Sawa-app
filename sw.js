// عامل الخدمة — يحفظ ملفّات التطبيق للعمل دون اتّصال (الشبكة أوّلاً، ثمّ المخزون).
// ⛔ لا يعترض إلا ملفّات التطبيق ومكتبات الواجهة. اتّصالات الخادم (Firestore الحيّ، الـWorker،
// الدخول بـGoogle) تمرّ مباشرةً — اعتراضها وتخزينها يكسر التزامن الحيّ.
const VERSION = 'sawa-v191';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './daily.json',
  './duaa.json',
  './sawa-core.js',
  './sawa-app.js',
  './sawa-auth.js',
  './sawa-sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];
// مكتبات الواجهة من الشبكة (React · Tailwind · Firebase SDK) — تُخزَّن ليعمل التطبيق دون اتّصال
const CDN_HOSTS = ['unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // ⛔ احذف نسخ «سوا» القديمة وحدها
        .filter((k) => k.indexOf('sawa-') === 0 && k !== VERSION)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = CDN_HOSTS.indexOf(url.hostname) >= 0;
  if (!sameOrigin && !cdn) return;            // الخادم وFirestore والدخول: لا نتدخّل
  if (sameOrigin && url.pathname.indexOf('/__/') === 0) return; // مسارات Firebase الخاصّة
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
