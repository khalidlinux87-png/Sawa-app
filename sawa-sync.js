/* ============================================================
   sawa-sync.js — طبقة الجسر بين التطبيق والخلفية (الـWorker + Firestore)
   ------------------------------------------------------------
   محلّيٌّ-أوّلاً: localStorage يبقى المخزن المؤقّت، والخادم مرجع.
   • connect()          — دخولٌ مجهول + وثيقة accounts/{uid}  (المرحلة B1)
   • watchGroup(gid,cb) — مستمعات Firestore الحيّة            (B2+)
   • push(op,payload)   — تحويل الكتابة إلى applyEdit           (B3+)

   يُحمَّل بعد firebase-*-compat و sawa-auth.js، قبل sawa-core/sawa-app.
   معزولٌ تماماً: فشله (شبكة محجوبة مثلاً) لا يُعطّل التطبيق إطلاقاً.

   مفتاح التفعيل: window.SAWA_SYNC (افتراضياً false).
     - false: connect() يعمل (دخولٌ مجهول فقط)، لكن push/watchGroup صامتان.
     - true : الكتابة تُرسَل، والمستمعات تُحدّث حالة التطبيق.
   شارة الفحص: افتح الرابط بـ ?sync=debug لرؤية حالة الاتصال على الشاشة.
   ============================================================ */
(function (global) {
  "use strict";

  var WORKER = "https://sawa-deploy-test.khalidlinux87.workers.dev";

  if (typeof global.SAWA_SYNC === "undefined") global.SAWA_SYNC = false;

  var state = {
    uid: null,
    ready: false,
    error: null,
    groupListeners: null,   // { gid, off }
  };
  var readyResolvers = [];

  // ---------- أدوات صغيرة ----------
  function log() {
    if (global.console && console.log) {
      try { console.log.apply(console, ["[sawa-sync]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }
  function hasFirebase() {
    return !!(global.firebase && firebase.auth && global.SawaAuth);
  }

  // ---------- B1: الاتصال والدخول المجهول ----------
  function connect() {
    if (state.ready && state.uid) return Promise.resolve(state.uid);
    return new Promise(function (resolve) {
      try {
        if (!hasFirebase()) throw new Error("Firebase/SawaAuth غير محمَّل");
        // تهيئة Firebase عبر SawaAuth (currentUser تستدعي ensureInit داخلياً).
        SawaAuth.currentUser();
        var auth = firebase.auth();

        // استمع لحالة الدخول: تثبّت الـuid وتُحدّث الشارة.
        auth.onAuthStateChanged(function (user) {
          if (user) {
            state.uid = user.uid;
            state.ready = true;
            state.error = null;
            paintBadge();
            log("uid =", user.uid, "| anon =", user.isAnonymous);
            flushReady(user.uid);
            drainQueue(); // أرسل ما تراكم في الطابور إن وُجد
          }
        });

        // ادخل مجهولاً إن لم تكن هناك جلسة قائمة.
        if (!auth.currentUser) {
          auth.signInAnonymously().catch(function (e) {
            state.error = (e && e.message) || "تعذّر الدخول المجهول";
            paintBadge();
            log("signInAnonymously فشل:", state.error);
            resolve(null);
          });
        }
        // حُلّ الوعد بالـuid الحاليّ أو عبر flushReady عند وصوله.
        onReady(resolve);
      } catch (e) {
        state.error = (e && e.message) || String(e);
        state.ready = false;
        paintBadge();
        log("connect فشل:", state.error);
        resolve(null); // محلّيٌّ-أوّلاً: لا نُسقِط التطبيق
      }
    });
  }

  function onReady(cb) {
    if (state.uid) { try { cb(state.uid); } catch (e) {} return; }
    readyResolvers.push(cb);
  }
  function flushReady(uid) {
    var list = readyResolvers; readyResolvers = [];
    list.forEach(function (cb) { try { cb(uid); } catch (e) {} });
  }

  function getToken() {
    try {
      var u = firebase.auth().currentUser;
      if (!u) return Promise.reject(new Error("لا مستخدم"));
      return u.getIdToken();
    } catch (e) { return Promise.reject(e); }
  }

  // ---------- B3+: إرسال الكتابة إلى الـWorker ----------
  var QKEY = "sawa_sync_queue";
  function loadQueue() { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch (e) { return []; } }
  function saveQueue(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {} }
  function enqueue(item) { var q = loadQueue(); q.push(item); saveQueue(q); }

  function sendOnce(op, payload) {
    return getToken().then(function (tok) {
      return fetch(WORKER, {
        method: "POST",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ op: op, payload: payload })
      });
    }).then(function (r) { return r.json(); });
  }

  // يُرسل أمراً. محلّيٌّ-أوّلاً: الفشل يذهب للطابور ويُعاد لاحقاً، ولا يُزعج المستخدم.
  function push(op, payload) {
    if (!global.SAWA_SYNC) return Promise.resolve({ skipped: true });
    return sendOnce(op, payload).then(function (b) {
      if (!b || b.ok === false) log("push ردّ غير ناجح:", op, b);
      return b;
    }).catch(function (e) {
      log("push فشل (إلى الطابور):", op, (e && e.message) || e);
      enqueue({ op: op, payload: payload, ts: Date.now() });
      return { ok: false, queuedLocally: true, error: String(e && e.message || e) };
    });
  }

  // يُفرّغ الطابور عند عودة الاتّصال/الدخول.
  var draining = false;
  function drainQueue() {
    if (draining || !global.SAWA_SYNC) return;
    var q = loadQueue();
    if (!q.length) return;
    draining = true;
    var item = q[0];
    sendOnce(item.op, item.payload).then(function () {
      var rest = loadQueue(); rest.shift(); saveQueue(rest);
      draining = false;
      if (rest.length) drainQueue();
    }).catch(function () { draining = false; /* نُعيد لاحقاً */ });
  }

  // ---------- B2+: مستمعات القراءة الحيّة ----------
  function watchGroup(gid, cbs) {
    if (!global.SAWA_SYNC || !gid) return function () {};
    // أغلق مستمع المجموعة السابقة (مستمعٌ واحدٌ في كلّ وقت — قرار §٨-٢).
    if (state.groupListeners && state.groupListeners.off) {
      try { state.groupListeners.off(); } catch (e) {}
    }
    try {
      var db = firebase.firestore();
      var base = db.collection("groups").doc(gid);
      var offP = base.collection("persons").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(personFromDoc(d.id, d.data())); });
        cbs && cbs.onPersons && cbs.onPersons(arr);
      }, function (e) { log("مستمع الأشخاص:", (e && e.message) || e); });
      var offR = base.collection("relations").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(relFromDoc(gid, d.id, d.data())); });
        cbs && cbs.onRelations && cbs.onRelations(arr);
      }, function (e) { log("مستمع الصلات:", (e && e.message) || e); });
      var off = function () { try { offP(); } catch (e) {} try { offR(); } catch (e) {} };
      state.groupListeners = { gid: gid, off: off };
      return off;
    } catch (e) {
      log("watchGroup فشل:", (e && e.message) || e);
      return function () {};
    }
  }

  // ---------- مُحوِّلات الشكل ----------
  // حقول الشخص المسموح بمزامنتها (⛔ healthStatus محظور — لا يُرسَل أبداً).
  var PERSON_FIELDS = ["local_name", "gender", "kinship", "birthYear", "deathYear",
                       "phones", "notes", "alive", "favorite", "motherId"];
  function personToFields(p) {
    var out = {};
    for (var i = 0; i < PERSON_FIELDS.length; i++) {
      var k = PERSON_FIELDS[i];
      if (p && p[k] !== undefined) out[k] = p[k];
    }
    return out; // لا id، لا healthStatus
  }
  function relToServer(r) {
    return { groupId: r.groupId, type: r.type, from: r.source, to: r.target };
  }
  function personFromDoc(id, data) {
    var p = { id: id };
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      if (k === "fts" || k === "healthStatus") continue; // بيانات تعارضٍ داخلية
      p[k] = data[k];
    }
    return p;
  }
  function relFromDoc(gid, id, data) {
    return { id: id, groupId: gid, source: data.from, target: data.to, type: data.type };
  }

  // ---------- شارة الفحص (اختياريّة، للجوّال) ----------
  function debugOn() {
    try {
      if (/[?&]sync=debug/.test(global.location.search)) return true;
      return localStorage.getItem("sawa_sync_debug") === "1";
    } catch (e) { return false; }
  }
  var badgeEl = null;
  function paintBadge() {
    if (!debugOn()) return;
    try {
      if (!badgeEl) {
        badgeEl = global.document.createElement("div");
        badgeEl.style.cssText = "position:fixed;left:8px;bottom:70px;z-index:99999;" +
          "font:600 11px system-ui;padding:6px 10px;border-radius:10px;" +
          "box-shadow:0 2px 8px rgba(0,0,0,.25);direction:ltr;pointer-events:none;max-width:70vw";
        global.document.body.appendChild(badgeEl);
      }
      var ok = state.ready && state.uid;
      badgeEl.style.background = ok ? "#187854" : (state.error ? "#b23b3b" : "#8a6d1f");
      badgeEl.style.color = "#fff";
      badgeEl.textContent = "sync " + (global.SAWA_SYNC ? "ON" : "off") + " · " +
        (ok ? ("uid " + String(state.uid).slice(0, 6) + "…")
            : (state.error ? ("err: " + state.error) : "connecting…"));
    } catch (e) {}
  }

  // ---------- الواجهة العامّة ----------
  global.SawaSync = {
    connect: connect,
    onReady: onReady,
    getToken: getToken,
    push: push,
    watchGroup: watchGroup,
    personToFields: personToFields,
    relToServer: relToServer,
    uid: function () { return state.uid; },
    isReady: function () { return !!(state.ready && state.uid); },
    _state: state
  };

  // ---------- إقلاعٌ ذاتيّ (لا يلمس sawa-app.js) ----------
  function boot() {
    paintBadge();            // يُظهر "connecting…" لو الفحص مُفعَّل
    connect().then(function (uid) {
      paintBadge();
      log(uid ? ("متّصل: " + uid) : "تعذّر الاتصال — التطبيق يعمل محلّياً");
    });
  }
  if (global.document && document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
