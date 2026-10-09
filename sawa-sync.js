/* ============================================================
   sawa-sync.js — طبقة الجسر بين التطبيق والخلفية (الـWorker + Firestore)
   ------------------------------------------------------------
   محلّيٌّ-أوّلاً: localStorage يبقى المخزن، والخادم مرجع للمجموعات المرفوعة.

   • connect()            — دخولٌ مجهول + accounts/{uid}                (B1)
   • observe(...)         — يُنادى من sawa-app.js عند كلّ تغيّر؛ يرسل الفرق
                            للمجموعات المرفوعة (ما عدا دور «مشاهد»)        (B4)
   • bindApp(setters)     — يُنادى مرّة من sawa-app.js ليطبّق الجسر بيانات
                            الخادم على حالة التطبيق                          (B5)
   • openPanel()          — لوحة «السحابة والمشاركة»: حساب Google، الرفع،
                            روابط المشاركة، استعادة العائلات                   (B5)
   • ?join=TOKEN          — رابط دعوة: ينضمّ ويستعيد العائلة تلقائياً         (B5)

   المجموعات: معرّفها المحلّيّ (g-1…) غير فريد عالمياً ⇒ يولّده الخادم، والربط
   في sawa_group_map {localGid: serverGid}، والأدوار في sawa_group_roles.
   الأشخاص والصلات: المعرّف المحلّيّ = معرّف الخادم (قرار §٨-١).

   ⛔ الخصوصية: status_detail (الحالة الصحّية) و healthStatus و photo لا تغادر
   الجهاز أبداً — ليست في SYNC_FIELDS، وتُحفَظ محلّياً عند دمج بيانات الخادم.

   مفتاح الإيقاف: ?sync=off (و ?sync=on للإعادة). شارة الفحص: ?sync=debug.
   ============================================================ */
(function (global) {
  "use strict";

  var WORKER = "https://sawa-deploy-test.khalidlinux87.workers.dev";

  // مطابقةٌ تماماً لقائمة ALLOWED في الـWorker (v8+).
  var SYNC_FIELDS = ["local_name", "gender", "kinship", "proximity", "birthYear", "birthday",
                     "alive", "death_date", "deathYear", "contacts", "phones", "notes", "motherId"];

  var state = {
    uid: null, ready: false, error: null, isAnon: true, email: null,
    groupListeners: null, watching: null,
    reviews: 0, lastAck: "", sending: false
  };
  var readyResolvers = [];

  // ---------- أدوات ----------
  function log() {
    if (global.console && console.log) {
      try { console.log.apply(console, ["[sawa-sync]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }
  function lsGet(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsRead(key, fb) { return lsGet("sawa:" + key, fb); } // مخازن التطبيق (البادئة sawa:)
  function isAr() { try { return (localStorage.getItem("sawaLang") || "ar") === "ar"; } catch (e) { return true; } }
  function L(ar, en) { return isAr() ? ar : en; }
  function clock() { var d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":"); }
  function hasFirebase() { return !!(global.firebase && firebase.auth && global.SawaAuth); }

  function enabled() {
    try {
      if (/[?&]sync=off/.test(global.location.search)) localStorage.setItem("sawa_sync_off", "1");
      if (/[?&]sync=on/.test(global.location.search)) localStorage.removeItem("sawa_sync_off");
      return localStorage.getItem("sawa_sync_off") !== "1";
    } catch (e) { return true; }
  }
  global.SAWA_SYNC = enabled();

  // ---------- B1: الاتصال ----------
  function setUser(user) {
    state.uid = user.uid; state.ready = true; state.error = null;
    state.isAnon = !!user.isAnonymous;
    state.email = user.email || (user.providerData && user.providerData[0] && user.providerData[0].email) || null;
  }
  function connect() {
    if (state.ready && state.uid) return Promise.resolve(state.uid);
    return new Promise(function (resolve) {
      try {
        if (!hasFirebase()) throw new Error("Firebase/SawaAuth غير محمَّل");
        SawaAuth.currentUser(); // يُهيّئ Firebase
        var auth = firebase.auth();
        auth.onAuthStateChanged(function (user) {
          if (user) {
            var changed = state.uid && state.uid !== user.uid;
            setUser(user);
            paintBadge(); flushReady(user.uid); drain();
            if (changed) { rewatch(); }
            renderPanel();
          }
        });
        // نتيجة ربطٍ بإعادة التوجيه (بديل النافذة المنبثقة)
        handleRedirectResult();
        if (!auth.currentUser) {
          auth.signInAnonymously().catch(function (e) {
            state.error = (e && e.message) || "تعذّر الدخول المجهول";
            paintBadge(); resolve(null);
          });
        }
        onReady(resolve);
      } catch (e) {
        state.error = (e && e.message) || String(e); state.ready = false;
        paintBadge(); log("connect فشل:", state.error); resolve(null);
      }
    });
  }
  function onReady(cb) {
    if (state.uid) { try { cb(state.uid); } catch (e) {} return; }
    readyResolvers.push(cb);
  }
  function flushReady(uid) {
    var l = readyResolvers; readyResolvers = [];
    l.forEach(function (cb) { try { cb(uid); } catch (e) {} });
  }
  function getToken() {
    try {
      var u = firebase.auth().currentUser;
      if (!u) return Promise.reject(new Error("لا مستخدم"));
      return u.getIdToken();
    } catch (e) { return Promise.reject(e); }
  }
  function sendWith(tok, op, payload) {
    return fetch(WORKER, {
      method: "POST",
      headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify({ op: op, payload: payload })
    }).then(function (r) { return r.json(); });
  }
  function sendOnce(op, payload) { return getToken().then(function (tok) { return sendWith(tok, op, payload); }); }
  function call(op, payload) { // كـsendOnce لكن يرمي عند الرفض
    return sendOnce(op, payload).then(function (b) {
      if (!b || b.ok === false) throw new Error((b && b.error) || (op + " failed"));
      return b;
    });
  }

  // ---------- صندوق الصادر: طابورٌ متسلسل محفوظ ----------
  var OUTBOX = "sawa_outbox", FAILED = "sawa_sync_failed";
  var retryTimer = null;
  function outboxLen() { return lsGet(OUTBOX, []).length; }
  function enqueue(op, payload) {
    var q = lsGet(OUTBOX, []); q.push({ op: op, payload: payload, ts: Date.now() }); lsSet(OUTBOX, q);
    paintBadge(); drain();
  }
  function push(op, payload) { if (!enabled()) return; enqueue(op, payload); }
  function drain() {
    if (state.sending || !state.uid || !enabled()) return;
    var q = lsGet(OUTBOX, []);
    if (!q.length) { applyPendingRemote(); return; }
    state.sending = true;
    var item = q[0];
    sendOnce(item.op, item.payload).then(function (b) {
      var rest = lsGet(OUTBOX, []); rest.shift(); lsSet(OUTBOX, rest);
      if (!b || b.ok === false) {
        var f = lsGet(FAILED, []); f.push({ op: item.op, error: b && b.error, ts: Date.now() });
        lsSet(FAILED, f.slice(-20));
        log("رُفض:", item.op, b && b.error);
        state.lastAck = "✗ " + item.op;
      } else {
        state.lastAck = "✓ " + item.op;
        if (b.queued) { state.reviews++; toast(L("تعديلٌ ذهب للمراجعة", "A change was sent for review")); }
      }
      state.sending = false; paintBadge(); drain();
    }).catch(function (e) {
      state.sending = false; state.lastAck = "… " + item.op + " (" + String((e && e.message) || e).slice(0, 40) + ")"; paintBadge();
      log("شبكة — إعادة لاحقاً:", (e && e.message) || e);
      if (!retryTimer) retryTimer = setTimeout(function () { retryTimer = null; drain(); }, 15000);
    });
  }
  try { global.addEventListener("online", drain); } catch (e) {}

  // ---------- ربط المجموعات والأدوار ----------
  function groupMap() { return lsGet("sawa_group_map", {}); }
  function serverGid(localGid) { return groupMap()[localGid] || null; }
  function localGidOf(sg) { var m = groupMap(); for (var k in m) if (m[k] === sg) return k; return null; }
  function setMap(localGid, sg) { var m = groupMap(); m[localGid] = sg; lsSet("sawa_group_map", m); }
  function roles() { return lsGet("sawa_group_roles", {}); }
  function roleOf(sg) { return roles()[sg] || "owner"; } // ما رُفع قبل v9 رفعه صاحبه
  function setRole(sg, role) { var r = roles(); r[sg] = role; lsSet("sawa_group_roles", r); }
  function mappedServerGids() { var m = groupMap(), out = []; for (var k in m) out.push(m[k]); return out; }

  // ---------- B4: المراقبة وحساب الفرق ----------
  function personToFields(p) {
    var out = {};
    for (var i = 0; i < SYNC_FIELDS.length; i++) {
      var k = SYNC_FIELDS[i];
      if (p && p[k] !== undefined) out[k] = p[k];
    }
    return out;
  }
  function snapshot(localGid, gp, rels) {
    var persons = {}, relations = {};
    ((gp && gp[localGid]) || []).forEach(function (p) { if (p && p.id) persons[p.id] = personToFields(p); });
    (rels || []).forEach(function (r) {
      if (r && r.id && r.groupId === localGid)
        relations[r.id] = { source: r.source, target: r.target, type: r.type, inferred: r.inferred || null };
    });
    return { persons: persons, relations: relations };
  }
  function same(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }

  function diffAndEnqueue(sg, base, snap) {
    var id, k, n = 0;
    for (id in snap.persons) {
      var cur = snap.persons[id], old = base.persons[id];
      if (!old) { enqueue("person.set", { groupId: sg, personId: id, fields: cur }); n++; continue; }
      var changed = {}, any = false, keys = {};
      for (k in cur) keys[k] = 1;
      for (k in old) keys[k] = 1;
      for (k in keys) if (!same(cur[k], old[k])) { changed[k] = cur[k] === undefined ? null : cur[k]; any = true; }
      if (any) { enqueue("person.set", { groupId: sg, personId: id, fields: changed }); n++; }
    }
    for (id in snap.relations) {
      var r = snap.relations[id], b = base.relations[id];
      var addPayload = { groupId: sg, relationId: id, type: r.type, from: r.source, to: r.target };
      if (r.inferred) addPayload.inferred = r.inferred;
      if (!b) { enqueue("relation.add", addPayload); n++; continue; }
      if (b.source !== r.source || b.target !== r.target) {
        enqueue("relation.remove", { groupId: sg, relationId: id });
        enqueue("relation.add", addPayload); n++;
      } else if (b.type !== r.type) {
        enqueue("relation.update", { groupId: sg, relationId: id, type: r.type }); n++;
      }
    }
    for (id in base.relations) if (!snap.relations[id]) { enqueue("relation.remove", { groupId: sg, relationId: id }); n++; }
    for (id in base.persons) if (!snap.persons[id]) { enqueue("person.delete", { groupId: sg, personId: id }); n++; }
    return n;
  }

  var baseline = {};          // localGid -> لقطة آخر حالةٍ متّفقٍ عليها مع الخادم
  var applying = {};          // localGid -> true أثناء تطبيق بيانات الخادم (لا ترسل صداها)
  var lastGp = null, lastRels = null, lastCur = null, lastGroups = null;
  var viewerWarned = {};
  function observe(gp, rels, currentGid, familyGroups) {
    lastGp = gp; lastRels = rels;
    if (familyGroups) lastGroups = familyGroups;
    if (currentGid !== undefined && currentGid !== lastCur) { lastCur = currentGid; rewatch(); renderPanel(); }
    if (!enabled()) return;
    var map = groupMap();
    for (var localGid in map) {
      if (!Object.prototype.hasOwnProperty.call(map, localGid)) continue;
      var snap = snapshot(localGid, gp, rels);
      var base = baseline[localGid];
      baseline[localGid] = snap;
      if (applying[localGid]) { applying[localGid] = false; continue; } // صدى الخادم
      if (!base) continue;      // أوّل مراقبة بعد الفتح = خطّ الأساس
      var sg = map[localGid];
      if (roleOf(sg) === "viewer") {
        if (JSON.stringify(base) !== JSON.stringify(snap) && !viewerWarned[sg]) {
          viewerWarned[sg] = true;
          toast(L("أنت مشاهد في هذه العائلة — تعديلاتك لا تُحفَظ على الخادم", "You're a viewer here — your edits aren't saved to the server"));
        }
        continue;
      }
      diffAndEnqueue(sg, base, snap);
    }
  }

  // ---------- B5: ربط التطبيق + القراءة من الخادم ----------
  var app = null, appWaiters = [];
  function bindApp(api) {
    app = api;
    var w = appWaiters; appWaiters = [];
    w.forEach(function (cb) { try { cb(); } catch (e) {} });
    rewatch();
  }
  function whenApp(cb) { if (app) cb(); else appWaiters.push(cb); }
  function currentLocalGid() { return lastCur != null ? lastCur : lsRead("currentGroupId", "g-1"); }

  var remote = null; // { localGid, sg, persons, relations } آخر لقطةٍ من الخادم
  function rewatch() {
    if (!app || !state.uid || !enabled()) return;
    var lg = currentLocalGid(), sg = serverGid(lg);
    if (!sg) { if (state.groupListeners) { try { state.groupListeners.off(); } catch (e) {} state.groupListeners = null; } state.watching = null; return; }
    if (state.watching === sg + "|" + state.uid) return;
    state.watching = sg + "|" + state.uid;
    remote = { localGid: lg, sg: sg, persons: null, relations: null };
    state.dbgGid = sg;
    rawWatch(sg, {
      onPersons: function (arr) {
        if (!remote || remote.sg !== sg) return;
        remote.persons = arr.filter(function (p) { return p.deleted !== true; });
        state.lastSnap = clock();
        state.dbgPersons = remote.persons.length; paintBadge();
        applyPendingRemote();
      },
      onRelations: function (arr) {
        if (!remote || remote.sg !== sg) return;
        remote.relations = arr.filter(function (r) { return !r.deleted; });
        state.lastSnap = clock();
        state.dbgRelations = remote.relations.length; paintBadge();
        applyPendingRemote();
      },
      onError: function (e) {
        // فقدان الصلاحيّة (أُزيلت العضوية مثلاً): نتوقّف عن المزامنة بصمت
        log("القراءة مرفوضة:", e && e.code);
        state.applyNote = "listen✗ " + ((e && e.code) || "err"); paintBadge();
      }
    });
  }
  function mergePersons(localList, remoteList) {
    var byId = {}; (localList || []).forEach(function (p) { byId[p.id] = p; });
    var seen = {}, out = [];
    (localList || []).forEach(function (p) {
      var r = null;
      for (var i = 0; i < remoteList.length; i++) if (remoteList[i].id === p.id) { r = remoteList[i]; break; }
      if (!r) return; // حُذف في الخادم
      var m = {}; for (var k in p) m[k] = p[k];
      for (var j = 0; j < SYNC_FIELDS.length; j++) { var f = SYNC_FIELDS[j]; if (f in r) m[f] = r[f]; }
      out.push(m); seen[p.id] = 1;
    });
    remoteList.forEach(function (r) {
      if (seen[r.id]) return;
      var m = { id: r.id };
      for (var j = 0; j < SYNC_FIELDS.length; j++) { var f = SYNC_FIELDS[j]; if (f in r) m[f] = r[f]; }
      if (m.alive === undefined) m.alive = true;
      out.push(m);
    });
    return out;
  }
  function remoteRels(lg, list) {
    return list.map(function (r) {
      var o = { id: r.id, groupId: lg, source: r.source, target: r.target, type: r.type };
      if (r.inferred) o.inferred = r.inferred;
      return o;
    });
  }
  function applyPendingRemote() {
    if (!app || !remote || !remote.persons || !remote.relations) { state.applyNote = !app ? "noapp" : "wait"; paintBadge(); return; }
    if (outboxLen() > 0 || state.sending) { state.applyNote = "defer(Q)"; paintBadge(); return; } // تعديلاتنا أوّلاً
    var lg = remote.localGid;
    if (serverGid(lg) !== remote.sg) { state.applyNote = "gid≠"; paintBadge(); return; }
    var gp = lastGp || {}, rels = lastRels || [];
    var nextList = mergePersons(gp[lg] || [], remote.persons);
    var nextRels = rels.filter(function (r) { return r.groupId !== lg; }).concat(remoteRels(lg, remote.relations));
    var nextGp = {}; for (var k in gp) nextGp[k] = gp[k]; nextGp[lg] = nextList;
    var before = snapshot(lg, gp, rels), after = snapshot(lg, nextGp, nextRels);
    if (JSON.stringify(before) === JSON.stringify(after)) { state.applyNote = "same"; paintBadge(); return; } // متطابقان
    applying[lg] = true;
    baseline[lg] = after;
    app.setGroupPersons(function (prev) { var o = {}; for (var k in prev) o[k] = prev[k]; o[lg] = mergePersons(prev[lg] || [], remote.persons); return o; });
    app.setKinshipRelations(function (prev) { return prev.filter(function (r) { return r.groupId !== lg; }).concat(remoteRels(lg, remote.relations)); });
    state.applyNote = "applied " + clock(); paintBadge();
  }

  // ---------- «ارفع شجرتي» ----------
  function buildImport(localGid, gp, rels) {
    var groups = lastGroups || lsRead("familyGroups", []);
    var gObj = (groups || []).filter(function (g) { return g && g.id === localGid; })[0];
    var persons = (gp && gp[localGid]) || [];
    var groupRels = (rels || []).filter(function (r) { return r && r.groupId === localGid; });
    return {
      persons: persons, groupRels: groupRels,
      payload: {
        name: (gObj && gObj.name) || "عائلتي",
        persons: persons.map(function (p) { var o = personToFields(p); o.localId = p.id; return o; }),
        relations: groupRels.map(function (r) {
          var o = { localId: r.id, fromLocalId: r.source, toLocalId: r.target, type: r.type };
          if (r.inferred) o.inferred = r.inferred;
          return o;
        })
      }
    };
  }
  function uploadGroup(localGid, gp, rels) {
    var built = buildImport(localGid, gp, rels);
    return call("bulk.import", built.payload).then(function (b) {
      setMap(localGid, b.groupId); setRole(b.groupId, "owner");
      baseline[localGid] = snapshot(localGid, gp, rels);
      state.watching = null; rewatch();
      return b;
    });
  }
  function uploadCurrent() {
    var localGid = currentLocalGid();
    var gp = lastGp || lsRead("groupPersons", {});
    var rels = lastRels || lsRead("kinshipRelations", []);
    var n = ((gp && gp[localGid]) || []).length;
    if (!n) { toast(L("المجموعة الحالية لا تحوي أشخاصاً بعد", "This group has no people yet")); return Promise.resolve(null); }
    if (serverGid(localGid)) {
      var again = global.confirm(L(
        "شجرة هذه المجموعة مرفوعةٌ ومتزامنة. أترفع نسخةً جديدة كاملة؟ (يتوقّف الربط بالنسخة القديمة ومن شاركتَها معهم)",
        "This tree is already synced. Upload a fresh full copy? (unlinks the old copy and anyone you shared it with)"));
      if (!again) return Promise.resolve(null);
    }
    if (!state.uid) { toast(L("تعذّر الاتصال بالخادم — حاول بعد قليل", "Can't reach the server — try again shortly")); return Promise.resolve(null); }
    toast(L("جارٍ رفع الشجرة…", "Uploading tree…"));
    return uploadGroup(localGid, gp, rels).then(function (b) {
      toast(L("رُفعت شجرتك: " + b.personsImported + " شخصاً و" + b.relationsImported + " صلة ✓",
              "Tree uploaded: " + b.personsImported + " people, " + b.relationsImported + " links ✓"));
      paintBadge(); renderPanel();
      return b;
    }).catch(function (e) {
      toast(L("تعذّر الرفع: ", "Upload failed: ") + ((e && e.message) || e));
      return null;
    });
  }

  // ---------- B5: الهويّة — ربط حساب Google ----------
  function indexMine() {
    var ids = mappedServerGids();
    if (!ids.length || !state.uid) return Promise.resolve(null);
    return sendOnce("account.index", { groupIds: ids }).catch(function () { return null; });
  }
  function credFromError(e) {
    try {
      return e.credential || (firebase.auth.GoogleAuthProvider.credentialFromError && firebase.auth.GoogleAuthProvider.credentialFromError(e)) || null;
    } catch (x) { return null; }
  }
  function adoptFrom(oldTok) {
    return call("account.adopt", { fromToken: oldTok, groupIds: mappedServerGids() }).then(function (r) {
      (r.adopted || []).forEach(function (sg) { if (!roles()[sg]) setRole(sg, "owner"); });
      return r;
    });
  }
  function afterLinked(msg) {
    var u = firebase.auth().currentUser; if (u) setUser(u);
    state.watching = null; rewatch();
    return indexMine().then(function () { toast(msg); renderPanel(); refreshMyGroups(); });
  }
  function linkGoogle() {
    if (!hasFirebase() || !state.uid) { toast(L("تعذّر الاتصال بالخادم", "Can't reach the server")); return; }
    var auth = firebase.auth(), user = auth.currentUser;
    if (user && !user.isAnonymous) { toast(L("حسابك مربوطٌ سلفاً", "Already linked")); return; }
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    var oldTokP = user.getIdToken();
    // فهرس الهويّة الحالية أوّلاً (يلزم لتبنّيها إن احتجنا)
    indexMine();
    user.linkWithPopup(provider).then(function () {
      return afterLinked(L("رُبط حسابك بـGoogle ✓ — ادخل به من أيّ جهاز", "Linked to Google ✓ — sign in with it on any device"));
    }).catch(function (e) {
      var code = e && e.code;
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        // حساب Google مرتبطٌ بهويّةٍ أخرى سلفاً: ندخل بها ونتبنّى عضويّات هذا الجهاز
        var cred = credFromError(e);
        return oldTokP.then(function (oldTok) {
          var signIn = cred ? auth.signInWithCredential(cred) : auth.signInWithPopup(provider);
          return signIn.then(function () { return adoptFrom(oldTok); }).then(function () {
            return afterLinked(L("دخلتَ بحسابك على Google ✓ ونُقلت عائلات هذا الجهاز إليه", "Signed in with Google ✓ — this device's families moved to your account"));
          });
        }).catch(function (x) { toast(L("تعذّر الدخول: ", "Sign-in failed: ") + ((x && x.message) || x)); });
      }
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment" || code === "auth/cancelled-popup-request") {
        // بديل: إعادة التوجيه. نحفظ رمز الهويّة الحالية لتبنّيها بعد العودة.
        return oldTokP.then(function (oldTok) {
          try { sessionStorage.setItem("sawa_adopt_tok", oldTok); } catch (x) {}
          return user.linkWithRedirect(provider);
        });
      }
      if (code === "auth/popup-closed-by-user") return;
      toast(L("تعذّر الربط: ", "Linking failed: ") + ((e && (e.code || e.message)) || e));
    });
  }
  function handleRedirectResult() {
    try {
      var auth = firebase.auth();
      auth.getRedirectResult().then(function (res) {
        if (res && res.user) {
          try { sessionStorage.removeItem("sawa_adopt_tok"); } catch (x) {}
          onReady(function () { afterLinked(L("رُبط حسابك بـGoogle ✓", "Linked to Google ✓")); });
        }
      }).catch(function (e) {
        var code = e && e.code;
        if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
          var cred = credFromError(e), oldTok = null;
          try { oldTok = sessionStorage.getItem("sawa_adopt_tok"); sessionStorage.removeItem("sawa_adopt_tok"); } catch (x) {}
          if (!cred) return;
          auth.signInWithCredential(cred).then(function () { return oldTok ? adoptFrom(oldTok) : null; })
            .then(function () { afterLinked(L("دخلتَ بحسابك على Google ✓", "Signed in with Google ✓")); })
            .catch(function (x) { toast(L("تعذّر الدخول: ", "Sign-in failed: ") + ((x && x.message) || x)); });
        }
      });
    } catch (e) {}
  }

  // ---------- B5: المشاركة والانضمام والاستعادة ----------
  function shareLink(role) {
    var lg = currentLocalGid(), sg = serverGid(lg);
    if (!sg) { toast(L("ارفع الشجرة أوّلاً", "Upload the tree first")); return; }
    toast(L("جارٍ إنشاء الرابط…", "Creating link…"));
    call("invite.create", { groupId: sg, role: role }).then(function (b) {
      var url = global.location.origin + global.location.pathname + "?join=" + b.token;
      var gname = groupName(lg);
      var text = role === "editor"
        ? L("رابط تحرير شجرة «" + gname + "» في سوا (صالح أسبوعاً):", "Edit link for the «" + gname + "» tree on Sawa (valid 1 week):")
        : L("انضمّ لمشاهدة شجرة «" + gname + "» في سوا (صالح أسبوعاً):", "Join to view the «" + gname + "» tree on Sawa (valid 1 week):");
      if (global.navigator && navigator.share) {
        navigator.share({ title: "سوا", text: text, url: url }).catch(function () {});
      } else if (global.navigator && navigator.clipboard) {
        navigator.clipboard.writeText(text + " " + url).then(function () { toast(L("نُسخ الرابط ✓", "Link copied ✓")); },
          function () { global.prompt(L("انسخ الرابط:", "Copy the link:"), url); });
      } else {
        global.prompt(L("انسخ الرابط:", "Copy the link:"), url);
      }
    }).catch(function (e) { toast(L("تعذّر إنشاء الرابط: ", "Couldn't create link: ") + ((e && e.message) || e)); });
  }
  function restoreGroup(sg, name, role) {
    var existing = localGidOf(sg);
    setRole(sg, role || "viewer");
    if (existing) { app.setCurrentGroupId(existing); return existing; }
    var lg = "g-" + Date.now();
    setMap(lg, sg);
    baseline[lg] = { persons: {}, relations: {} };
    app.setFamilyGroups(function (prev) { return (prev || []).concat([{ id: lg, name: name || "عائلتي", description: "", role: role || "viewer" }]); });
    app.setGroupPersons(function (prev) { var o = {}; for (var k in prev) o[k] = prev[k]; o[lg] = []; return o; });
    if (app.setGroupSettings) app.setGroupSettings(function (prev) { var o = {}; for (var k in prev) o[k] = prev[k]; o[lg] = { allowMemberEvents: false }; return o; });
    app.setCurrentGroupId(lg);
    return lg;
  }
  function roleLabel(role) {
    return role === "owner" ? L("مالك", "owner") : role === "editor" ? L("محرّر", "editor") : L("مشاهد", "viewer");
  }
  function handleJoin() {
    var tok = null;
    try { tok = new URLSearchParams(global.location.search).get("join"); } catch (e) {}
    if (!tok) return;
    onReady(function () {
      whenApp(function () {
        call("invite.accept", { token: tok }).then(function (b) {
          restoreGroup(b.groupId, b.name, b.role);
          toast(L("انضممتَ إلى «" + (b.name || "العائلة") + "» (" + roleLabel(b.role) + ") ✓",
                  "Joined «" + (b.name || "family") + "» (" + roleLabel(b.role) + ") ✓"));
        }).catch(function (e) {
          var m = (e && e.message) || "";
          toast(/expired/.test(m) ? L("انتهت صلاحيّة رابط الدعوة", "This invite link has expired")
                                  : L("تعذّر الانضمام: ", "Couldn't join: ") + m);
        }).then(function () {
          try { var u = new URL(global.location.href); u.searchParams.delete("join"); global.history.replaceState(null, "", u.toString()); } catch (e) {}
        });
      });
    });
  }
  var myGroups = null, myGroupsLoading = false;
  function refreshMyGroups() {
    if (!state.uid || myGroupsLoading) return;
    myGroupsLoading = true; renderPanel();
    call("my.groups", {}).then(function (b) {
      myGroups = b.groups || [];
      myGroups.forEach(function (g) { if (localGidOf(g.groupId)) setRole(g.groupId, g.role); });
    }).catch(function () { myGroups = myGroups || []; })
      .then(function () { myGroupsLoading = false; renderPanel(); });
  }
  function groupName(lg) {
    var groups = lastGroups || lsRead("familyGroups", []);
    var g = (groups || []).filter(function (x) { return x && x.id === lg; })[0];
    return (g && g.name) || L("عائلتي", "My family");
  }

  // ---------- B5: لوحة «السحابة والمشاركة» ----------
  var panelEl = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function openPanel() {
    if (!panelEl) {
      panelEl = document.createElement("div");
      panelEl.id = "sawa-cloud-panel";
      panelEl.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-act]") : null;
        if (ev.target === panelEl) { closePanel(); return; }
        if (!t) return;
        var act = t.getAttribute("data-act");
        if (act === "close") closePanel();
        else if (act === "google") linkGoogle();
        else if (act === "upload") uploadCurrent();
        else if (act === "share-viewer") shareLink("viewer");
        else if (act === "share-editor") shareLink("editor");
        else if (act === "restore") {
          var sg = t.getAttribute("data-gid");
          var g = (myGroups || []).filter(function (x) { return x.groupId === sg; })[0];
          if (g && app) { restoreGroup(g.groupId, g.name, g.role); toast(L("جارٍ استعادة «" + g.name + "»…", "Restoring «" + g.name + "»…")); closePanel(); }
        }
      });
      document.body.appendChild(panelEl);
    }
    panelEl.style.display = "flex";
    renderPanel();
    refreshMyGroups();
  }
  function closePanel() { if (panelEl) panelEl.style.display = "none"; }
  function renderPanel() {
    if (!panelEl || panelEl.style.display === "none") return;
    var ar = isAr(), dir = ar ? "rtl" : "ltr";
    var lg = currentLocalGid(), sg = serverGid(lg), role = sg ? roleOf(sg) : null;
    var btn = function (act, label, primary, extra) {
      return '<button data-act="' + act + '"' + (extra || "") + ' style="display:block;width:100%;margin:8px 0 0;padding:12px 14px;border-radius:12px;font:700 15px system-ui;cursor:pointer;' +
        (primary ? 'background:#187854;color:#fff;border:none;' : 'background:#fff;color:#1E3A63;border:1.5px solid #cfdbe8;') + '">' + label + '</button>';
    };
    var sec = function (title, body) {
      return '<div style="background:#f5f8fb;border-radius:14px;padding:14px;margin-top:12px"><div style="font:800 13px system-ui;color:#5b6b7c;margin-bottom:6px">' + title + '</div>' + body + '</div>';
    };
    var p = function (txt, color) { return '<div style="font:500 14px/1.6 system-ui;color:' + (color || "#1f2d3a") + '">' + txt + '</div>'; };

    var acct;
    if (!state.uid) acct = p(L("جارٍ الاتصال بالخادم…", "Connecting…"), "#8a6d1f");
    else if (state.isAnon) acct = p(L("ضيف — هويّتك محفوظة في هذا المتصفّح فقط. اربطها بحساب Google لتصل لعائلتك من أيّ جهاز ولا تضيع عند مسح المتصفّح.",
                                       "Guest — your identity lives in this browser only. Link Google to reach your family from any device.")) +
                               btn("google", L("ربط بحساب Google", "Link Google account"), true);
    else acct = p("✓ " + esc(state.email || L("حساب Google", "Google account")), "#187854");

    var fam = '<div style="font:800 16px system-ui;color:#1f2d3a">' + esc(groupName(lg)) + '</div>';
    if (!sg) fam += p(L("محفوظة على هذا الجهاز فقط.", "Saved on this device only.")) + btn("upload", L("ارفع شجرتي إلى السحابة", "Upload my tree"), true);
    else {
      fam += p(L("متزامنة مع السحابة ✓ · دورك: ", "Synced ✓ · your role: ") + roleLabel(role), "#187854");
      if (role === "owner" || role === "editor") fam += btn("share-viewer", L("مشاركة للمشاهدة (رابط)", "Share view-only link"));
      if (role === "owner") fam += btn("share-editor", L("رابط تحرير (لأجهزتك أو من تثق به)", "Edit link (your devices / trusted)"));
      if (role === "owner") fam += btn("upload", L("رفع نسخة جديدة كاملة", "Re-upload a fresh copy"), false, ' data-small="1"');
    }

    var mine;
    if (myGroupsLoading && !myGroups) mine = p(L("جارٍ التحميل…", "Loading…"), "#5b6b7c");
    else {
      var others = (myGroups || []).filter(function (g) { return !localGidOf(g.groupId); });
      if (!others.length) mine = p(L("لا عائلات أخرى على حسابك.", "No other families on your account."), "#5b6b7c");
      else mine = others.map(function (g) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px">' +
          '<div style="font:700 14px system-ui">' + esc(g.name) + ' <span style="font-weight:500;color:#5b6b7c">· ' + roleLabel(g.role) + '</span></div>' +
          '<button data-act="restore" data-gid="' + esc(g.groupId) + '" style="padding:8px 12px;border-radius:10px;border:none;background:#2F80C8;color:#fff;font:700 13px system-ui">' + L("استعادة", "Restore") + '</button></div>';
      }).join("");
    }

    panelEl.setAttribute("dir", dir);
    panelEl.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(10,20,30,.45);display:flex;align-items:flex-end;justify-content:center";
    panelEl.innerHTML =
      '<div style="background:#fff;width:100%;max-width:520px;max-height:88vh;overflow:auto;border-radius:20px 20px 0 0;padding:18px 16px 24px;box-shadow:0 -6px 24px rgba(0,0,0,.2)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font:800 19px system-ui;color:#1f2d3a">' + L("السحابة والمشاركة", "Cloud & sharing") + '</div>' +
          '<button data-act="close" aria-label="close" style="border:none;background:#eef2f6;border-radius:50%;width:34px;height:34px;font:700 18px system-ui;cursor:pointer">×</button>' +
        '</div>' +
        sec(L("حسابك", "Your account"), acct) +
        sec(L("هذه العائلة", "This family"), fam) +
        sec(L("عائلات على حسابك", "Families on your account"), mine) +
      '</div>';
  }

  // ---------- القراءة الحيّة ----------
  function rawWatch(gid, cbs) {
    if (!gid) return function () {};
    if (state.groupListeners && state.groupListeners.off) { try { state.groupListeners.off(); } catch (e) {} }
    try {
      var base = firebase.firestore().collection("groups").doc(gid);
      var onErr = function (e) { log("مستمع:", (e && e.message) || e); if (cbs && cbs.onError) cbs.onError(e); };
      var offP = base.collection("persons").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(personFromDoc(d.id, d.data())); });
        cbs && cbs.onPersons && cbs.onPersons(arr);
      }, onErr);
      var offR = base.collection("relations").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(relFromDoc(gid, d.id, d.data())); });
        cbs && cbs.onRelations && cbs.onRelations(arr);
      }, onErr);
      var off = function () { try { offP(); } catch (e) {} try { offR(); } catch (e) {} };
      state.groupListeners = { gid: gid, off: off };
      return off;
    } catch (e) { log("rawWatch فشل:", (e && e.message) || e); return function () {}; }
  }
  function watchGroup(gid, cbs) { if (!enabled()) return function () {}; return rawWatch(gid, cbs); }
  function personFromDoc(id, data) {
    var p = { id: id };
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      if (k === "fts" || k === "healthStatus" || k === "status_detail") continue;
      p[k] = data[k];
    }
    return p;
  }
  function relFromDoc(gid, id, data) {
    return { id: id, groupId: gid, source: data.from, target: data.to, type: data.type,
             inferred: data.inferred, deleted: data.deleted === true };
  }
  function relToServer(r) { return { groupId: r.groupId, type: r.type, from: r.source, to: r.target }; }

  // ---------- إشعارٌ صغير ----------
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483646;" +
          "background:rgba(20,30,40,.92);color:#fff;font:600 14px system-ui;padding:10px 16px;border-radius:12px;" +
          "max-width:86vw;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transition:opacity .25s;pointer-events:none";
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg; toastEl.style.opacity = "1";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.style.opacity = "0"; }, 3800);
    } catch (e) {}
  }

  // ---------- شارة الفحص ----------
  function debugOn() {
    try {
      if (/[?&]sync=(debug|seed|upload)/.test(global.location.search)) localStorage.setItem("sawa_sync_debug", "1");
      if (/[?&]sync=nodebug/.test(global.location.search)) localStorage.removeItem("sawa_sync_debug");
      return localStorage.getItem("sawa_sync_debug") === "1";
    } catch (e) { return false; }
  }
  var badgeEl = null;
  function paintBadge() {
    if (!debugOn()) return;
    try {
      if (!badgeEl) {
        badgeEl = document.createElement("div");
        badgeEl.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;" +
          "font:700 13px system-ui;padding:9px 12px;border-radius:10px;text-align:center;" +
          "box-shadow:0 2px 10px rgba(0,0,0,.35);direction:ltr;pointer-events:none;";
        document.body.appendChild(badgeEl);
      }
      var ok = state.ready && state.uid;
      badgeEl.style.background = ok ? "#187854" : (state.error ? "#b23b3b" : "#8a6d1f");
      badgeEl.style.color = "#fff";
      var body = ok ? ((state.isAnon ? "anon " : "G✓ ") + String(state.uid).slice(0, 6) + "…") : (state.error ? ("err: " + state.error) : "connecting…");
      if (state.dbgGid) {
        body += " · G " + String(state.dbgGid).slice(0, 6) +
                " P:" + (state.dbgPersons == null ? "?" : state.dbgPersons) +
                " R:" + (state.dbgRelations == null ? "?" : state.dbgRelations);
      }
      var fl = lsGet(FAILED, []);
      body += " · Q:" + outboxLen() + " F:" + fl.length + " Rv:" + state.reviews;
      if (state.lastAck) body += " " + state.lastAck;
      if (fl.length) body += " [" + fl[fl.length - 1].op + ": " + String(fl[fl.length - 1].error || "").slice(0, 60) + "]";
      body += " · snap " + (state.lastSnap || "–") + " · " + (state.applyNote || "–");
      if (state.watching) body += " · L " + String(currentLocalGid()).slice(-6);
      if (state.dbgNote) body = state.dbgNote + " · " + body;
      badgeEl.textContent = "sync " + (enabled() ? "ON" : "off") + " · " + body;
    } catch (e) {}
  }
  function debugParam(name) { try { return new URLSearchParams(global.location.search).get(name); } catch (e) { return null; } }
  function debugRun() {
    if (!debugOn()) return;
    var mode = debugParam("sync"), gid = debugParam("gid");
    if (!gid || mode === "upload") return; // الشارة تقرأ أرقام مستمع التطبيق نفسه
    onReady(function () {
      state.dbgGid = gid;
      rawWatch(gid, {
        onPersons:   function (arr) { state.dbgPersons   = arr.filter(function (p) { return p.deleted !== true; }).length; paintBadge(); },
        onRelations: function (arr) { state.dbgRelations = arr.filter(function (r) { return !r.deleted; }).length; paintBadge(); }
      });
    });
  }

  // ---------- الواجهة العامّة ----------
  global.SawaSync = {
    connect: connect, onReady: onReady, getToken: getToken,
    push: push, observe: observe, bindApp: bindApp,
    uploadCurrent: uploadCurrent, openPanel: openPanel, linkGoogle: linkGoogle, shareLink: shareLink,
    watchGroup: watchGroup, serverGid: serverGid,
    personToFields: personToFields, relToServer: relToServer,
    uid: function () { return state.uid; },
    isReady: function () { return !!(state.ready && state.uid); },
    _state: state, _diff: diffAndEnqueue, _snapshot: snapshot, _merge: mergePersons,
    _testRemote: function (lg, sg, persons, relations) { remote = { localGid: lg, sg: sg, persons: persons, relations: relations }; applyPendingRemote(); }
  };

  // ---------- إقلاعٌ ذاتيّ ----------
  var indexedOnce = false;
  function boot() {
    paintBadge();
    handleJoin();
    connect().then(function (uid) {
      paintBadge();
      log(uid ? ("متّصل: " + uid) : "تعذّر الاتصال — التطبيق يعمل محلّياً");
      if (uid && !indexedOnce) { indexedOnce = true; indexMine(); }
      rewatch();
      debugRun();
    });
  }
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
