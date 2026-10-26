// عامل الخدمة — «المخزون أوّلاً» (C9): ملفّات التطبيق تُحمَّل من الهاتف فوراً بلا أيّ طلبٍ للشبكة،
// فيفتح سوا أسرع ويقلّ استهلاك Netlify (كان كلّ فتحٍ = ~25 طلباً؛ الآن طلبٌ واحد لفحص sw.js).
// ⛔ القاعدة: أيّ تعديلٍ في ملفّات التطبيق يُرفع معه sw.js برقم VERSION جديد — وإلا بقي المستخدمون على النسخة القديمة.
//    تغيّر VERSION ⇒ يُنزَّل كلّ شيءٍ من جديد (cache:'reload' يتجاوز مخزون المتصفّح) ⇒ يُعرض «تحديث جديد» داخل التطبيق.
// ⛔ لا يعترض إلا ملفّات التطبيق ومكتبات الواجهة. اتّصالات الخادم (Firestore الحيّ، الـWorker،
// الدخول بـGoogle) تمرّ مباشرةً — اعتراضها وتخزينها يكسر التزامن الحيّ.
const VERSION = 'sawa-v348';
// C83: «ما الجديد» — يظهر لكلّ مستخدم في «حسابي ← تحديث التطبيق». سطرٌ واحد بلا علامة ' (‎\n‎ لسطرٍ جديد). يُحدَّث مع كلّ نسخة.
const NOTES = '• الآيفون: شاشة رنينٍ كاملة للمكالمات الواردة (حتّى والتطبيق مغلق أو الهاتف مقفل)\n• الرفض من شاشة الرنين يصل للمتّصل فوراً';
// P2: على العناوين القديمة/البديلة (Netlify · sawaap.pages.dev · sawaaap.com بلا www) يصير عامل الخدمة «مُخلياً»:
//     يمسح المخزون، يحوّل الصفحات المفتوحة إلى العنوان الرسميّ، ثمّ يلغي نفسه. على www.sawaaap.com يعمل كالمعتاد.
//     (لا يُحذف هذا قبل أن ينتقل كلّ المستخدمين.)
const MOVED_TO = 'https://www.sawaaap.com';
const MOVED = /\.netlify\.app$/i.test(self.location.hostname) || /^sawaap\.pages\.dev$/i.test(self.location.hostname) || /^sawaaap\.com$/i.test(self.location.hostname);
// C139: الحجم المتوقَّع (بالبايت) للملفّات المرفوعة مع هذه النسخة — إن اختلف على الخادم (لم يُرفع، أو رُفع ناقصاً) يُسجَّل ويُنبَّه المستخدم
const EXPECT = { './sawa-chat.js': 518171, './app.p2.js': 224415, './app.p3.js': 310818, './app.p4.js': 284121, './app.p5.js': 293396, './sawa-rtc.js': 356768 };
const REPORT = [];
const ASSETS = [
  './',
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
  './tw.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];
// مكتبات الواجهة من الشبكة (React · Tailwind · Firebase SDK) — تُخزَّن ليعمل التطبيق دون اتّصال
const CDN_HOSTS = ['unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// صفحاتٌ تبقى «الشبكة أوّلاً» (أدوات فحصٍ تتغيّر ويجب أن تكون حديثة دائماً)
const NETWORK_FIRST = ['/diag.html', '/diag'];

self.addEventListener('install', (e) => {
  if (MOVED) { self.skipWaiting(); return; }
  // ⛔ كلّ ملفٍّ على حدة: ملفٌّ واحد مفقود أو انقطاعٌ لحظيّ لا يُفشل التحديث كلّه (كان addAll يُبقي النسخة القديمة عالقة).
  //    ما لم يُخزَّن يُجلب من الشبكة عند أوّل طلبٍ له (cacheFirst) ثمّ يُخزَّن.
  // C62.1: حارس السلامة — ملفٌّ مقطوع أو تالف (رفعٌ من الهاتف انقطع) يرفض التحديث كلّه ⇒ يبقى المستخدمون على آخر نسخةٍ تعمل
  //        بدل شاشة «تعذّر تشغيل التطبيق». (انقطاع شبكةٍ عاديّ لملفٍّ ما يبقى متسامحاً كما كان.)
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(ASSETS.map((u) => fetch(new Request(u, { cache: 'reload' }))
      .then((res) => verifyAsset(u, res))
      .then((res) => (res && res.ok ? c.put(u, res) : null))
      .catch((err) => { if (err && err.sawaBroken) throw err; console.warn('precache miss', u, err && err.message); }))))
    .then(() => updStatus(true, null))
    .then(() => self.skipWaiting())
    .catch((err) => caches.delete(VERSION).then(() => updStatus(false, err)).then(() => { console.error('update refused:', err && err.message); throw err; })));
});
// C139: نتيجة آخر تحديث ⇒ flags-sawa/upd-status (يقرؤها «تحديث التطبيق» و‎/sw-status‎) + إشعارٌ واحد لكلّ نسخة إن رُفض أو اختلف ملفّ
function updStatus(ok, err) {
  const st = { v: VERSION, ok, why: err ? String(err.message || err).replace('./', '') : null, mism: REPORT.slice(), ts: Date.now() };
  return caches.open('flags-sawa').then((c) => c.match('/upd-status').then((r) => (r ? r.json() : null)).catch(() => null).then((prev) => {
    const tell = (!ok || st.mism.length) && !(prev && prev.v === VERSION && prev.told);
    st.told = !!(tell || (prev && prev.v === VERSION && prev.told));
    return c.put('/upd-status', new Response(JSON.stringify(st), { headers: { 'Content-Type': 'application/json' } })).then(() => {
      if (!tell || !self.registration || !self.registration.showNotification) return null;
      const f = st.mism[0], file = f ? f.u.replace('./', '') : ((st.why || '').split(' ').pop() || '');
      const body = !ok ? 'الملفّ ' + file + ' على الخادم مقطوعٌ أو تالف، فبقي التطبيق على نسخته السابقة. أعد رفعه ثمّ sw.js برقمٍ جديد.'
        : 'الملفّ ' + file + ' على الخادم ليس النسخة المطلوبة (' + Math.round(f.got / 1024) + ' ك.ب بدل ' + Math.round(f.want / 1024) + '). أعد رفعه.';
      return self.registration.showNotification('سوا: لم يكتمل التحديث ' + VERSION.replace('sawa-', ''), { body, tag: 'sawa-upd', data: { t: 'upd' }, icon: './icons/icon-192.png', dir: 'rtl', lang: 'ar' }).catch(() => null);
    });
  })).catch(() => null);
}
function verifyAsset(u, res) {
  if (!res || !res.ok || !/\.js$/.test(u)) return Promise.resolve(res);
  return res.clone().text().then((t) => {
    const bad = (why) => { const e = new Error(why + ' ' + u); e.sawaBroken = true; throw e; };
    try { const n = new TextEncoder().encode(t).length; if (EXPECT[u] && n !== EXPECT[u]) REPORT.push({ u, got: n, want: EXPECT[u] }); } catch (x) {}
    const m = u.match(/app\.p(\d+)\.js$/);
    if (m) { if (!new RegExp('//@@sawa-part:' + m[1] + '\\s*$').test(t)) bad('truncated'); return res; }   // الأجزاء ليست JS كاملاً وحدها — علامة النهاية تكفي
    try { new Function(t); } catch (x) { if (x instanceof SyntaxError) bad('broken (' + x.message + ')'); }   // تحليلٌ فقط بلا تنفيذ
    return res;
  });
}

self.addEventListener('activate', (e) => {
  if (MOVED) {
    e.waitUntil(caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('sawa-') === 0).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((cs) => Promise.all(cs.map((c) => { try { const u = new URL(c.url); return c.navigate(MOVED_TO + u.pathname + u.search + u.hash).catch(() => null); } catch (x) { return null; } })))
      .then(() => self.registration.unregister()));
    return;
  }
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // ⛔ احذف نسخ «سوا» القديمة وحدها
        .filter((k) => k.indexOf('sawa-') === 0 && k !== VERSION)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// C60: المتصفّح غيّر اشتراك الإشعارات (انتهاء صلاحيّة/تدوير) ⇒ الرمز القديم عند الخادم ميّت. نرفع علماً يقرأه التطبيق عند فتحه (ذاكرة 'flags-sawa' لا تُحذف مع نسخ 'sawa-*')
//      ونبلّغ أيّ نافذةٍ مفتوحة لتجدّد الرمز فوراً.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(Promise.all([
    caches.open('flags-sawa').then((c) => c.put('/push-resub', new Response(String(Date.now())))).catch(() => null),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'sawa-push-resub' }))).catch(() => null),
  ]));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'sawa-version' && e.source) {
    caches.open(VERSION).then((c) => c.keys()).then((k) => e.source.postMessage({ type: 'sawa-version', version: VERSION, cached: k.length, assets: ASSETS.length }))
      .catch(() => e.source.postMessage({ type: 'sawa-version', version: VERSION }));
  }
});

// ⛔ Cloudflare Pages يحوّل ‎/x.html‎ إلى ‎/x‎ (308). ردٌّ «محوَّل» (redirected) يُعاد لطلب تنقّل ⇒ المتصفّح يرفضه: ERR_FAILED.
//    لذا: الصفحة الرئيسيّة تُخزَّن بمفتاح «./» لا «./index.html»، وكلّ ردٍّ محوَّل يُنسخ ردّاً نظيفاً قبل إعادته.
function clean(r) {
  if (!r || !r.redirected) return r;
  return r.blob().then((b) => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }));
}
function putCache(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
  return res;
}
function networkFirst(req) {
  return fetch(req).then((res) => putCache(req, res))
    .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : undefined)))
    .then(clean);
}
function cacheFirst(req, key) {
  return caches.open(VERSION).then((c) => c.match(key || req, { ignoreSearch: !!key }).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => { if (!key) putCache(req, res); return res; })
      .catch(() => (req.mode === 'navigate' ? c.match('./') : undefined));
  })).then(clean);
}

self.addEventListener('fetch', (e) => {
  if (MOVED) return;
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = CDN_HOSTS.indexOf(url.hostname) >= 0;
  if (!sameOrigin && !cdn) return;            // الخادم وFirestore والدخول: لا نتدخّل
  if (sameOrigin && url.pathname.indexOf('/__/') === 0) return; // مسارات Firebase الخاصّة
  if (sameOrigin && url.pathname === '/sw.js') return;
  // C139: ‎/sw-status‎ — حالة آخر تحديث (للتشخيص من المتصفّح)
  if (sameOrigin && url.pathname === '/sw-status') { e.respondWith(caches.open('flags-sawa').then((c) => c.match('/upd-status')).then((r) => r || new Response(JSON.stringify({ v: VERSION, none: true }), { headers: { 'Content-Type': 'application/json' } }))); return; }
  if (sameOrigin && NETWORK_FIRST.indexOf(url.pathname) >= 0) { e.respondWith(networkFirst(req)); return; }
  // فتح التطبيق (بأيّ ‎?chat=/‎?room=…) ⇒ الصفحة الرئيسيّة المخزّنة (مفتاحها «./»)
  if (sameOrigin && req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) { e.respondWith(cacheFirst(req, './')); return; }
  // صفحاتٌ أخرى (diag…) قد يحوّلها Pages: الشبكة مباشرةً
  if (sameOrigin && req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});

// ── الإشعارات (C5): رسالة FCM «بياناتٌ فقط» — التطبيق أمامك ⇒ تنبيهٌ داخله؛ غير ذلك ⇒ إشعار ──
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = {}; }
  const d = (p && p.data) || p || {};
  // C111: إقرار «رنّت»/«وصلت» (موقّع من الخادم) — المرسِل يرى «يرنّ…» وعلامتين ولو كان التطبيق مغلقاً
  try {
    const ack = d.to && (d.t === 'call' && d.rk ? { k: 'r', call: d.call, to: d.to, s: d.rk } : d.t === 'msg' && d.dk ? { k: 'd', cid: d.cid, to: d.to, ts: Number(d.ts), s: d.dk } : null);
    if (ack) e.waitUntil(fetch('https://sawa-deploy-test.khalidlinux87.workers.dev/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ack) }).catch(() => {}));
  } catch (x) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const vis = cs.find((c) => c.visibilityState === 'visible' && c.focused);
    // التطبيق أمامك: هو يرنّ بنفسه (SawaRTC) أو يعرض تنبيهاً — بلا إشعارٍ مكرّر. الإشعار التجريبيّ (C56) يُعرض دائماً ليراه المستخدم
    if (vis && d.t !== 'test') { vis.postMessage({ type: 'sawa-push', data: d }); return; }
    if (vis) vis.postMessage({ type: 'sawa-push', data: d });
    return self.registration.showNotification(d.title || 'سوا', {
      body: d.body || '', tag: d.cid || (d.call ? 'call-' + d.call : d.sid ? 'sched-' + d.sid : d.t === 'req' ? 'req-' + (d.uf || d.from || '') : d.t === 'moment' && d.pid ? 'mom-' + d.pid : 'sawa'), renotify: true, dir: 'auto', lang: 'ar',
      icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: d,
      requireInteraction: d.t === 'call', silent: false, vibrate: d.t === 'call' ? [300, 150, 300, 150, 300] : [120],
    });
  }));
});
self.addEventListener('notificationclick', (e) => {
  const d = e.notification.data || {};
  // C71: إشعار «مكالمة جارية»: «إنهاء» ⇒ التطبيق ينهي المكالمة · «العودة»/النقر ⇒ إظهار التطبيق
  if (d.t === 'ongoing') {
    if (e.action === 'end') { e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { cs.forEach((c) => c.postMessage({ type: 'sawa-hangup' })); e.notification.close(); })); return; }
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow('./'); }));
    return;
  }
  e.notification.close();
  const url = d.t === 'req' ? './?requests=1' : d.t === 'moment' && d.pid ? './?moment=' + encodeURIComponent(d.pid) + (d.cm ? '&cm=' + encodeURIComponent(d.cm) : '') : d.room ? './?room=' + encodeURIComponent(d.room) : './?' + (d.cid ? 'chat=' + encodeURIComponent(d.cid) : '') + (d.call ? '&call=' + encodeURIComponent(d.call) : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ type: 'sawa-open', data: d }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
