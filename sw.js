// عامل الخدمة — «المخزون أوّلاً» (C9): ملفّات التطبيق تُحمَّل من الهاتف فوراً بلا أيّ طلبٍ للشبكة،
// فيفتح سوا أسرع ويقلّ استهلاك Netlify (كان كلّ فتحٍ = ~25 طلباً؛ الآن طلبٌ واحد لفحص sw.js).
// ⛔ القاعدة: أيّ تعديلٍ في ملفّات التطبيق يُرفع معه sw.js برقم VERSION جديد — وإلا بقي المستخدمون على النسخة القديمة.
//    تغيّر VERSION ⇒ يُنزَّل كلّ شيءٍ من جديد (cache:'reload' يتجاوز مخزون المتصفّح) ⇒ يُعرض «تحديث جديد» داخل التطبيق.
// ⛔ لا يعترض إلا ملفّات التطبيق ومكتبات الواجهة. اتّصالات الخادم (Firestore الحيّ، الـWorker،
// الدخول بـGoogle) تمرّ مباشرةً — اعتراضها وتخزينها يكسر التزامن الحيّ.
const VERSION = 'sawa-v199';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './daily.json',
  './duaa.json',
  './sawa-core.js',
  './app.p1.js',
  './app.p2.js',
  './app.p3.js',
  './app.p4.js',
  './app.p5.js',
  './app.p6.js',
  './app.p7.js',
  './app.p8.js',
  './app.p9.js',
  './sawa-auth.js',
  './sawa-sync.js',
  './sawa-chat.js',
  './sawa-rtc.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];
// مكتبات الواجهة من الشبكة (React · Tailwind · Firebase SDK) — تُخزَّن ليعمل التطبيق دون اتّصال
const CDN_HOSTS = ['unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// صفحاتٌ تبقى «الشبكة أوّلاً» (أدوات فحصٍ تتغيّر ويجب أن تكون حديثة دائماً)
const NETWORK_FIRST = ['/diag.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'sawa-version' && e.source) e.source.postMessage({ type: 'sawa-version', version: VERSION });
});

function putCache(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
  return res;
}
function networkFirst(req) {
  return fetch(req).then((res) => putCache(req, res))
    .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)));
}
function cacheFirst(req, key) {
  return caches.open(VERSION).then((c) => c.match(key || req, { ignoreSearch: !!key }).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => { if (!key) putCache(req, res); return res; })
      .catch(() => (req.mode === 'navigate' ? c.match('./index.html') : undefined));
  }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = CDN_HOSTS.indexOf(url.hostname) >= 0;
  if (!sameOrigin && !cdn) return;            // الخادم وFirestore والدخول: لا نتدخّل
  if (sameOrigin && url.pathname.indexOf('/__/') === 0) return; // مسارات Firebase الخاصّة
  if (sameOrigin && url.pathname === '/sw.js') return;
  if (sameOrigin && NETWORK_FIRST.indexOf(url.pathname) >= 0) { e.respondWith(networkFirst(req)); return; }
  // فتح التطبيق (بأيّ ‎?chat=/‎?room=…) ⇒ index.html المخزّن
  if (sameOrigin && req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) { e.respondWith(cacheFirst(req, './index.html')); return; }
  e.respondWith(cacheFirst(req));
});

// ── الإشعارات (C5): رسالة FCM «بياناتٌ فقط» — التطبيق أمامك ⇒ تنبيهٌ داخله؛ غير ذلك ⇒ إشعار ──
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = {}; }
  const d = (p && p.data) || p || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const vis = cs.find((c) => c.visibilityState === 'visible' && c.focused);
    // التطبيق أمامك: هو يرنّ بنفسه (SawaRTC) أو يعرض تنبيهاً — بلا إشعارٍ مكرّر
    if (vis) { vis.postMessage({ type: 'sawa-push', data: d }); return; }
    return self.registration.showNotification(d.title || 'سوا', {
      body: d.body || '', tag: d.cid || (d.call ? 'call-' + d.call : d.sid ? 'sched-' + d.sid : 'sawa'), renotify: true, dir: 'auto', lang: 'ar',
      icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: d,
      requireInteraction: d.t === 'call', vibrate: d.t === 'call' ? [300, 150, 300, 150, 300] : [120],
    });
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const url = d.room ? './?room=' + encodeURIComponent(d.room) : './?' + (d.cid ? 'chat=' + encodeURIComponent(d.cid) : '') + (d.call ? '&call=' + encodeURIComponent(d.call) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ type: 'sawa-open', data: d }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
