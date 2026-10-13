/* ============================================================
   sawa-rtc.js — المكالمات: الثنائيّة (C6) والجماعيّة والمجدولة (C7)
   ------------------------------------------------------------
   • الوسائط مباشرةً بين الجهازين (WebRTC). STUN مجّاني؛ TURN (Metered) يعطيه الـWorker
     عبر rtc.ice إن ضُبط METERED_KEY/METERED_APP — بدونه قد تفشل بعض الشبكات (4G خلف NAT صارم).
   • الإشارات في Realtime Database:
       calls/{id}  = { from, to, type, fromName, state, ts, offer, acc, answer, reoffer, reanswer,
                       ic_caller/{push}, ic_callee/{push} }
       inbox/{uid}/{id} = { from, fromName, type, ts }   ← «يرنّ عندك»
     القواعد (database.rules.json): يكتب المتّصل فقط لمن هو في جهات اتّصاله (acl)، ويقرأ الطرفان وحدهما.
   • الرنين والتطبيق مغلق: الـWorker call.ring (إشعار عالي الأولويّة) · فائتة: call.missed.
   • واجهة المكالمة DOM مستقلّة فوق التطبيق (لا React) — تبقى حتّى لو تغيّرت الشاشة.
   ⛔ لا تستعمل اسماً عامّاً قد تعرّفه sawa-app (Image, Phone, Video…) — استعمل global.X.
   ============================================================ */
(function (global) {
  "use strict";
  var VERSION = "c24";
  var RING_MS = global.__sawaRtcRingMs || 45000, STALE_MS = 50000, CONNECT_MS = 30000, LOST_MS = 20000;
  var app = null, logQueue = [], cur = null, inboxRef = null, inboxUid = null, offsetRef = null, srvOffset = 0;
  var iceCache = null, iceAt = 0, seen = {}, devId = rid(10);

  function isAr() { try { return (localStorage.getItem("sawaLang") || "ar") === "ar"; } catch (e) { return true; } }
  function L(ar, en) { return isAr() ? ar : en; }
  function S() { return global.SawaSync; }
  function C() { return global.SawaChat; }
  function toast(m) { try { S().toast(m); } catch (e) {} }
  function wcall(op, payload) { return S().call(op, payload || {}); }
  function log() { try { console.log.apply(console, ["[sawa-rtc]"].concat([].slice.call(arguments))); } catch (e) {} }
  function db() { try { return global.firebase && firebase.database ? firebase.database() : null; } catch (e) { return null; } }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function now() { return Date.now() + (srvOffset || 0); }
  function rid(n) {
    var a = "abcdefghijklmnopqrstuvwxyz0123456789", s = "", r = new Uint8Array(n);
    try { global.crypto.getRandomValues(r); } catch (e) { for (var j = 0; j < n; j++) r[j] = Math.floor(Math.random() * 256); }
    for (var i = 0; i < n; i++) s += a[r[i] % 36];
    return s;
  }
  function myUid() { try { return C() && C().uid ? C().uid() : null; } catch (e) { return null; } }
  function myName() { try { var m = C().me(); return (m && m.name) || ""; } catch (e) { return ""; } }
  function nameOf(uid) {
    try { var l = C().contacts(); for (var i = 0; i < l.length; i++) if (l[i].uid === uid) return l[i].name; } catch (e) {}
    return "";
  }
  function supported() { return !!(global.RTCPeerConnection && global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function enabled() { return supported() && !!myUid() && !!db(); }
  function sdpOf(d) { return { type: d.type, sdp: d.sdp }; }
  function iceJson(c) {
    var j = c.toJSON ? c.toJSON() : { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex };
    var o = {}; for (var k in j) if (j[k] !== undefined && j[k] !== null) o[k] = j[k];   // RTDB يرفض undefined
    return o;
  }
  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  // ---------- ربط التطبيق: سجلّ المكالمات + فتح المحادثة ----------
  function bindApp(fns) {
    app = fns || null;
    if (app && app.setCallLog && logQueue.length) { var q = logQueue; logQueue = []; q.forEach(addLog); }
    if (app && app.setScheduledCalls && schedAt) publishSched();
  }
  function addLog(entry) {
    if (!app || !app.setCallLog) { logQueue.push(entry); return; }
    try { app.setCallLog(function (prev) { prev = prev || []; return prev.some(function (x) { return x.id === entry.id; }) ? prev : [entry].concat(prev); }); } catch (e) {}
  }
  function logCall(c) {
    if (!c || c.logged || c.silent) return; c.logged = true;
    var secs = c.connectedAt ? Math.max(1, Math.round((Date.now() - c.connectedAt) / 1000)) : 0;
    var type = c.role === "caller" ? "outgoing" : (c.connectedAt || c.declined ? "incoming" : "missed");
    addLog({ id: "call-" + c.id, name: c.name || L("جهة اتّصال", "Contact"), peerUid: c.peer, callType: c.type,
             type: type, time: L("الآن", "Now"), duration: secs ? fmt(secs) : null, timestamp: Date.now(), participants: null, cloud: true });
  }

  // ---------- خوادم ICE (STUN + TURN إن وُجد) ----------
  var STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  function getIce() {
    if (iceCache && Date.now() - iceAt < 20 * 60 * 1000) return Promise.resolve(iceCache);
    return Promise.race([
      wcall("rtc.ice", {}).then(function (b) {
        var l = b && Array.isArray(b.iceServers) && b.iceServers.length ? b.iceServers : STUN;
        iceCache = l; iceAt = Date.now(); log("ice", b && b.turn ? "TURN" : "STUN"); return l;
      }),
      new Promise(function (r) { setTimeout(function () { r(iceCache || STUN); }, 6000); })
    ]).catch(function () { return iceCache || STUN; });
  }

  // ---------- الوسائط ----------
  function getMedia(type, facing) {
    var md = navigator.mediaDevices;
    var audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (type !== "video") return md.getUserMedia({ audio: audio, video: false });
    // 640×480 كافية وخفيفة على الشبكات الضعيفة
    // الكاميرا مشغولة (تبويبٌ آخر/تطبيق) أو مرفوضة وحدها ⇒ نكمل بالصوت بدل أن تفشل المكالمة
    return md.getUserMedia({ audio: audio, video: { facingMode: facing || "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } })
      .catch(function (e) {
        log("camera", e && e.name);
        return md.getUserMedia({ audio: audio, video: false }).then(function (st) {
          toast(L("الكاميرا غير متاحة — تستمرّ المكالمة بالصوت", "Camera unavailable — continuing with audio")); return st;
        });
      });
  }
  // C15: سمّاعة الأذن / مكبّر الصوت. Chrome على أندرويد لا يتيح اختيار مخرج الصوت مباشرةً، لكنّه يعرض «Speakerphone» و«Headset earpiece»
  //      ضمن مداخل الصوت — اختيار أحدهما يحوّل خرج المكالمة إليه. على أجهزةٍ لا تعرضهما (آيفون، الحاسوب) لا يظهر الزرّ.
  function audioRoutes() {
    var md = navigator.mediaDevices; if (!md || !md.enumerateDevices) return Promise.resolve(null);
    return md.enumerateDevices().then(function (l) {
      var ins = l.filter(function (d) { return d.kind === "audioinput"; });
      var ear = ins.filter(function (d) { return /earpiece|receiver|handset/i.test(d.label); })[0];
      var spk = ins.filter(function (d) { return /speaker/i.test(d.label); })[0];
      return ear && spk ? { ear: ear.deviceId, spk: spk.deviceId } : null;
    }).catch(function () { return null; });
  }
  function setRoute(c, which, quiet) {
    if (!c || !c.routes || !c.local || c.done || c.routing) return Promise.resolve(false);
    c.routing = true;
    var a = { deviceId: { exact: which === "ear" ? c.routes.ear : c.routes.spk }, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    return navigator.mediaDevices.getUserMedia({ audio: a, video: false }).then(function (st) {
      if (c.done || cur !== c) { stopStream(st); return false; }
      var nt = st.getAudioTracks()[0], old = c.local.getAudioTracks()[0];
      nt.enabled = !c.muted;
      var snd = c.pc && c.pc.getSenders().filter(function (x) { return x.track === old || (x.track && x.track.kind === "audio"); })[0];
      return (snd ? snd.replaceTrack(nt) : Promise.resolve()).then(function () {
        if (old) { try { c.local.removeTrack(old); old.stop(); } catch (e) {} }
        c.local.addTrack(nt); c.out = which; paint(c); return true;
      });
    }).catch(function (e) { log("route", e && (e.name || e.message)); if (!quiet) toast(L("تعذّر تحويل الصوت على هذا الجهاز", "Couldn't switch audio output on this device")); return false; })
      .then(function (x) { c.routing = false; return x; });
  }
  function toggleRoute() { var c = cur; if (!c) return; setRoute(c, c.out === "ear" ? "spk" : "ear"); }
  function stopStream(s) { try { s && s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
  function mediaError(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return L("اسمح لسوا باستخدام الميكروفون/الكاميرا من إعدادات المتصفّح", "Allow microphone/camera access in browser settings");
    if (n === "NotFoundError" || n === "OverconstrainedError") return L("لا يوجد ميكروفون أو كاميرا متاحة", "No microphone or camera found");
    if (n === "NotReadableError") return L("الميكروفون أو الكاميرا مشغول بتطبيقٍ آخر", "Microphone or camera is busy");
    return null;
  }

  // ---------- النغمات (WebAudio — لا ملفّات) ----------
  var tone = { ctx: null, timer: null };
  function audioCtx() {
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
    try { if (!tone.ctx) tone.ctx = new AC(); if (tone.ctx.state === "suspended" && tone.ctx.resume) tone.ctx.resume(); } catch (e) { return null; }
    return tone.ctx;
  }
  function beep(freqs, dur, vol) {
    var ctx = audioCtx(); if (!ctx) return;
    try {
      var t0 = ctx.currentTime, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
      g.gain.setValueAtTime(vol, t0 + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(ctx.destination);
      freqs.forEach(function (f) { var o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur + 0.02); });
    } catch (e) {}
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function playTone(kind) {
    stopTone();
    var cycle;
    if (kind === "ring") cycle = function () { beep([440, 480], 0.45, 0.22); setTimeout(function () { beep([440, 480], 0.45, 0.22); }, 650); vibrate([450, 200, 450]); };
    else cycle = function () { beep([425], 1.0, 0.08); };          // نغمة «يرنّ» عند المتّصل
    cycle(); tone.timer = setInterval(cycle, kind === "ring" ? 2600 : 4000);
  }
  function stopTone() { if (tone.timer) clearInterval(tone.timer); tone.timer = null; vibrate(0); }
  function endTone() { beep([480], 0.18, 0.1); setTimeout(function () { beep([480], 0.18, 0.1); }, 260); setTimeout(function () { beep([480], 0.18, 0.1); }, 520); }

  // ---------- إبقاء الشاشة مضاءة أثناء المكالمة ----------
  var wake = null;
  function wakeOn() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request("screen").then(function (w) { wake = w; }).catch(function () {}); } catch (e) {} }
  function wakeOff() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

  // ============================================================
  //  واجهة المكالمة
  // ============================================================
  var ui = { root: null };
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function btn(icon, label, bg, onclick) {
    var w = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;min-width:64px");
    var b = el("button", "width:60px;height:60px;border-radius:50%;border:0;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:" + bg, icon);
    b.setAttribute("aria-label", label);
    b.onclick = function (ev) { ev.stopPropagation(); onclick(); };
    var t = el("span", "font:600 12px system-ui;color:#e8f5ee", label);
    w.appendChild(b); w.appendChild(t); w._b = b; w._t = t;
    return w;
  }
  function buildUi() {
    if (ui.root) return ui;
    var r = el("div", "position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#0f3d2c,#071a12);color:#fff;display:none;flex-direction:column;align-items:stretch;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;direction:rtl;overflow:hidden;user-select:none;-webkit-user-select:none");
    r.id = "sawa-call";
    var rv = el("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;display:none");
    rv.autoplay = true; rv.playsInline = true; rv.muted = true; rv.setAttribute("playsinline", "");
    var ra = el("audio", "display:none"); ra.autoplay = true;
    var lv = el("video", "position:absolute;top:calc(env(safe-area-inset-top,0px) + 76px);left:14px;width:100px;height:142px;border-radius:14px;object-fit:cover;background:#123;display:none;transform:scaleX(-1);box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:2");
    lv.autoplay = true; lv.playsInline = true; lv.muted = true; lv.setAttribute("playsinline", "");
    var top = el("div", "position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 8px;background:linear-gradient(rgba(0,0,0,.45),transparent)");
    var topName = el("div", "font:700 15px system-ui;opacity:0;transition:opacity .2s;text-shadow:0 1px 3px #000");
    var minBtn = el("button", "background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:18px;padding:7px 12px;font:600 12px system-ui;cursor:pointer", L("تصغير ▾", "Minimize ▾"));
    minBtn.onclick = function () { minimize(true); };
    top.appendChild(topName); top.appendChild(minBtn);
    var mid = el("div", "position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 20px;text-align:center");
    var av = el("div", "width:112px;height:112px;border-radius:50%;background:#2e7d5b;display:flex;align-items:center;justify-content:center;font:800 46px system-ui;box-shadow:0 0 0 10px rgba(46,125,91,.25),0 0 0 22px rgba(46,125,91,.12)");
    var nm = el("div", "font:800 24px system-ui;margin-top:14px");
    var st = el("div", "font:600 15px system-ui;color:#bfe3d0");
    var sub = el("div", "font:500 11px system-ui;color:#8fb8a4;min-height:14px");
    mid.appendChild(av); mid.appendChild(nm); mid.appendChild(st); mid.appendChild(sub);
    var bar = el("div", "position:relative;z-index:3;display:flex;justify-content:space-evenly;align-items:flex-start;padding:18px 10px calc(env(safe-area-inset-bottom,0px) + 26px);background:linear-gradient(transparent,rgba(0,0,0,.55))");
    r.appendChild(rv); r.appendChild(ra); r.appendChild(lv); r.appendChild(top); r.appendChild(mid); r.appendChild(bar);
    // الشريط المصغّر
    var pill = el("button", "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:2147483001;display:none;align-items:center;gap:8px;background:#2e7d5b;color:#fff;border:0;border-radius:22px;padding:9px 16px;font:700 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.35);direction:rtl;cursor:pointer");
    pill.onclick = function () { minimize(false); };
    document.body.appendChild(r); document.body.appendChild(pill);
    ui = { root: r, rv: rv, ra: ra, lv: lv, topName: topName, minBtn: minBtn, mid: mid, av: av, nm: nm, st: st, sub: sub, bar: bar, pill: pill, min: false };
    return ui;
  }
  function minimize(on) {
    if (!ui.root) return; ui.min = !!on;
    ui.root.style.display = on ? "none" : "flex";
    ui.pill.style.display = on ? "flex" : "none";
    paintPill();
  }
  function paintPill() {
    if (!ui.pill || !cur) return;
    ui.pill.textContent = (cur.type === "video" ? "📹 " : "📞 ") + (cur.name || "") + " · " + statusText(cur) + "  ▴";
  }
  function statusText(c) {
    switch (c.state) {
      case "starting": return L("جارٍ التجهيز…", "Preparing…");
      case "calling": return L("جارٍ الاتّصال…", "Calling…");
      case "ringing": return L("يرنّ…", "Ringing…");
      case "incoming": return c.type === "video" ? L("مكالمة فيديو واردة", "Incoming video call") : L("مكالمة صوتيّة واردة", "Incoming voice call");
      case "connecting": return L("جارٍ الربط…", "Connecting…");
      case "reconnecting": return L("ضعف الشبكة — إعادة الاتّصال…", "Weak network — reconnecting…");
      case "connected": return fmt(Math.floor((Date.now() - c.connectedAt) / 1000));
      case "ended": return c.endText || L("انتهت المكالمة", "Call ended");
    }
    return "";
  }
  function show(c) {
    buildUi();
    ui.av.textContent = (c.name || "؟").charAt(0);
    ui.nm.textContent = c.name || ""; ui.topName.textContent = c.name || "";
    ui.rv.style.display = "none"; ui.lv.style.display = "none"; ui.sub.textContent = "";
    ui.rv.srcObject = null; ui.ra.srcObject = null; ui.lv.srcObject = null;
    minimize(false); paint(c);
  }
  function hide() { if (!ui.root) return; ui.root.style.display = "none"; ui.pill.style.display = "none"; ui.min = false;
    try { ui.rv.srcObject = null; ui.ra.srcObject = null; ui.lv.srcObject = null; } catch (e) {} }
  function paintStatus(c) {
    if (!ui.root || c !== cur && c.state !== "ended") return;
    ui.st.textContent = statusText(c);
    var vid = c.type === "video" && c.remoteVideo && (c.state === "connected" || c.state === "reconnecting");
    ui.rv.style.display = vid ? "block" : "none";
    ui.mid.style.visibility = vid && c.state === "connected" ? "hidden" : "visible";
    ui.topName.style.opacity = vid ? "1" : "0";
    if (vid && c.state === "connected") ui.topName.textContent = (c.name || "") + " · " + statusText(c) + (c.route ? " · " + (c.route === "relay" ? L("عبر وسيط", "relay") : L("مباشر", "direct")) : "");
    if (ui.min) paintPill();
  }
  function paint(c) {
    if (!ui.root) return;
    paintStatus(c);
    var bar = ui.bar; bar.innerHTML = "";
    ui.minBtn.style.visibility = c.state === "incoming" || c.state === "ended" ? "hidden" : "visible";
    if (c.state === "ended") return;
    if (c.state === "incoming") {
      // بالعربيّة (من اليمين): ردّ · بالصوت · رفض
      bar.appendChild(btn(c.type === "video" ? "📹" : "📞", L("ردّ", "Answer"), "#21a366", function () { accept(false); }));
      if (c.type === "video") bar.appendChild(btn("🎤", L("ردّ بالصوت", "Voice only"), "#3c6e5a", function () { accept(true); }));
      bar.appendChild(btn("✕", L("رفض", "Decline"), "#d64545", decline));
      return;
    }
    var mute = btn(c.muted ? "🔇" : "🎤", c.muted ? L("إلغاء الكتم", "Unmute") : L("كتم", "Mute"), c.muted ? "#e8f5ee" : "rgba(255,255,255,.16)", toggleMute);
    if (c.muted) mute._b.style.color = "#123";
    bar.appendChild(mute);
    if (c.type === "video" && c.hasCam) {
      bar.appendChild(btn(c.camOff ? "🚫" : "📷", c.camOff ? L("تشغيل الكاميرا", "Camera on") : L("الكاميرا", "Camera"), c.camOff ? "#e8f5ee" : "rgba(255,255,255,.16)", toggleCam));
      bar.appendChild(btn("🔄", L("تبديل", "Flip"), "rgba(255,255,255,.16)", switchCam));
    }
    if (c.routes) { var sp = c.out !== "ear"; var rb = btn(sp ? "🔊" : "👂", sp ? L("المكبّر", "Speaker") : L("السمّاعة", "Earpiece"), sp ? "#e8f5ee" : "rgba(255,255,255,.16)", toggleRoute); if (sp) rb._b.style.color = "#123"; bar.appendChild(rb); }
    if (c.state === "connected") bar.appendChild(btn("➕", L("إضافة", "Add"), "rgba(255,255,255,.16)", function () { pickPerson(cur); }));
    bar.appendChild(btn("📞", L("إنهاء", "End"), "#d64545", function () { hangup(); }));
    bar.lastChild._b.style.transform = "rotate(135deg)";
  }
  function attachLocal(c) {
    if (!ui.root || !c.local) return;
    var hasVid = c.local.getVideoTracks().length > 0;
    c.hasCam = hasVid;
    ui.lv.srcObject = hasVid ? c.local : null;
    ui.lv.style.display = hasVid && !c.camOff ? "block" : "none";
    ui.lv.style.transform = c.facing === "environment" ? "none" : "scaleX(-1)";
    if (hasVid) try { ui.lv.play().catch(function () {}); } catch (e) {}
  }
  function attachRemote(c) {
    if (!ui.root || !c.remote) return;
    ui.ra.srcObject = c.remote; try { ui.ra.play().catch(function () {}); } catch (e) {}
    c.remoteVideo = c.remote.getVideoTracks().some(function (t) { return t.readyState === "live"; });
    if (c.remoteVideo) { ui.rv.srcObject = c.remote; try { ui.rv.play().catch(function () {}); } catch (e) {} }
    paintStatus(c);
  }

  // ============================================================
  //  المكالمة
  // ============================================================
  function newCall(o) {
    o.timers = {}; o.offs = []; o.iceOut = []; o.iceIn = []; o.remoteSet = false;
    o.muted = false; o.camOff = false; o.facing = "user"; o.reN = 0; o.reSeen = 0;
    return o;
  }
  function setState(c, s) {
    c.state = s; paint(c);
    if (s === "connected" && !c.tick) c.tick = setInterval(function () { paintStatus(c); }, 1000);
  }
  function listen(c, ref, ev, fn, onErr) {
    var h = ref.on(ev, fn, onErr || function () {});
    c.offs.push(function () { try { ref.off(ev, h); } catch (e) {} });
  }
  function clearTimers(c) { for (var k in c.timers) { clearTimeout(c.timers[k]); } c.timers = {}; if (c.tick) clearInterval(c.tick); c.tick = null; }

  function makePc(c, ice) {
    var pc = new global.RTCPeerConnection({ iceServers: ice });
    var side = c.role === "caller" ? "ic_caller" : "ic_callee";
    pc.onicecandidate = function (e) {
      if (!e.candidate || !e.candidate.candidate) return;
      var j = iceJson(e.candidate);
      if (c.ref && c.live) c.ref.child(side).push(j).catch(function () {}); else c.iceOut.push(j);
    };
    pc.ontrack = function (e) {
      var s = e.streams && e.streams[0];
      if (!c.remote) c.remote = s || new global.MediaStream();
      if (!s || s !== c.remote) try { c.remote.addTrack(e.track); } catch (x) {}
      e.track.onunmute = function () { attachRemote(c); };
      e.track.onended = function () { attachRemote(c); };
      attachRemote(c);
    };
    pc.onconnectionstatechange = function () { onConn(c, pc.connectionState); };
    pc.oniceconnectionstatechange = function () {
      // متصفّحات لا تدعم connectionState (Safari قديم)
      if (pc.connectionState === undefined) {
        var m = { connected: "connected", completed: "connected", disconnected: "disconnected", failed: "failed", closed: "closed" };
        if (m[pc.iceConnectionState]) onConn(c, m[pc.iceConnectionState]);
      }
    };
    return pc;
  }
  function flushIceOut(c) {
    var side = c.role === "caller" ? "ic_caller" : "ic_callee";
    var q = c.iceOut; c.iceOut = [];
    q.forEach(function (j) { c.ref.child(side).push(j).catch(function () {}); });
  }
  function addRemoteIce(c, j) {
    if (!c.pc || !j || !j.candidate) return;
    if (!c.remoteSet) { c.iceIn.push(j); return; }
    c.pc.addIceCandidate(j).catch(function (e) { log("ice add", e && e.message); });
  }
  function flushIceIn(c) { c.remoteSet = true; var q = c.iceIn; c.iceIn = []; q.forEach(function (j) { addRemoteIce(c, j); }); }
  function addTracks(c) {
    c.local.getTracks().forEach(function (t) { c.pc.addTrack(t, c.local); });
  }
  function capVideo(c) {
    try {
      c.pc.getSenders().forEach(function (s) {
        if (!s.track || s.track.kind !== "video" || !s.getParameters) return;
        var p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = 600000; s.setParameters(p).catch(function () {});
      });
    } catch (e) {}
  }
  function routeInfo(c) {
    try {
      c.pc.getStats().then(function (rep) {
        var pair = null, cands = {};
        rep.forEach(function (r) {
          if (r.type === "transport" && r.selectedCandidatePairId) pair = rep.get(r.selectedCandidatePairId);
          if (r.type === "local-candidate" || r.type === "remote-candidate") cands[r.id] = r;
        });
        if (!pair) rep.forEach(function (r) { if (r.type === "candidate-pair" && r.state === "succeeded" && (r.selected || r.nominated)) pair = pair || r; });
        if (!pair) return;
        var lc = cands[pair.localCandidateId] || {}, rc = cands[pair.remoteCandidateId] || {};
        var relay = lc.candidateType === "relay" || rc.candidateType === "relay";
        c.route = relay ? "relay" : "direct";
        log("route", lc.candidateType, "→", rc.candidateType);
        if (ui.sub && c === cur) ui.sub.textContent = relay ? L("عبر خادم وسيط", "via relay") : L("اتّصال مباشر", "direct");
      }).catch(function () {});
    } catch (e) {}
  }
  function onConn(c, s) {
    if (c.done) return;
    if (s === "connected") {
      clearTimeout(c.timers.conn); clearTimeout(c.timers.lost); delete c.timers.lost;
      if (!c.connectedAt) { c.connectedAt = Date.now(); stopTone(); capVideo(c); wakeOn();
        audioRoutes().then(function (rt) {   // C15: المكالمة الصوتيّة تبدأ على سمّاعة الأذن كالهاتف، والفيديو على المكبّر
          if (!rt || c.done || cur !== c) return;
          c.routes = rt; c.out = "spk";
          if (c.type !== "video") setRoute(c, "ear", true); else paint(c);
        }); }
      setState(c, "connected"); setTimeout(function () { routeInfo(c); }, 800);
    } else if (s === "disconnected" || s === "failed") {
      if (!c.connectedAt) { if (s === "failed") finish(c, "failed"); return; }
      setState(c, "reconnecting");
      // المتّصل يعيد التفاوض (ICE restart) — يفيد عند تبدّل الشبكة (واي فاي ↔ بيانات)
      if (c.role === "caller" && (s === "failed" || !c.timers.restart)) c.timers.restart = setTimeout(function () { iceRestart(c); }, s === "failed" ? 0 : 3000);
      if (!c.timers.lost) c.timers.lost = setTimeout(function () { finish(c, "lost"); }, LOST_MS);
    }
  }
  function iceRestart(c) {
    delete c.timers.restart;
    if (c.done || !c.pc || c.role !== "caller" || c.state === "connected") return;
    var n = ++c.reN;
    c.pc.createOffer({ iceRestart: true }).then(function (o) { return c.pc.setLocalDescription(o).then(function () { return o; }); })
      .then(function (o) { return c.ref.update({ reoffer: { type: o.type, sdp: o.sdp, n: n } }); })
      .catch(function (e) { log("restart", e && e.message); });
  }

  // ---------- المتّصل ----------
  function startCall(peer, name, type) {
    if (!enabled() || !peer || peer === myUid()) return false;
    if (busy()) { if (cur && ui.min) minimize(false); else if (gc && gui.min) gMinimize(false); toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
    type = type === "video" ? "video" : "audio";
    var me = myUid(), d = db();
    var c = cur = newCall({ id: "k" + Date.now().toString(36) + rid(7), role: "caller", peer: peer, name: name || nameOf(peer), type: type, state: "starting" });
    seen[c.id] = 1;
    show(c);
    Promise.all([getMedia(type), getIce()]).then(function (r) {
      if (c.done) { stopStream(r[0]); return; }
      c.local = r[0]; attachLocal(c); paint(c);
      c.pc = makePc(c, r[1]); addTracks(c);
      return c.pc.createOffer().then(function (o) { return c.pc.setLocalDescription(o).then(function () { return o; }); }).then(function (o) {
        if (c.done) return;
        c.ref = d.ref("calls/" + c.id);
        return c.ref.set({ from: me, to: peer, type: type, fromName: myName() || "", state: "ringing", ts: TS(), offer: sdpOf(o) });
      }).then(function () {
        if (c.done) { if (c.ref) c.ref.remove().catch(function () {}); return; }
        c.live = true;
        try { c.ref.onDisconnect().update({ state: "ended" }); } catch (e) {}
        c.inbox = d.ref("inbox/" + peer + "/" + c.id);
        c.inbox.set({ from: me, fromName: myName() || "", type: type, ts: TS() }).catch(function (e) { log("inbox", e && e.message); });
        try { c.inbox.onDisconnect().remove(); } catch (e) {}
        flushIceOut(c);
        listen(c, c.ref, "value", function (s) { onCallerValue(c, s.val()); }, function () { finish(c, "remote", { remote: true }); });
        listen(c, c.ref.child("ic_callee"), "child_added", function (s) { addRemoteIce(c, s.val()); });
        wcall("call.ring", { to: peer, callId: c.id, type: type }).catch(function (e) { log("ring", e && e.message); });
        setState(c, "ringing"); playTone("back");
        c.timers.ring = setTimeout(function () { if (!c.accepted) finish(c, "noanswer"); }, RING_MS);
      });
    }).catch(function (e) {
      log("start", e && (e.name || e.message), e && e.message);
      var m = mediaError(e);
      if (!m && e && /permission|denied/i.test(String(e.code || e.message))) m = L("لا يمكن الاتّصال بهذا الشخص — ليس في جهات اتّصالك بعد", "Can't call: not in your contacts yet");
      finish(c, "error", { text: m || L("تعذّر بدء المكالمة", "Couldn't start the call") });
    });
    return true;
  }
  function onCallerValue(c, v) {
    if (c.done) return;
    if (!v) { finish(c, "remote", { remote: true }); return; }
    if (v.up && !c.upSeen) { c.upSeen = true; c.silent = true; finish(c, "upgraded", { remote: true }); groupJoinDirect(v.up, c.type, null, c.upgrading ? "starter" : "joiner"); return; }
    if (v.acc && !c.accepted) {
      c.accepted = true; clearTimeout(c.timers.ring); stopTone();
      setState(c, "connecting");
      if (c.inbox) c.inbox.remove().catch(function () {});
      c.timers.conn = setTimeout(function () { if (!c.connectedAt) finish(c, "failed"); }, CONNECT_MS + 15000);
    }
    if (v.answer && !c.answerSet && c.pc) {
      c.answerSet = true;   // الحدث يتكرّر (مرشّحو ICE يغيّرون السجلّ) — طبّق الردّ مرّةً واحدة
      c.pc.setRemoteDescription(v.answer).then(function () { flushIceIn(c); }).catch(function (e) { log("answer", e && e.message); finish(c, "failed"); });
    }
    if (v.reanswer && v.reanswer.n === c.reN && c.reSeen !== c.reN && c.pc) {
      c.reSeen = c.reN;
      c.pc.setRemoteDescription({ type: v.reanswer.type, sdp: v.reanswer.sdp })
        .then(function () { if (c.pc.connectionState === "connected") onConn(c, "connected"); })
        .catch(function (e) { log("reanswer", e && e.message); });
    }
    if (v.state === "declined") finish(c, "declined", { remote: true });
    else if (v.state === "busy") finish(c, "busy", { remote: true });
    else if (v.state === "ended" || v.state === "missed") finish(c, "remote", { remote: true });
  }

  // ---------- المستقبِل ----------
  function watchInbox(uid) {
    var d = db(); if (!d || inboxUid === uid) return;
    try { if (inboxRef) inboxRef.off(); } catch (e) {}
    inboxUid = uid; inboxRef = d.ref("inbox/" + uid);
    try {
      if (!offsetRef) { offsetRef = d.ref(".info/serverTimeOffset"); offsetRef.on("value", function (s) { srvOffset = s.val() || 0; }); }
    } catch (e) {}
    inboxRef.on("child_added", function (s) {
      var v = s.val() || {}, id = s.key;
      if (!v.ts || now() - v.ts > STALE_MS) { s.ref.remove().catch(function () {}); return; }
      if (v.gid) groupIncoming(id, v); else incoming(id);
    }, function (e) { log("inbox listen", e && e.code); });
  }
  function incoming(id) {
    var me = myUid(), d = db();
    if (!me || !d || !id || seen[id]) return;
    seen[id] = 1;
    var ref = d.ref("calls/" + id), inbox = d.ref("inbox/" + me + "/" + id);
    ref.once("value").then(function (snap) {
      var v = snap.val();
      if (!v || v.to !== me || v.state !== "ringing" || v.acc || (v.ts && now() - v.ts > STALE_MS)) { inbox.remove().catch(function () {}); return; }
      // المحظور: لا رنين ولا سجلّ — ويبقى عنده «يرنّ» حتّى ينتهي الوقت (لا نكشف الحظر)
      try { if (C().isBlocked && C().isBlocked(v.from)) { inbox.remove().catch(function () {}); return; } } catch (e) {}
      var name = nameOf(v.from) || v.fromName || "";
      if (busy()) {   // مشغول بمكالمة أخرى
        ref.update({ state: "busy" }).catch(function () {}); inbox.remove().catch(function () {});
        addLog({ id: "call-" + id, name: name, peerUid: v.from, callType: v.type === "video" ? "video" : "audio", type: "missed", time: L("الآن", "Now"), duration: null, timestamp: Date.now(), participants: null, cloud: true });
        return;
      }
      var c = cur = newCall({ id: id, role: "callee", peer: v.from, name: name, type: v.type === "video" ? "video" : "audio", state: "incoming", ref: ref, inbox: inbox, offer: v.offer });
      c.live = true;
      show(c); playTone("ring");
      listen(c, ref, "value", function (s) { onCalleeValue(c, s.val()); }, function () { finish(c, "remote", { remote: true }); });
      c.timers.ring = setTimeout(function () { if (c.state === "incoming") finish(c, "missed", { remote: true }); }, RING_MS + 5000);
      getIce();   // تجهيزٌ مسبق
    }).catch(function (e) { log("incoming", e && e.message); inbox.remove().catch(function () {}); });
  }
  function onCalleeValue(c, v) {
    if (c.done) return;
    if (!v) { finish(c, c.connectedAt ? "remote" : "missed", { remote: true }); return; }
    if (v.acc && v.acc !== devId) { c.silent = true; finish(c, "elsewhere", { remote: true }); return; }   // ردّ جهازٌ آخر لي
    if (v.up && !c.upSeen && c.connectedAt) { c.upSeen = true; c.silent = true; finish(c, "upgraded", { remote: true }); groupJoinDirect(v.up, c.type, null, c.upgrading ? "starter" : "joiner"); return; }
    if (v.reoffer && v.reoffer.n > c.reSeen && c.pc && c.remoteSet) {
      var n = v.reoffer.n; c.reSeen = n;
      c.pc.setRemoteDescription({ type: v.reoffer.type, sdp: v.reoffer.sdp })
        .then(function () { return c.pc.createAnswer(); })
        .then(function (a) { return c.pc.setLocalDescription(a).then(function () { return a; }); })
        .then(function (a) { return c.ref.update({ reanswer: { type: a.type, sdp: a.sdp, n: n } }); })
        .catch(function (e) { log("reoffer", e && e.message); });
    }
    if (v.state === "ended" || v.state === "missed") finish(c, c.connectedAt ? "remote" : "missed", { remote: true });
  }
  function accept(audioOnly) {
    var c = cur; if (!c || c.role !== "callee" || c.state !== "incoming") return;
    stopTone(); clearTimeout(c.timers.ring);
    setState(c, "connecting");
    var mediaType = audioOnly ? "audio" : c.type;
    // أوّل جهازٍ يردّ يفوز (لو فتحت سوا على هاتفين)
    c.ref.child("acc").transaction(function (v) { return v ? undefined : devId; }).then(function (r) {
      if (c.done) return;
      if (!r.committed || r.snapshot.val() !== devId) { c.silent = true; finish(c, "elsewhere", { remote: true }); return; }
      if (c.inbox) c.inbox.remove().catch(function () {});
      return Promise.all([getMedia(mediaType), getIce()]).then(function (res) {
        if (c.done) { stopStream(res[0]); return; }
        c.local = res[0]; attachLocal(c); paint(c);
        c.pc = makePc(c, res[1]);
        listen(c, c.ref.child("ic_caller"), "child_added", function (s) { addRemoteIce(c, s.val()); });
        return c.pc.setRemoteDescription(c.offer).then(function () {
          flushIceIn(c); addTracks(c);
          return c.pc.createAnswer();
        }).then(function (a) { return c.pc.setLocalDescription(a).then(function () { return a; }); }).then(function (a) {
          try { c.ref.onDisconnect().update({ state: "ended" }); } catch (e) {}
          flushIceOut(c);
          c.timers.conn = setTimeout(function () { if (!c.connectedAt) finish(c, "failed"); }, CONNECT_MS);
          return c.ref.update({ answer: sdpOf(a), state: "accepted" });
        });
      });
    }).catch(function (e) {
      log("accept", e && (e.name || e.message), e && e.message);
      finish(c, "error", { text: mediaError(e) || L("تعذّر الردّ على المكالمة", "Couldn't answer the call") });
    });
  }
  function decline() {
    var c = cur; if (!c || c.role !== "callee" || c.state !== "incoming") return;
    c.declined = true;
    c.ref.update({ state: "declined" }).catch(function () {});
    finish(c, "declinedByMe", { remote: true });
  }

  // ---------- أثناء المكالمة ----------
  function toggleMute() {
    var c = cur; if (!c || !c.local) return;
    c.muted = !c.muted; c.local.getAudioTracks().forEach(function (t) { t.enabled = !c.muted; }); paint(c);
  }
  function toggleCam() {
    var c = cur; if (!c || !c.local) return;
    c.camOff = !c.camOff; c.local.getVideoTracks().forEach(function (t) { t.enabled = !c.camOff; });
    attachLocal(c); paint(c);
  }
  function switchCam() {
    var c = cur; if (!c || !c.local || !c.pc || c.switching) return;
    var want = c.facing === "user" ? "environment" : "user";
    c.switching = true;
    var old = c.local.getVideoTracks()[0];
    try { if (old) old.stop(); } catch (e) {}   // بعض الهواتف لا تفتح الكاميرتين معاً
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: want } }); })
      .then(function (s) {
        if (c.done || cur !== c) { stopStream(s); return null; }   // C14: انتهت المكالمة أثناء التبديل ⇒ لا تبقى الكاميرا مفتوحة
        var nt = s.getVideoTracks()[0]; if (!nt) throw new Error("no track");
        nt.enabled = !c.camOff;
        var snd = c.pc.getSenders().filter(function (x) { return x.track === old || (x.track && x.track.kind === "video"); })[0]
          || c.pc.getSenders().filter(function (x) { return !x.track; })[0];
        if (old) c.local.removeTrack(old);
        c.local.addTrack(nt); c.facing = want;
        attachLocal(c);
        return snd ? snd.replaceTrack(nt) : null;
      })
      .catch(function (e) { log("switch", e && e.message); toast(L("تعذّر تبديل الكاميرا", "Couldn't switch camera")); })
      .then(function () { c.switching = false; });
  }
  function hangup() {
    var c = cur; if (!c) return;
    finish(c, c.role === "caller" && !c.accepted ? "cancel" : "hangup");
  }

  var END_TEXT = {
    declined: ["رُفضت المكالمة", "Call declined"], busy: ["مشغولٌ بمكالمة أخرى", "Busy on another call"],
    noanswer: ["لم يُجب", "No answer"], failed: ["تعذّر الربط — الشبكة لا تسمح بالاتّصال المباشر", "Couldn't connect (network)"],
    lost: ["انقطع الاتّصال", "Connection lost"], missed: ["مكالمة فائتة", "Missed call"], elsewhere: ["رُدّ عليها من جهازٍ آخر", "Answered on another device"]
  };
  function finish(c, reason, opts) {
    if (!c || c.done) return;
    opts = opts || {}; c.done = true;
    clearTimers(c); stopTone(); wakeOff();
    c.offs.forEach(function (f) { f(); }); c.offs = [];
    // أخبر الطرف الآخر
    if (c.ref && c.live && !opts.remote) {
      var st = reason === "noanswer" ? "missed" : "ended";
      c.ref.update({ state: st }).catch(function () {});
    }
    if (c.ref && c.live) {
      try { c.ref.onDisconnect().cancel(); } catch (e) {}
      // المتّصل ينظّف السجلّ بعد أن يرى الطرف الآخر الحالة الأخيرة
      if (c.role === "caller") { var ref = c.ref; setTimeout(function () { ref.remove().catch(function () {}); }, 4000); }
    }
    if (c.inbox && (c.role === "caller" || c.state === "incoming")) { c.inbox.remove().catch(function () {}); try { c.inbox.onDisconnect().cancel(); } catch (e) {} }
    // فائتة: إشعارٌ للطرف الآخر (لو كان التطبيق مغلقاً يرى «مكالمة فائتة» مكان «مكالمة واردة»)
    if (c.role === "caller" && !c.accepted && c.live && (reason === "noanswer" || reason === "cancel")) {
      wcall("call.missed", { to: c.peer, callId: c.id, type: c.type }).catch(function () {});
    }
    stopStream(c.local);
    try { if (c.pc) c.pc.close(); } catch (e) {}
    logCall(c);
    if (cur === c) cur = null;
    var tx = opts.text || (END_TEXT[reason] && L(END_TEXT[reason][0], END_TEXT[reason][1])) || (c.connectedAt ? L("انتهت المكالمة", "Call ended") + " · " + fmt(Math.max(1, Math.round((Date.now() - c.connectedAt) / 1000))) : L("انتهت المكالمة", "Call ended"));
    log("end", c.id, reason);
    if (c.silent || reason === "declinedByMe") { hide(); return; }
    if (c.connectedAt || c.role === "caller") endTone();
    c.endText = tx; c.state = "ended";
    if (ui.root) { if (ui.min) minimize(false); paint(c); ui.rv.style.display = "none"; ui.lv.style.display = "none"; ui.mid.style.visibility = "visible"; ui.st.textContent = tx; ui.sub.textContent = ""; }
    setTimeout(function () { if (!cur) hide(); }, opts.text ? 3200 : 1800);
  }

  // ============================================================
  //  C7: المكالمات الجماعيّة — شبكةٌ مباشرة بين الأجهزة (≤ ٤ فيديو / ≤ ٨ صوت حتّى SFU)
  //  gcalls/{gid} = { by, type, title, cid, ts, approval, allow{uid}, members{uid:{name,sess,ts}},
  //                   sig/{to}/{push}:{from,fs,tsn,t,sdp|cand}, req{uid}, adm{uid} }
  //  الـWorker وحده ينشئها ويحدّد allow (gcall.start / gcall.add). الوافد الجديد يرسل العروض لمن سبقه (لا تصادم).
  //  sess: رقم الجلسة — رسائلُ جلسةٍ قديمة (خروج ثمّ عودة) تُتجاهل.
  // ============================================================
  var GC_MAX = { video: 4, audio: 8 }, ALONE_MS = global.__sawaRtcAloneMs || 60000;
  var gc = null, gui = { root: null };
  function busy() { return !!(cur || gc || rm); }

  function gcNew(o) {
    o.peers = {}; o.members = {}; o.offs = []; o.timers = {}; o.sess = rid(8); o.muted = false; o.camOff = false; o.facing = "user";
    o.met = {}; o.reqs = {};
    return o;
  }
  function gListen(g, ref, ev, fn) { var h = ref.on(ev, fn, function () {}); g.offs.push(function () { try { ref.off(ev, h); } catch (e) {} }); }
  function gName(g, uid) { return (g.members[uid] && g.members[uid].name) || nameOf(uid) || L("عضو", "Member"); }

  // ---------- البدء ----------
  // opts: { cid } من مجموعة/عائلة · { to:[uid…], quiet:[uid] } من جهات الاتّصال · { sched: id } موعدٌ مجدول
  function groupStart(opts, type, title) {
    if (!enabled()) return false;
    // ترنّ عندي مكالمة هذه المحادثة نفسها ⇒ «انضمام» = ردّ
    if (gc && gc.state === "incoming" && opts.cid && gc.cid === opts.cid) { groupAccept(); return true; }
    if (busy()) { if (gc && gui.min) gMinimize(false); else if (cur && ui.min) minimize(false); toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
    type = type === "video" ? "video" : "audio";
    var g = gc = gcNew({ gid: null, type: type, title: title || "", state: "starting", role: "starter", vc: !!opts.vc });
    gShow(g);
    var p = { type: type };
    if (opts.cid) { p.cid = opts.cid; if (opts.vc) p.vc = true; } else if (opts.sched) p.sched = opts.sched; else { p.to = opts.to; if (opts.quiet) p.quiet = opts.quiet; }
    wcall("gcall.start", p).then(function (r) {
      if (g.done) return;
      g.gid = r.gid; g.type = r.type || type; g.title = r.title || g.title; g.cid = r.cid || null; g.by = r.by; g.approval = !!r.approval; if (r.vc) g.vc = true;
      if (r.joined) g.role = "joiner";
      seen[g.gid] = 1;
      gJoin(g);
    }).catch(function (e) {
      log("gcall.start", e && e.message);
      gFinish(g, "error", { text: /not a contact/.test(String(e && e.message)) ? L("ليسوا كلّهم في جهات اتّصالك", "Not all are your contacts") : L("تعذّر بدء المكالمة", "Couldn't start the call") });
    });
    return true;
  }
  // الانضمام مباشرةً (ترقية مكالمة ثنائيّة إلى جماعيّة — لا رنين)
  function groupJoinDirect(gid, type, by, role) {
    if (gc) return;
    var g = gc = gcNew({ gid: gid, type: type, title: "", state: "starting", role: role || "joiner", by: by });
    seen[gid] = 1; gShow(g); gJoin(g);
  }

  // ---------- الرنين ----------
  function groupIncoming(gid, v) {
    var me = myUid(), d = db();
    if (!me || !d || !gid || seen[gid]) return;
    seen[gid] = 1; v = v || {};
    var inbox = d.ref("inbox/" + me + "/" + gid), ref = d.ref("gcalls/" + gid);
    ref.once("value").then(function (snap) {
      var n = snap.val();
      // بلا أعضاء: إمّا انتهت، أو أنشأها الخادم للتوّ والمتّصل لم يدخل بعد (أقلّ من دقيقة)
      var empty = !n || !n.members || !Object.keys(n.members).length;
      if (!n || !n.allow || !n.allow[me] || (n.members && n.members[me]) || (empty && now() - (n.ts || 0) > 60000) || (n.ts && now() - n.ts > 6 * 3600000)) { inbox.remove().catch(function () {}); return; }
      try { if (C().isBlocked && v.from && C().isBlocked(v.from)) { inbox.remove().catch(function () {}); return; } } catch (e) {}
      var title = n.title || "", from = v.from || n.by;
      if (busy()) {
        inbox.remove().catch(function () {});
        addLog({ id: "gcall-" + gid, name: title || nameOf(from) || L("مكالمة جماعيّة", "Group call"), callType: n.type, type: "missed", time: L("الآن", "Now"), duration: null, timestamp: Date.now(), participants: null, cloud: true, cid: n.cid || null });
        return;
      }
      var g = gc = gcNew({ gid: gid, type: n.type === "video" ? "video" : "audio", title: title, cid: n.cid || null, by: n.by, approval: !!n.approval,
                           state: "incoming", role: "incoming", from: from, fromName: nameOf(from) || v.fromName || "", inbox: inbox, ref: ref });
      g.members = n.members || {};
      gShow(g); playTone("ring");
      var saw = !empty;
      gListen(g, ref.child("members"), "value", function (s) {
        if (g.done || g.state !== "incoming") return;
        g.members = s.val() || {};
        if (Object.keys(g.members).length) { saw = true; gPaint(g); }
        else if (saw) gFinish(g, "missed");   // غادر الجميع قبل أن أردّ
      });
      g.timers.empty = setTimeout(function () { if (g.state === "incoming" && !saw) gFinish(g, "missed"); }, 25000);
      g.timers.ring = setTimeout(function () { if (g.state === "incoming") gFinish(g, "missed"); }, RING_MS + 5000);
      getIce();
    }).catch(function () { inbox.remove().catch(function () {}); });
  }
  function groupAccept() {
    var g = gc; if (!g || g.state !== "incoming") return;
    stopTone(); clearTimeout(g.timers.ring);
    if (g.inbox) g.inbox.remove().catch(function () {});
    g.offs.forEach(function (f) { f(); }); g.offs = [];
    g.role = "joiner"; g.state = "starting"; gPaint(g);
    gJoin(g);
  }
  function groupDecline() {
    var g = gc; if (!g || g.state !== "incoming") return;
    g.declined = true; gFinish(g, "declined");
  }

  // ---------- الانضمام ----------
  function gJoin(g) {
    var me = myUid(), d = db();
    g.ref = d.ref("gcalls/" + g.gid);
    Promise.all([getMedia(g.type), getIce(), g.ref.once("value")]).then(function (r) {
      if (g.done) { stopStream(r[0]); return; }
      g.local = r[0]; g.ice = r[1];
      var n = r[2].val();
      if (!n || !n.allow || !n.allow[me]) { gFinish(g, "error", { text: L("انتهت هذه المكالمة", "This call has ended") }); return; }
      g.by = n.by; g.approval = !!n.approval; g.title = n.title || g.title; g.cid = n.cid || g.cid || null; g.type = n.type === "video" ? "video" : "audio";
      g.allow = n.allow;
      var others = Object.keys(n.members || {}).filter(function (u) { return u !== me; });
      if (others.length + 1 > GC_MAX[g.type]) { gFinish(g, "full"); return; }
      gLocalTile(g);
      if (g.approval && g.by !== me && !(n.adm && n.adm[me] === true)) { gWait(g); return; }
      gEnter(g);
    }).catch(function (e) {
      log("gjoin", e && (e.name || e.message), e && e.message);
      gFinish(g, "error", { text: mediaError(e) || L("تعذّر الانضمام للمكالمة", "Couldn't join the call") });
    });
  }
  // غرفة الانتظار: المضيف يوافق (adm/{uid} = true) أو يرفض (false)
  function gWait(g) {
    var me = myUid();
    g.state = "waiting"; gPaint(g);
    g.ref.child("req/" + me).set({ name: myName() || "", ts: TS() }).catch(function (e) { log("req", e && e.message); });
    try { g.ref.child("req/" + me).onDisconnect().remove(); } catch (e) {}
    var h = function (s) {
      var v = s.val();
      if (g.done || g.state !== "waiting") return;
      if (v === true) { g.ref.child("adm/" + me).off("value", h); g.ref.child("req/" + me).remove().catch(function () {}); gEnter(g); }
      else if (v === false) gFinish(g, "rejected");
    };
    g.ref.child("adm/" + me).on("value", h, function () {});
    g.offs.push(function () { try { g.ref.child("adm/" + me).off("value", h); } catch (e) {} });
    g.timers.wait = setTimeout(function () { if (g.state === "waiting") gFinish(g, "error", { text: L("لم يوافق المضيف بعد — حاول لاحقاً", "The host hasn't let you in yet") }); }, 5 * 60000);
  }
  function gEnter(g) {
    var me = myUid();
    g.state = "joining"; gPaint(g);
    var mine = g.ref.child("sig/" + me);
    mine.remove().catch(function () {}).then(function () {
      if (g.done) return;
      return g.ref.child("members/" + me).set({ name: myName() || "", sess: g.sess, ts: TS() });
    }).then(function () {
      if (g.done) return;
      g.live = true;
      try { g.ref.child("members/" + me).onDisconnect().remove(); mine.onDisconnect().remove(); } catch (e) {}
      g.joinedAt = Date.now(); g.state = "live"; wakeOn(); gPaint(g);
      if (!g.tick) g.tick = setInterval(function () { gPaintHead(g); }, 1000);
      if (g.role === "starter" && !g.vc) playTone("back");   // نغمة «يرنّ» حتّى ينضمّ أوّل شخص (لا رنين في الدردشة الصوتيّة)
      var first = true;
      gListen(g, mine, "child_added", function (s) { onGSig(g, s.val() || {}); });
      gListen(g, g.ref.child("members"), "value", function (s) {
        var m = s.val() || {};
        if (first) {   // من سبقني (وقت دخولٍ أقدم بحسب الخادم): أرسل لهم العروض؛ ومن يأتي بعدي يرسل هو
          first = false;
          var mt = m[me] && m[me].ts;
          Object.keys(m).forEach(function (u) {
            if (u === me || !m[u] || !m[u].sess) return;
            if (!mt || m[u].ts < mt || (m[u].ts === mt && u < me)) gOffer(g, u, m[u].sess);
          });
        }
        onGMembers(g, m);
      });
      if (g.by === me && g.approval) gListen(g, g.ref.child("req"), "value", function (s) { g.reqs = s.val() || {}; gPaintReqs(g); });
      gListen(g, g.ref.child("allow"), "value", function (s) { g.allow = s.val() || g.allow; });
    }).catch(function (e) {
      log("genter", e && e.message);
      gFinish(g, "error", { text: L("تعذّر الانضمام للمكالمة", "Couldn't join the call") });
    });
  }
  function onGMembers(g, m) {
    if (g.done) return;
    var me = myUid();
    g.members = m;
    Object.keys(g.peers).forEach(function (u) {
      var p = g.peers[u];
      if (!m[u] || m[u].sess !== p.sess) gDrop(g, u);
    });
    Object.keys(m).forEach(function (u) {
      if (u === me) return;
      g.met[u] = gName(g, u);
      // احتياط: عضوٌ لم يصلني منه عرضٌ خلال ٦ ثوانٍ ⇒ أعرض أنا (والتصادم يحسمه onGSig)
      if (!g.peers[u] && m[u] && m[u].sess && !(g.timers["o" + u])) g.timers["o" + u] = setTimeout(function () {
        delete g.timers["o" + u];
        if (!g.done && !g.peers[u] && g.members[u] && g.members[u].sess === m[u].sess) gOffer(g, u, m[u].sess);
      }, 6000);
    });
    var others = Object.keys(m).filter(function (u) { return u !== me; });
    // وحدك: انتظر قليلاً ثمّ أنهِ (لا يبقى أحدٌ في مكالمةٍ فارغة)
    // C24: الدردشة الصوتيّة غرفةٌ مفتوحة — تنتظر وحدك حتّى ١٥ دقيقة
    if (!others.length) { if (!g.timers.alone) g.timers.alone = setTimeout(function () { gFinish(g, Object.keys(g.met).length ? "everyoneLeft" : "nobody"); }, g.vc ? Math.max(ALONE_MS, 15 * 60000) : ALONE_MS); }
    else { clearTimeout(g.timers.alone); delete g.timers.alone; stopTone(); }
    gPaint(g);
  }
  function gSend(g, to, toSess, payload) {
    var o = { from: myUid(), fs: g.sess, tsn: toSess, ts: TS() };
    for (var k in payload) o[k] = payload[k];
    return g.ref.child("sig/" + to).push(o).catch(function (e) { log("gsig", e && e.message); });
  }
  function gPeer(g, uid, sess, offerer) {
    var me = myUid();
    var p = { uid: uid, sess: sess, offerer: offerer, iceIn: [], remoteSet: false, state: "connecting", stream: null };
    var pc = p.pc = new global.RTCPeerConnection({ iceServers: g.ice || STUN });
    g.local.getTracks().forEach(function (t) { pc.addTrack(t, g.local); });
    pc.onicecandidate = function (e) { if (e.candidate && e.candidate.candidate) gSend(g, uid, sess, { t: "ice", cand: iceJson(e.candidate) }); };
    pc.ontrack = function (e) {
      if (!p.stream) p.stream = (e.streams && e.streams[0]) || new global.MediaStream();
      if (p.stream.getTracks().indexOf(e.track) < 0) try { p.stream.addTrack(e.track); } catch (x) {}
      e.track.onunmute = function () { gTile(g, uid); };
      gTile(g, uid);
    };
    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (g.done || g.peers[uid] !== p) return;
      if (s === "connected") {
        p.state = "connected"; p.everConnected = true; clearTimeout(p.lost); p.lost = null;
        gCap(g); stopTone(); gTile(g, uid); gPaintHead(g);
      } else if (s === "disconnected" || s === "failed") {
        p.state = "reconnecting"; gTile(g, uid);
        if (p.offerer) setTimeout(function () { if (g.peers[uid] === p && p.state !== "connected") gRenegotiate(g, p, true); }, s === "failed" ? 0 : 3000);
        if (!p.lost) p.lost = setTimeout(function () { if (g.peers[uid] === p && p.state !== "connected") { p.state = "lost"; gTile(g, uid); } }, LOST_MS);
      }
    };
    g.peers[uid] = p;
    gTile(g, uid);
    return p;
  }
  function gOffer(g, uid, sess) {
    var p = gPeer(g, uid, sess, true);
    gRenegotiate(g, p, false);
  }
  function gRenegotiate(g, p, restart) {
    if (g.done || !p.pc) return;
    p.pc.createOffer(restart ? { iceRestart: true } : undefined)
      .then(function (o) { return p.pc.setLocalDescription(o).then(function () { return o; }); })
      .then(function (o) { gSend(g, p.uid, p.sess, { t: "offer", sdp: o.sdp }); })
      .catch(function (e) { log("goffer", e && e.message); });
  }
  function gFlush(p) { p.remoteSet = true; var q = p.iceIn; p.iceIn = []; q.forEach(function (c) { p.pc.addIceCandidate(c).catch(function () {}); }); }
  function onGSig(g, msg) {
    if (g.done || msg.tsn !== g.sess || !msg.from) return;
    var u = msg.from, p = g.peers[u];
    if (msg.t === "offer") {
      if (p && p.sess !== msg.fs) { gDrop(g, u); p = null; }
      // تصادم عرضين: الأصغر معرّفاً «مهذّب» يتراجع ويقبل عرض الآخر، والأكبر يتجاهله
      if (p && p.pc.signalingState === "have-local-offer") { if (myUid() < u) { gDrop(g, u); p = null; } else return; }
      if (!p) p = gPeer(g, u, msg.fs, false);
      p.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
        .then(function () { gFlush(p); return p.pc.createAnswer(); })
        .then(function (a) { return p.pc.setLocalDescription(a).then(function () { return a; }); })
        .then(function (a) { gSend(g, u, p.sess, { t: "answer", sdp: a.sdp }); })
        .catch(function (e) { log("ganswer", e && e.message); });
    } else if (msg.t === "answer") {
      if (!p || p.sess !== msg.fs || p.pc.signalingState !== "have-local-offer") return;
      p.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp }).then(function () { gFlush(p); }).catch(function (e) { log("gans", e && e.message); });
    } else if (msg.t === "ice") {
      if (!p || p.sess !== msg.fs || !msg.cand) return;
      if (!p.remoteSet) p.iceIn.push(msg.cand); else p.pc.addIceCandidate(msg.cand).catch(function () {});
    }
  }
  function gDrop(g, uid) {
    var p = g.peers[uid]; if (!p) return;
    try { p.pc.close(); } catch (e) {}
    clearTimeout(p.lost);
    delete g.peers[uid];
    gTile(g, uid);
  }
  // سقف الفيديو يتوزّع: كلّ جهازٍ يرسل نسخةً لكلّ مشارك
  function gCap(g) {
    var n = Object.keys(g.peers).length, br = n <= 1 ? 600000 : n === 2 ? 450000 : 320000;
    Object.keys(g.peers).forEach(function (u) {
      try {
        g.peers[u].pc.getSenders().forEach(function (s) {
          if (!s.track || s.track.kind !== "video" || !s.getParameters) return;
          var pr = s.getParameters(); if (!pr.encodings || !pr.encodings.length) pr.encodings = [{}];
          pr.encodings[0].maxBitrate = br; s.setParameters(pr).catch(function () {});
        });
      } catch (e) {}
    });
  }

  // ---------- أثناء المكالمة ----------
  function gToggleMute() { var g = gc; if (!g || !g.local) return; g.muted = !g.muted; g.local.getAudioTracks().forEach(function (t) { t.enabled = !g.muted; }); gPaint(g); }
  function gToggleCam() { var g = gc; if (!g || !g.local) return; g.camOff = !g.camOff; g.local.getVideoTracks().forEach(function (t) { t.enabled = !g.camOff; }); gLocalTile(g); gPaint(g); }
  function gSwitchCam() {
    var g = gc; if (!g || !g.local || g.switching) return;
    var want = g.facing === "user" ? "environment" : "user", old = g.local.getVideoTracks()[0];
    g.switching = true;
    try { if (old) old.stop(); } catch (e) {}
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: want } }); })
      .then(function (s) {
        if (g.done || gc !== g) { stopStream(s); return null; }   // C14
        var nt = s.getVideoTracks()[0]; if (!nt) throw new Error("no track");
        nt.enabled = !g.camOff;
        if (old) g.local.removeTrack(old);
        g.local.addTrack(nt); g.facing = want; gLocalTile(g);
        return Promise.all(Object.keys(g.peers).map(function (u) {
          var snd = g.peers[u].pc.getSenders().filter(function (x) { return x.track === old || (x.track && x.track.kind === "video"); })[0];
          return snd ? snd.replaceTrack(nt) : null;
        }));
      })
      .catch(function (e) { log("gswitch", e && e.message); toast(L("تعذّر تبديل الكاميرا", "Couldn't switch camera")); })
      .then(function () { g.switching = false; });
  }
  function gAdmit(uid, yes) {
    var g = gc; if (!g || g.by !== myUid()) return;
    g.ref.child("adm/" + uid).set(!!yes).catch(function () {});
    g.ref.child("req/" + uid).remove().catch(function () {});
  }
  // إضافة شخص: من جهات اتّصالي أو من أعضاء المحادثة
  function gAdd(uid, name) {
    var g = gc; if (!g || !g.gid) return;
    var n = Object.keys(g.members).length;
    if (n >= GC_MAX[g.type]) { toast(L("المكالمة ممتلئة", "The call is full")); return; }
    wcall("gcall.add", { gid: g.gid, to: [uid] }).then(function () { toast(L("جارٍ الاتّصال بـ", "Calling ") + (name || "")); })
      .catch(function (e) { log("gadd", e && e.message); toast(L("تعذّرت الإضافة", "Couldn't add")); });
  }
  // ترقية مكالمةٍ ثنائيّة إلى جماعيّة: Worker ينشئ المكالمة ويرنّ للجديد، والطرف الآخر ينتقل تلقائيّاً
  function upgrade(c, uid, name) {
    if (!c || c.done || c.state !== "connected" || c.upgrading) return;
    c.upgrading = true; toast(L("جارٍ الاتّصال بـ", "Calling ") + (name || ""));
    wcall("gcall.start", { to: [c.peer, uid], quiet: [c.peer], type: c.type }).then(function (r) {
      if (c.done) return;
      return c.ref.update({ up: r.gid }).then(function () {
        c.silent = true; finish(c, "upgraded", { remote: true });
        groupJoinDirect(r.gid, r.type || c.type, r.by, "starter");
      });
    }).catch(function (e) { c.upgrading = false; log("upgrade", e && e.message); toast(L("تعذّرت الإضافة", "Couldn't add")); });
  }

  // ---------- النهاية ----------
  var G_END = {
    missed: ["مكالمة جماعيّة فائتة", "Missed group call"], full: ["المكالمة ممتلئة (الحدّ ٤ فيديو / ٨ صوت حاليّاً)", "The call is full"],
    rejected: ["لم يوافق المضيف على انضمامك", "The host declined your request"], nobody: ["لم ينضمّ أحد", "Nobody joined"],
    everyoneLeft: ["غادر الجميع", "Everyone left"]
  };
  function gFinish(g, reason, opts) {
    if (!g || g.done) return;
    opts = opts || {}; g.done = true;
    var me = myUid();
    for (var k in g.timers) clearTimeout(g.timers[k]); g.timers = {};
    if (g.tick) clearInterval(g.tick); g.tick = null;
    stopTone(); wakeOff();
    g.offs.forEach(function (f) { f(); }); g.offs = [];
    if (g.inbox && (g.state === "incoming" || reason === "missed")) g.inbox.remove().catch(function () {});
    Object.keys(g.peers).forEach(function (u) { try { g.peers[u].pc.close(); } catch (e) {} });
    stopStream(g.local);
    if (g.ref && me) {
      try { g.ref.child("members/" + me).onDisconnect().cancel(); g.ref.child("sig/" + me).onDisconnect().cancel(); g.ref.child("req/" + me).onDisconnect().cancel(); } catch (e) {}
      if (g.state === "waiting") g.ref.child("req/" + me).remove().catch(function () {});
      if (g.live) {
        var ref = g.ref, cid = g.cid, gid = g.gid;
        ref.child("members/" + me).remove().then(function () { return ref.child("sig/" + me).remove(); }).then(function () {
          return ref.child("members").once("value");
        }).then(function (s) {
          if (s.val()) return;
          // آخر من يغادر ينظّف المكالمة ومؤشّرها في المحادثة
          ref.remove().catch(function () {});
          if (cid) db().ref("gcur/" + cid).once("value").then(function (x) { var v = x.val(); if (v && v.gid === gid) x.ref.remove().catch(function () {}); }).catch(function () {});
        }).catch(function () {});
      }
    }
    // السجلّ
    if (!g.silentLog && g.gid) {
      var secs = g.joinedAt && g.live ? Math.max(1, Math.round((Date.now() - g.joinedAt) / 1000)) : 0;
      var names = Object.keys(g.met).map(function (u) { return g.met[u]; });
      var type = g.role === "starter" ? "outgoing" : (g.live ? "incoming" : (g.declined ? "incoming" : "missed"));
      if (!(g.role === "starter" && !g.live && reason === "error"))
        addLog({ id: "gcall-" + g.gid + "-" + g.sess, name: g.title || names.join("، ") || g.fromName || L("مكالمة جماعيّة", "Group call"), callType: g.type,
                 type: type, time: L("الآن", "Now"), duration: secs ? fmt(secs) : null, timestamp: Date.now(), participants: names.length ? names : null, cloud: true, cid: g.cid || null, gid: g.gid });
    }
    if (gc === g) gc = null;
    log("gend", g.gid, reason);
    if (reason === "declined") { gHide(); return; }
    if (g.live) endTone();
    var tx = opts.text || (G_END[reason] && L(G_END[reason][0], G_END[reason][1])) || L("غادرت المكالمة", "You left the call");
    g.endText = tx; g.state = "ended";
    if (gui.root) { if (gui.min) gMinimize(false); gPaint(g); }
    setTimeout(function () { if (!gc) gHide(); }, opts.text ? 3200 : 1800);
  }
  function groupLeave() { if (gc) gFinish(gc, "left"); }

  // ---------- الواجهة ----------
  function gBuild() {
    if (gui.root) return gui;
    var r = el("div", "position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#10324a,#071320);color:#fff;display:none;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;direction:rtl;overflow:hidden;user-select:none;-webkit-user-select:none");
    r.id = "sawa-gcall";
    var top = el("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 10px");
    var hd = el("div", "min-width:0");
    var title = el("div", "font:800 17px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    var sub = el("div", "font:600 12px system-ui;color:#a9c6dc;margin-top:2px");
    hd.appendChild(title); hd.appendChild(sub);
    var minBtn = el("button", "background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:18px;padding:7px 12px;font:600 12px system-ui;cursor:pointer;flex-shrink:0", L("تصغير ▾", "Minimize ▾"));
    minBtn.onclick = function () { gMinimize(true); };
    top.appendChild(hd); top.appendChild(minBtn);
    var reqs = el("div", "display:flex;flex-direction:column;gap:6px;padding:0 12px");
    var grid = el("div", "flex:1;min-height:0;display:grid;gap:8px;padding:8px 12px;align-content:center");
    var center = el("div", "flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:0 20px");
    var av = el("div", "width:104px;height:104px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 40px system-ui;box-shadow:0 0 0 10px rgba(45,106,154,.25)");
    var cName = el("div", "font:800 22px system-ui"), cSt = el("div", "font:600 14px system-ui;color:#bcd6ea"), cWho = el("div", "font:500 12px system-ui;color:#8fb0c8");
    center.appendChild(av); center.appendChild(cName); center.appendChild(cSt); center.appendChild(cWho);
    var bar = el("div", "display:flex;justify-content:space-evenly;align-items:flex-start;padding:14px 8px calc(env(safe-area-inset-bottom,0px) + 22px);background:linear-gradient(transparent,rgba(0,0,0,.5))");
    var audios = el("div", "display:none");
    r.appendChild(top); r.appendChild(reqs); r.appendChild(grid); r.appendChild(center); r.appendChild(bar); r.appendChild(audios);
    var pill = el("button", "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:2147483001;display:none;align-items:center;gap:8px;background:#2d6a9a;color:#fff;border:0;border-radius:22px;padding:9px 16px;font:700 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.35);direction:rtl;cursor:pointer");
    pill.onclick = function () { gMinimize(false); };
    document.body.appendChild(r); document.body.appendChild(pill);
    gui = { root: r, title: title, sub: sub, minBtn: minBtn, reqs: reqs, grid: grid, center: center, av: av, cName: cName, cSt: cSt, cWho: cWho, bar: bar, audios: audios, pill: pill, tiles: {}, min: false };
    return gui;
  }
  function gShow(g) {
    gBuild();
    gui.grid.innerHTML = ""; gui.audios.innerHTML = ""; gui.reqs.innerHTML = ""; gui.tiles = {};
    gMinimize(false); gPaint(g);
  }
  function gHide() { if (!gui.root) return; gui.root.style.display = "none"; gui.pill.style.display = "none"; gui.min = false; gui.grid.innerHTML = ""; gui.audios.innerHTML = ""; gui.tiles = {}; }
  function gMinimize(on) {
    if (!gui.root) return; gui.min = !!on;
    gui.root.style.display = on ? "none" : "flex"; gui.pill.style.display = on ? "flex" : "none";
    gPaintHead(gc);
  }
  function gCount(g) { return Object.keys(g.members || {}).length; }
  function gStatus(g) {
    switch (g.state) {
      case "starting": return L("جارٍ التجهيز…", "Preparing…");
      case "incoming": return g.type === "video" ? L("مكالمة فيديو جماعيّة واردة", "Incoming group video call") : L("مكالمة صوتيّة جماعيّة واردة", "Incoming group voice call");
      case "waiting": return L("بانتظار موافقة المضيف…", "Waiting for the host…");
      case "joining": return L("جارٍ الانضمام…", "Joining…");
      case "live": return (gCount(g) <= 1 ? (g.vc ? L("دردشة صوتيّة — بانتظار من ينضمّ", "Voice chat — waiting for people") : L("بانتظار الآخرين…", "Waiting for others…")) : gCount(g) + " " + L("مشاركين", "people")) + " · " + fmt(Math.floor((Date.now() - g.joinedAt) / 1000));
      case "ended": return g.endText || "";
    }
    return "";
  }
  function gPaintHead(g) {
    if (!g || !gui.root) return;
    gui.title.textContent = (g.vc ? "🎙 " : "") + (g.title || (g.type === "video" ? L("مكالمة فيديو جماعيّة", "Group video call") : L("مكالمة جماعيّة", "Group call")));
    gui.sub.textContent = gStatus(g);
    if (gui.min) gui.pill.textContent = "👥 " + (g.title || "") + " · " + gStatus(g) + "  ▴";
  }
  function gPaint(g) {
    if (!gui.root || !g) return;
    gPaintHead(g);
    var centerMode = g.state === "incoming" || g.state === "waiting" || g.state === "starting" || g.state === "ended";
    gui.center.style.display = centerMode ? "flex" : "none";
    gui.grid.style.display = centerMode ? "none" : "grid";
    gui.minBtn.style.visibility = g.state === "incoming" || g.state === "ended" ? "hidden" : "visible";
    if (centerMode) {
      gui.av.textContent = (g.title || g.fromName || "👥").charAt(0);
      gui.cName.textContent = g.title || g.fromName || L("مكالمة جماعيّة", "Group call");
      gui.cSt.textContent = gStatus(g);
      var who = Object.keys(g.members || {}).map(function (u) { return gName(g, u); });
      gui.cWho.textContent = g.state === "incoming" ? ((g.fromName ? g.fromName + " " + L("يدعوك", "invites you") : "") + (who.length ? " · " + L("في المكالمة: ", "In call: ") + who.slice(0, 4).join("، ") + (who.length > 4 ? "…" : "") : "")) : "";
    } else gLayout(g);
    var bar = gui.bar; bar.innerHTML = "";
    if (g.state === "ended") return;
    if (g.state === "incoming") {
      bar.appendChild(btn(g.type === "video" ? "📹" : "📞", L("انضمام", "Join"), "#21a366", groupAccept));
      bar.appendChild(btn("✕", L("رفض", "Decline"), "#d64545", groupDecline));
      return;
    }
    if (g.local) {
      var mute = btn(g.muted ? "🔇" : "🎤", g.muted ? L("إلغاء الكتم", "Unmute") : L("كتم", "Mute"), g.muted ? "#e8f5ee" : "rgba(255,255,255,.16)", gToggleMute);
      if (g.muted) mute._b.style.color = "#123";
      bar.appendChild(mute);
      if (g.type === "video" && g.local.getVideoTracks().length) {
        bar.appendChild(btn(g.camOff ? "🚫" : "📷", g.camOff ? L("تشغيل الكاميرا", "Camera on") : L("الكاميرا", "Camera"), g.camOff ? "#e8f5ee" : "rgba(255,255,255,.16)", gToggleCam));
        bar.appendChild(btn("🔄", L("تبديل", "Flip"), "rgba(255,255,255,.16)", gSwitchCam));
      }
    }
    if (g.state === "live") bar.appendChild(btn("➕", L("إضافة", "Add"), "rgba(255,255,255,.16)", function () { pickPerson(g); }));
    bar.appendChild(btn("📞", g.state === "waiting" ? L("إلغاء", "Cancel") : L("مغادرة", "Leave"), "#d64545", groupLeave));
    bar.lastChild._b.style.transform = "rotate(135deg)";
  }
  function gPaintReqs(g) {
    if (!gui.root) return;
    gui.reqs.innerHTML = "";
    Object.keys(g.reqs || {}).forEach(function (u) {
      var row = el("div", "display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border-radius:14px;padding:8px 10px");
      row.appendChild(el("span", "flex:1;font:700 13px system-ui", ((g.reqs[u] && g.reqs[u].name) || nameOf(u) || L("عضو", "Member")) + " " + L("يطلب الانضمام", "wants to join")));
      var ok = el("button", "background:#21a366;color:#fff;border:0;border-radius:10px;padding:6px 10px;font:700 12px system-ui", L("قبول", "Admit"));
      var no = el("button", "background:#d64545;color:#fff;border:0;border-radius:10px;padding:6px 10px;font:700 12px system-ui", L("رفض", "Deny"));
      ok.onclick = function () { gAdmit(u, true); }; no.onclick = function () { gAdmit(u, false); };
      row.appendChild(ok); row.appendChild(no); gui.reqs.appendChild(row);
    });
  }
  function gTileEl(uid) {
    var t = gui.tiles[uid];
    if (t) return t;
    var box = el("div", "position:relative;border-radius:16px;overflow:hidden;background:#13283a;min-height:0;display:flex;align-items:center;justify-content:center");
    var v = el("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none");
    v.autoplay = true; v.playsInline = true; v.muted = true; v.setAttribute("playsinline", "");
    var av = el("div", "width:64px;height:64px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 26px system-ui");
    var lab = el("div", "position:absolute;bottom:6px;right:8px;left:8px;font:700 12px system-ui;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    box.appendChild(v); box.appendChild(av); box.appendChild(lab);
    var a = el("audio", ""); a.autoplay = true;
    gui.audios.appendChild(a);
    t = gui.tiles[uid] = { box: box, v: v, av: av, lab: lab, a: a };
    return t;
  }
  function gLocalTile(g) {
    if (!gui.root || !g.local) return;
    var t = gTileEl("__me");
    var hasV = g.type === "video" && g.local.getVideoTracks().length > 0 && !g.camOff;
    t.v.srcObject = hasV ? g.local : null; t.v.style.display = hasV ? "block" : "none"; t.v.style.transform = g.facing === "environment" ? "none" : "scaleX(-1)";
    if (hasV) try { t.v.play().catch(function () {}); } catch (e) {}
    t.av.textContent = (myName() || "أ").charAt(0); t.av.style.display = hasV ? "none" : "flex";
    t.lab.textContent = L("أنت", "You") + (g.muted ? " · 🔇" : "");
    gLayout(g);
  }
  function gTile(g, uid) {
    if (!gui.root || !g || g.done) return;
    var p = g.peers[uid], inCall = g.members && g.members[uid];
    if (!p && !inCall) {   // غادر
      var old = gui.tiles[uid];
      if (old) { try { old.v.srcObject = null; old.a.srcObject = null; old.box.remove(); old.a.remove(); } catch (e) {} delete gui.tiles[uid]; }
      gLayout(g); return;
    }
    var t = gTileEl(uid);
    var st = p && p.stream, hasV = !!(st && st.getVideoTracks().some(function (x) { return x.readyState === "live" && !x.muted; }));
    if (st && t.a.srcObject !== st) { t.a.srcObject = st; try { t.a.play().catch(function () {}); } catch (e) {} }
    if (hasV && t.v.srcObject !== st) { t.v.srcObject = st; try { t.v.play().catch(function () {}); } catch (e) {} }
    t.v.style.display = hasV ? "block" : "none"; t.av.style.display = hasV ? "none" : "flex";
    t.av.textContent = gName(g, uid).charAt(0);
    var state = !p ? L("ينضمّ…", "joining…") : p.state === "connected" ? "" : p.state === "lost" ? L("انقطع", "lost") : p.state === "reconnecting" ? L("الشبكة ضعيفة…", "weak network…") : L("جارٍ الربط…", "connecting…");
    t.lab.textContent = gName(g, uid) + (state ? " · " + state : "");
    gLayout(g);
  }
  function gLayout(g) {
    if (!gui.root || !g) return;
    var me = myUid();
    var ids = ["__me"].concat(Object.keys(g.members || {}).filter(function (u) { return u !== me; }));
    ids = ids.filter(function (u) { return gui.tiles[u] || u === "__me"; });
    var n = ids.length, cols = n <= 1 ? 1 : n <= 4 ? (n === 2 ? 1 : 2) : 3, rows = Math.ceil(n / cols);
    gui.grid.style.gridTemplateColumns = "repeat(" + cols + ",1fr)";
    gui.grid.style.gridTemplateRows = "repeat(" + rows + "," + (g.type === "video" ? "1fr" : "minmax(0,150px)") + ")";
    ids.forEach(function (u) { var t = gui.tiles[u]; if (t && t.box.parentNode !== gui.grid) gui.grid.appendChild(t.box); });
  }
  // اختيار شخص: جهات الاتّصال (+ أعضاء المحادثة) ممّن ليسوا في المكالمة
  function pickPerson(target) {
    var me = myUid(), inCall = {};
    if (target === cur && cur) inCall[cur.peer] = 1;
    else if (gc) Object.keys(gc.members || {}).forEach(function (u) { inCall[u] = 1; });
    var list = [];
    try { list = C().contacts().filter(function (c) { return c.uid && c.uid !== me && !inCall[c.uid]; }); } catch (e) {}
    var ov = el("div", "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:system-ui");
    var box = el("div", "background:#1b2633;color:#fff;border-radius:20px;width:min(92vw,380px);max-height:70vh;display:flex;flex-direction:column;overflow:hidden");
    box.appendChild(el("div", "padding:16px 16px 4px;font:800 15px system-ui;text-align:center", L("إضافة شخص للمكالمة", "Add someone to the call")));
    box.appendChild(el("div", "padding:0 16px 10px;font:500 11px system-ui;color:#9fb3c6;text-align:center", L("يُضاف دون قطع المكالمة", "They'll join without ending the call")));
    var sc = el("div", "flex:1;overflow-y:auto;padding:0 10px");
    if (!list.length) sc.appendChild(el("div", "padding:20px;text-align:center;color:#8aa0b4;font:600 12px system-ui", L("لا أحد آخر في جهات اتّصالك", "No other contacts")));
    list.forEach(function (c) {
      var b = el("button", "width:100%;display:flex;align-items:center;gap:10px;padding:10px 6px;background:transparent;border:0;color:#fff;font:700 13px system-ui;text-align:right;cursor:pointer");
      var a = el("span", "width:34px;height:34px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;flex-shrink:0", (c.name || "؟").charAt(0));
      b.appendChild(a); b.appendChild(el("span", "flex:1", c.name || ""));
      if (c.online) b.appendChild(el("span", "width:8px;height:8px;border-radius:50%;background:#22c55e"));
      b.onclick = function () { ov.remove(); if (target === cur) upgrade(cur, c.uid, c.name); else gAdd(c.uid, c.name); };
      sc.appendChild(b);
    });
    box.appendChild(sc);
    var cancel = el("button", "margin:10px 14px 14px;padding:10px;border:0;border-radius:12px;background:#2a3644;color:#e2e8f0;font:700 13px system-ui", L("إلغاء", "Cancel"));
    cancel.onclick = function () { ov.remove(); };
    box.appendChild(cancel); ov.appendChild(box);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  // ---------- مكالمةٌ جارية في محادثة جماعيّة (شريط «انضمام») ----------
  function watchChat(cid, cb) {
    var d = db(); if (!d || !cid || !/^(fam_|grp_)/.test(cid)) return function () {};
    var ref = d.ref("gcur/" + cid), memRef = null, memH = null, last = null, closed = false;
    function emit(v) { var j = JSON.stringify(v); if (j === last || closed) return; last = j; try { cb(v); } catch (e) {} }
    function stopMem() { if (memRef && memH) try { memRef.off("value", memH); } catch (e) {} memRef = null; memH = null; }
    var h = ref.on("value", function (s) {
      var v = s.val(); stopMem();
      if (!v || !v.gid) { emit(null); return; }
      emit({ gid: v.gid, type: v.type, n: null, vc: !!v.vc });
      memRef = d.ref("gcalls/" + v.gid + "/members");
      memH = memRef.on("value", function (m) {
        var mm = m.val() || {}, n = Object.keys(mm).length;
        emit(n ? { gid: v.gid, type: v.type, n: n, inCall: !!mm[myUid()], vc: !!v.vc } : null);
      }, function () { /* لستُ في قائمة المدعوّين بعد — يبقى الشريط، والانضمام عبر الخادم */ });
    }, function () { emit(null); });
    return function () { closed = true; stopMem(); try { ref.off("value", h); } catch (e) {} };
  }

  // ============================================================
  //  C7: المكالمات المجدولة — محفوظة في الخادم (scheds)، تذكيرٌ حقيقيّ بإشعار من الـWorker (Cron)
  // ============================================================
  var schedItems = [], schedAt = 0, schedBusy = false;
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(ts) { var d = new Date(ts); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function ymd(ts) { var d = new Date(ts); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function schedShape(s) {
    var me = myUid(), mine = s.by === me;
    return { id: s.id, cloud: true, mine: mine, by: s.by, cid: s.cid || null, users: s.users || [],
             contactName: mine ? (s.toName || s.title || L("مكالمة مجدولة", "Scheduled call")) : (s.byName || nameOf(s.by) || L("مكالمة مجدولة", "Scheduled call")),
             description: s.title || "", date: ymd(s.at), startTime: hhmm(s.at), endTime: hhmm(s.end || s.at + 1800000),
             callType: s.type === "video" ? "video" : "audio", requireApproval: !!s.approval, reminderMinutes: s.remind || 15, timestamp: s.at };
  }
  function publishSched() {
    if (app && app.setScheduledCalls) try { app.setScheduledCalls(schedItems.filter(function (s) { return !s.room; }).map(schedShape)); } catch (e) {}
    // C8: الغرف المجدولة تُعرض في قائمة المحادثات
    if (app && app.setScheduledRooms) try { app.setScheduledRooms(schedItems.filter(function (s) { return s.room; }).map(function (s) {
      return { id: s.id, code: s.room, link: roomLink(s.room), title: s.title || L("غرفة سوا", "Sawa room"), at: s.at, end: s.end || null, cloud: true, mine: s.by === myUid() }; }).sort(function (a, b) { return a.at - b.at; })); } catch (e) {}
  }
  function schedRefresh(force) {
    if (!myUid() || schedBusy || (!force && Date.now() - schedAt < 60000)) return Promise.resolve(schedItems);
    schedBusy = true;
    return wcall("sched.list", {}).then(function (b) { schedItems = (b && b.items) || []; schedAt = Date.now(); publishSched(); return schedItems; })
      .catch(function (e) { log("sched.list", e && e.message); return schedItems; })
      .then(function (r) { schedBusy = false; return r; });
  }
  // entry من شاشة الجدولة: { contactName, peerUid | cid, description, timestamp, endTime, callType, requireApproval, reminderMinutes }
  function schedSave(entry) {
    if (!enabled()) return Promise.reject(new Error("offline"));
    var end = entry.timestamp + 30 * 60000;
    try { var p = String(entry.endTime || "").split(":"); if (p.length === 2) { var d = new Date(entry.timestamp); d.setHours(+p[0], +p[1], 0, 0); if (d.getTime() <= entry.timestamp) d.setDate(d.getDate() + 1); end = d.getTime(); } } catch (e) {}
    var pl = { title: entry.description || "", type: entry.callType, at: entry.timestamp, end: end, remind: entry.reminderMinutes, approval: !!entry.requireApproval, toName: entry.contactName || "" };
    if (entry.room) { pl.room = entry.room; if (entry.to && entry.to.length) pl.to = entry.to; }
    else if (entry.cid) pl.cid = entry.cid; else pl.to = [entry.peerUid];
    return wcall("sched.set", pl).then(function (b) { if (b && b.item) { schedItems = schedItems.filter(function (x) { return x.id !== b.item.id; }).concat([b.item]); publishSched(); } return b; });
  }
  function schedRemove(id) {
    schedItems = schedItems.filter(function (x) { return x.id !== id; }); publishSched();
    return wcall("sched.delete", { id: id }).catch(function (e) { log("sched.delete", e && e.message); schedRefresh(true); });
  }
  function schedStart(entry) {
    if (!entry || !entry.cloud || !enabled()) return false;
    return groupStart({ sched: entry.id }, entry.callType, entry.description || entry.contactName);
  }

  // ============================================================
  //  C8: غرف سوا — برمزٍ ورابط · غرفة انتظار · قفل · أيدٍ مرفوعة · كتم من المضيف · المتحدّث النشط (مستوى الصوت فعلاً)
  //  · دردشة ومحضر (قرارات/مهامّ/نقاط) يُرسَل إلى مجموعة · دعوة جهات الاتّصال · تفاعلات طائرة · وضع البيانات القليلة · مدّة
  //  RTDB: rooms/{code}/{ meta{host,title,ts,locked,lobby,endsAt,ended,sched}, members/{uid}{name,sess,ts,mic,cam,hand,low},
  //        sig/{to}/{push}, req/{uid}, adm/{uid}, kick/{uid}, ctl/{uid}{mute,ask,lower}, chat/{push}, rx/{push} }
  //  شبكة مباشرة ≤ ٨ أشخاص و≤ ٤ كاميرات (حتّى SFU). الصوت والصورة قناتان ثابتتان من البداية ⇒ تشغيل الكاميرا بلا إعادة تفاوض.
  // ============================================================
  var ROOM_MAX = 8, ROOM_CAMS = 4, HOST_GRACE = global.__sawaRoomGraceMs || 12000;
  var rm = null, rui = { root: null };
  var CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newCode() { var r = new Uint8Array(8), s = ""; try { global.crypto.getRandomValues(r); } catch (e) { for (var i = 0; i < 8; i++) r[i] = Math.random() * 256; } for (var j = 0; j < 8; j++) s += CODE_CH[r[j] % 32]; return s; }
  function cleanCode(c) { var m = String(c || "").toUpperCase().match(/[A-Z0-9]{8}/); return m && /^[A-HJ-NP-Z2-9]{8}$/.test(m[0]) ? m[0] : null; }
  function roomLink(code) { try { return global.location.origin + global.location.pathname.replace(/[^/]*$/, "") + "?room=" + code; } catch (e) { return "?room=" + code; } }
  var RX = ["👏", "❤️", "😂", "👍", "🤲", "🎉"];
  var NOTE = { point: ["💬", "نقطة", "Point", "#60A5FA"], decision: ["✅", "قرار", "Decision", "#22C55E"], task: ["📌", "مهمّة", "Task", "#F59E0B"] };

  function rNew(o) {
    o.peers = {}; o.members = {}; o.offs = []; o.timers = {}; o.sess = rid(8); o.mic = true; o.camOn = false; o.camTrack = null; o.facing = "user";
    o.hand = 0; o.low = false; o.chat = []; o.unread = 0; o.panel = null; o.noteKind = null; o.reqs = {}; o.levels = {}; o.speaker = null;
    o.ctlSeen = null; o.met = {}; o.meta = {}; o.hostSeen = false;
    return o;
  }
  function rRef(r, p) { return r.ref.child(p); }
  function rListen(r, ref, ev, fn, err) { var h = ref.on(ev, fn, err || function () {}); r.offs.push(function () { try { ref.off(ev, h); } catch (e) {} }); }
  // C14: اسم جهة الاتّصال أوّلاً؛ ومن ليس في جهاتك يظهر باسمه الذي اختاره مسبوقاً بـ«~» (كي لا ينتحل أحدٌ «أمّي»)
  function stranger(n) { n = String(n || "").trim().slice(0, 40); return n ? "~ " + n : L("ضيف", "Guest"); }
  function rName(r, uid) { if (uid === myUid()) return myName() || L("أنت", "You"); return nameOf(uid) || stranger(r.members[uid] && r.members[uid].name); }
  function amHost(r) { return !!r && r.meta.host === myUid(); }

  // ---------- الإنشاء والانضمام ----------
  function roomCreate(title) {
    if (!enabled()) return false;
    return roomJoin(newCode(), { create: true, title: title || ((myName() ? L("غرفة ", "Room of ") + myName() : L("غرفة سوا", "Sawa room"))) });
  }
  function roomJoin(code, opts) {
    opts = opts || {};
    code = cleanCode(code);
    if (!enabled() || !code) { if (!code) toast(L("رمز الغرفة غير صحيح", "Invalid room code")); return false; }
    if (rm && rm.code === code) { if (rui.min) rMinimize(false); return true; }
    if (busy()) { toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
    var r = rm = rNew({ code: code, title: opts.title || "", state: "starting" });
    if (opts.mic === false) r.startMuted = true;
    r.ref = db().ref("rooms/" + code);
    rShow(r);
    var me = myUid();
    rRef(r, "meta").once("value").then(function (s) {
      var m = s.val();
      if (!m) {
        if (!opts.create) throw Object.assign(new Error("gone"), { ui: L("الغرفة غير موجودة أو انتهت", "This room doesn't exist or has ended") });
        m = { host: me, owner: me, title: String(r.title).slice(0, 80), ts: TS(), gc: Date.now() + 3 * 3600000, locked: false, lobby: false };   // C16: gc = متى يجوز حذفها فارغةً   // C14: المالك لا يُطرد ويستعيد الاستضافة
        return rRef(r, "meta").set(m).then(function () { return rRef(r, "meta").once("value"); }).then(function (x) { return x.val(); });
      }
      return m;
    }).then(function (m) {
      if (r.done) return;
      r.meta = m || {}; r.title = r.meta.title || r.title;
      if (r.meta.ended) throw Object.assign(new Error("ended"), { ui: L("انتهت هذه الغرفة", "This room has ended") });
      // C14: الميكروفون لا يُفتح قبل القبول — كان يُلتقط ثمّ ينتظر في غرفة الانتظار مفتوحاً
      return Promise.all([rRef(r, "kick/" + me).once("value").catch(function () { return { val: function () { return null; } }; }),
                          rRef(r, "adm/" + me).once("value").catch(function () { return { val: function () { return null; } }; }),
                          getIce()]);
    }).then(function (x) {
      if (!x || r.done) return;
      if (x[0].val() === true) throw Object.assign(new Error("kicked"), { ui: L("أخرجك المضيف من هذه الغرفة", "The host removed you from this room") });
      r.ice = x[2];
      if (r.meta.owner === me && r.meta.host !== me) { r.meta.host = me; rRef(r, "meta/host").set(me).catch(function (e) { log("reclaim", e && e.message); }); }
      var host = r.meta.host === me, admitted = x[1].val() === true;
      rListen(r, rRef(r, "meta"), "value", function (s) { rOnMeta(r, s.val()); });
      rListen(r, rRef(r, "kick/" + me), "value", function (s) { if (s.val() === true && !r.done) rLeave(r, "kicked"); });
      if (!host && !admitted && r.meta.locked) throw Object.assign(new Error("locked"), { ui: L("الغرفة مقفلة — اطلب من المضيف فتحها", "The room is locked") });
      if (!host && !admitted && r.meta.lobby && r.meta.owner !== me) { rWait(r); return; }
      return rMedia(r).then(function () { if (!r.done) rEnter(r); });
    }).catch(function (e) {
      log("room", e && (e.name || e.message), e && e.message);
      rLeave(r, "error", { text: (e && e.ui) || mediaError(e) || L("تعذّر دخول الغرفة", "Couldn't join the room") });
    });
    return true;
  }
  function rMedia(r) {
    return getMedia("audio").then(function (st) {
      if (r.done) { stopStream(st); return; }
      r.local = st;
      if (r.startMuted) { r.mic = false; st.getAudioTracks().forEach(function (t) { t.enabled = false; }); }
    });
  }
  function rWait(r) {
    var me = myUid();
    r.state = "waiting"; rPaint(r);
    rRef(r, "req/" + me).set({ name: myName() || "", ts: TS() }).catch(function (e) { log("req", e && e.message); rLeave(r, "error", { text: L("الغرفة مقفلة", "The room is locked") }); });
    try { rRef(r, "req/" + me).onDisconnect().remove(); } catch (e) {}
    rListen(r, rRef(r, "adm/" + me), "value", function (s) {
      var v = s.val();
      if (r.done || r.state !== "waiting") return;
      if (v === true) { rRef(r, "req/" + me).remove().catch(function () {}); r.state = "joining"; rPaint(r);
        rMedia(r).then(function () { if (!r.done) rEnter(r); }).catch(function (e) { rLeave(r, "error", { text: mediaError(e) || L("تعذّر دخول الغرفة", "Couldn't join the room") }); }); }
      else if (v === false) rLeave(r, "denied");
    });
  }
  function rEnter(r) {
    var me = myUid(), mine = rRef(r, "sig/" + me);
    r.state = "joining"; rPaint(r);
    mine.remove().catch(function () {}).then(function () {
      if (r.done) return;
      return rRef(r, "members/" + me).set({ name: myName() || "", sess: r.sess, ts: TS(), mic: r.mic, cam: false, hand: 0, low: false });
    }).then(function () {
      if (r.done) return;
      r.live = true; r.joinedAt = Date.now();
      try { rRef(r, "members/" + me).onDisconnect().remove(); mine.onDisconnect().remove(); } catch (e) {}
      return rRef(r, "members").once("value");
    }).then(function (s) {
      if (!s || r.done) return;
      var m = s.val() || {};
      if (Object.keys(m).length > ROOM_MAX) { rLeave(r, "full"); return; }
      r.state = "live"; wakeOn(); rPaint(r);
      if (!r.tick) r.tick = setInterval(function () { rTick(r); }, 1000);
      var first = true;
      rListen(r, mine, "child_added", function (x) { onRSig(r, x.val() || {}); });
      rListen(r, rRef(r, "members"), "value", function (x) {
        var mm = x.val() || {};
        if (first) {   // الوافد الجديد يعرض على من سبقه (بحسب ts الخادم)
          first = false;
          var mt = mm[me] && mm[me].ts;
          Object.keys(mm).forEach(function (u) {
            if (u === me || !mm[u] || !mm[u].sess) return;
            if (!mt || mm[u].ts < mt || (mm[u].ts === mt && u < me)) rOffer(r, u, mm[u].sess);
          });
        }
        onRMembers(r, mm);
      });
      var joinTs = Date.now() - 5000;
      rListen(r, rRef(r, "chat"), "child_added", function (x) { onRChat(r, x.key, x.val() || {}); });
      rListen(r, rRef(r, "rx"), "child_added", function (x) { var v = x.val() || {}; if ((v.ts || 0) > joinTs + (srvOffset || 0) - 10000) rFloat(v.e); });
      rListen(r, rRef(r, "ctl/" + me), "value", function (x) { onRCtl(r, x.val() || {}); });
      rWatchReqs(r);
      rLevelsStart(r);
    }).catch(function (e) {
      log("renter", e && e.message);
      rLeave(r, "error", { text: L("تعذّر دخول الغرفة", "Couldn't join the room") });
    });
  }
  function rWatchReqs(r) {
    if (r.reqOff) { r.reqOff(); r.reqOff = null; }
    if (!amHost(r) || !r.live) { r.reqs = {}; rPaintBanners(r); return; }
    var ref = rRef(r, "req"), h = ref.on("value", function (s) { r.reqs = s.val() || {}; rPaintBanners(r); }, function () {});
    r.reqOff = function () { try { ref.off("value", h); } catch (e) {} };
    r.offs.push(function () { if (r.reqOff) r.reqOff(); });
  }
  function rOnMeta(r, m) {
    if (r.done) return;
    if (!m) { if (r.live) rLeave(r, "ended"); return; }
    var wasHost = amHost(r);
    r.meta = m; r.title = m.title || r.title;
    if (m.ended) { rLeave(r, "ended"); return; }
    if (wasHost !== amHost(r)) { rWatchReqs(r); if (amHost(r)) toast(L("صرتَ مضيف الغرفة", "You're now the host")); }
    rPaint(r);
  }
  function onRMembers(r, m) {
    if (r.done) return;
    var me = myUid();
    if (r.live && !m[me]) { rLeave(r, "kicked"); return; }   // أزالني المضيف
    r.members = m;
    Object.keys(r.peers).forEach(function (u) { var p = r.peers[u]; if (!m[u] || m[u].sess !== p.sess) rDrop(r, u); });
    Object.keys(m).forEach(function (u) {
      if (u === me) return;
      r.met[u] = rName(r, u);
      var p = r.peers[u];
      if (p && p.lowSent !== !!m[u].low) { p.lowSent = !!m[u].low; rSenders(r, p); }   // من فعّل «بيانات قليلة» لا نرسل له الصورة
      if (!p && m[u].sess && !r.timers["o" + u]) r.timers["o" + u] = setTimeout(function () {
        delete r.timers["o" + u];
        if (!r.done && !r.peers[u] && r.members[u] && r.members[u].sess === m[u].sess) rOffer(r, u, m[u].sess);
      }, 6000);
    });
    // المضيف غاب (أغلق التطبيق) ⇒ أقدم الحاضرين يتسلّم بعد مهلة
    if (r.meta.host && m[r.meta.host]) { r.hostSeen = true; clearTimeout(r.timers.claim); delete r.timers.claim; }
    else if (r.hostSeen && r.meta.host && !m[r.meta.host] && !r.timers.claim) r.timers.claim = setTimeout(function () {
      delete r.timers.claim;
      if (r.done || r.members[r.meta.host]) return;
      var oldest = Object.keys(r.members).sort(function (a, b) { return (r.members[a].ts || 0) - (r.members[b].ts || 0); })[0];
      if (oldest === me) rRef(r, "meta/host").set(me).catch(function (e) { log("claim", e && e.message); });
    }, HOST_GRACE);
    Object.keys(rui.tiles || {}).forEach(function (u) { if (u !== "__me" && !m[u]) rTile(r, u); });
    Object.keys(m).forEach(function (u) { if (u !== me) rTile(r, u); });
    rPaint(r);
  }

  // ---------- الإشارات (مثل الجماعيّة + قنوات ثابتة) ----------
  function rSend(r, to, toSess, payload) {
    var o = { from: myUid(), fs: r.sess, tsn: toSess, ts: TS() };
    for (var k in payload) o[k] = payload[k];
    return rRef(r, "sig/" + to).push(o).catch(function (e) { log("rsig", e && e.message); });
  }
  function rSenders(r, p) {
    try {
      var a = r.local && r.local.getAudioTracks()[0];
      if (p.at) p.at.sender.replaceTrack(a || null).catch(function () {});
      var low = r.members[p.uid] && r.members[p.uid].low;
      if (p.vt) p.vt.sender.replaceTrack(r.camOn && r.camTrack && !low && !r.low ? r.camTrack : null).catch(function () {});
    } catch (e) {}
  }
  function rPeer(r, uid, sess, offerer) {
    var p = { uid: uid, sess: sess, offerer: offerer, iceIn: [], remoteSet: false, state: "connecting", stream: new global.MediaStream() };
    var pc = p.pc = new global.RTCPeerConnection({ iceServers: r.ice || STUN });
    if (offerer) { p.at = pc.addTransceiver("audio", { direction: "sendrecv" }); p.vt = pc.addTransceiver("video", { direction: "sendrecv" }); rSenders(r, p); }
    pc.onicecandidate = function (e) { if (e.candidate && e.candidate.candidate) rSend(r, uid, sess, { t: "ice", cand: iceJson(e.candidate) }); };
    pc.ontrack = function (e) {
      if (p.stream.getTracks().indexOf(e.track) < 0) try { p.stream.addTrack(e.track); } catch (x) {}
      e.track.onunmute = function () { rTile(r, uid); }; e.track.onmute = function () { rTile(r, uid); };
      rTile(r, uid); rLevelWatch(r, uid, p.stream);
    };
    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (r.done || r.peers[uid] !== p) return;
      if (s === "connected") { p.state = "connected"; clearTimeout(p.lost); p.lost = null; rCap(r); rTile(r, uid); }
      else if (s === "disconnected" || s === "failed") {
        p.state = "reconnecting"; rTile(r, uid);
        if (p.offerer) setTimeout(function () { if (r.peers[uid] === p && p.state !== "connected") rNegotiate(r, p, true); }, s === "failed" ? 0 : 3000);
        if (!p.lost) p.lost = setTimeout(function () { if (r.peers[uid] === p && p.state !== "connected") { p.state = "lost"; rTile(r, uid); } }, LOST_MS);
      }
    };
    r.peers[uid] = p; rTile(r, uid);
    return p;
  }
  function rOffer(r, uid, sess) { rNegotiate(r, rPeer(r, uid, sess, true), false); }
  function rNegotiate(r, p, restart) {
    if (r.done || !p.pc) return;
    p.pc.createOffer(restart ? { iceRestart: true } : undefined)
      .then(function (o) { return p.pc.setLocalDescription(o).then(function () { return o; }); })
      .then(function (o) { rSend(r, p.uid, p.sess, { t: "offer", sdp: o.sdp }); })
      .catch(function (e) { log("roffer", e && e.message); });
  }
  function onRSig(r, msg) {
    if (r.done || msg.tsn !== r.sess || !msg.from) return;
    var u = msg.from, p = r.peers[u];
    if (msg.t === "offer") {
      if (p && p.sess !== msg.fs) { rDrop(r, u); p = null; }
      if (p && p.pc.signalingState === "have-local-offer") { if (myUid() < u) { rDrop(r, u); p = null; } else return; }
      if (!p) p = rPeer(r, u, msg.fs, false);
      p.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp }).then(function () {
        p.pc.getTransceivers().forEach(function (t) {
          var k = t.receiver && t.receiver.track && t.receiver.track.kind;
          if (k === "audio" && !p.at) p.at = t; else if (k === "video" && !p.vt) p.vt = t;
          try { if (t.direction !== "sendrecv") t.direction = "sendrecv"; } catch (e) {}
        });
        rSenders(r, p); gFlush(p);
        return p.pc.createAnswer();
      }).then(function (a) { return p.pc.setLocalDescription(a).then(function () { return a; }); })
        .then(function (a) { rSend(r, u, p.sess, { t: "answer", sdp: a.sdp }); })
        .catch(function (e) { log("ranswer", e && e.message); });
    } else if (msg.t === "answer") {
      if (!p || p.sess !== msg.fs || p.pc.signalingState !== "have-local-offer") return;
      p.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp }).then(function () { gFlush(p); }).catch(function (e) { log("rans", e && e.message); });
    } else if (msg.t === "ice") {
      if (!p || p.sess !== msg.fs || !msg.cand) return;
      if (!p.remoteSet) p.iceIn.push(msg.cand); else p.pc.addIceCandidate(msg.cand).catch(function () {});
    }
  }
  function rDrop(r, uid) {
    var p = r.peers[uid]; if (!p) return;
    try { p.pc.close(); } catch (e) {}
    clearTimeout(p.lost); delete r.peers[uid]; delete r.levels[uid];
    if (p.an) try { p.an.src.disconnect(); } catch (e) {}
    rTile(r, uid);
  }
  function rCap(r) {
    var n = Object.keys(r.peers).length, br = n <= 1 ? 600000 : n <= 3 ? 400000 : 250000;
    Object.keys(r.peers).forEach(function (u) {
      var p = r.peers[u]; if (!p.vt) return;
      try { var pr = p.vt.sender.getParameters(); if (!pr.encodings || !pr.encodings.length) pr.encodings = [{}]; pr.encodings[0].maxBitrate = br; p.vt.sender.setParameters(pr).catch(function () {}); } catch (e) {}
    });
  }

  // ---------- المتحدّث النشط: مستوى الصوت الحقيقيّ ----------
  function rLevelWatch(r, uid, stream) {
    var p = uid === "__me" ? r : r.peers[uid];
    var ctx = audioCtx(); if (!ctx || !p || p.an) return;
    var tr = stream.getAudioTracks()[0]; if (!tr) return;
    try {
      var src = ctx.createMediaStreamSource(new global.MediaStream([tr])), an = ctx.createAnalyser();
      an.fftSize = 512; src.connect(an);
      p.an = { src: src, an: an, buf: new Uint8Array(an.fftSize) };
    } catch (e) { log("level", e && e.message); }
  }
  function rLevelsStart(r) {
    if (r.local) rLevelWatch(r, "__me", r.local);
    r.timers.lv = setInterval(function () {
      if (r.done) return;
      var best = null, bestV = 0.035, me = myUid();
      var read = function (o) { if (!o || !o.an) return 0; o.an.an.getByteTimeDomainData(o.an.buf); var s = 0; for (var i = 0; i < o.an.buf.length; i++) { var d = (o.an.buf[i] - 128) / 128; s += d * d; } return Math.sqrt(s / o.an.buf.length); };
      Object.keys(r.peers).forEach(function (u) { var v = read(r.peers[u]); r.levels[u] = v; if (r.members[u] && r.members[u].mic !== false && v > bestV) { bestV = v; best = u; } });
      var mv = r.mic ? read(r) : 0; r.levels[me] = mv; if (mv > bestV) { best = "__me"; }
      if (best !== r.speaker) { var old = r.speaker; r.speaker = best; if (old) rTile(r, old === me ? "__me" : old); if (best) rTile(r, best); }
    }, 300);
  }

  // ---------- أفعالي ----------
  function rMember(r, patch) { if (!r.live) return; rRef(r, "members/" + myUid()).update(patch).catch(function (e) { log("rmember", e && e.message); }); }
  function rToggleMic(r) { r = r || rm; if (!r || !r.local) return; r.mic = !r.mic; r.local.getAudioTracks().forEach(function (t) { t.enabled = r.mic; }); if (r.mic) r.askUnmute = false; rMember(r, { mic: r.mic }); rTile(r, "__me"); rPaint(r); }
  function rToggleCam(r) {
    r = r || rm; if (!r || !r.live) return;
    if (r.camOn) {
      r.camOn = false; try { if (r.camTrack) r.camTrack.stop(); } catch (e) {} r.camTrack = null;
      Object.keys(r.peers).forEach(function (u) { rSenders(r, r.peers[u]); });
      rMember(r, { cam: false }); rTile(r, "__me"); rPaint(r); return;
    }
    if (r.low) { toast(L("أوقف «بيانات قليلة» أوّلاً", "Turn off low-data mode first")); return; }
    var me = myUid(), cams = Object.keys(r.members).filter(function (u) { return u !== me && r.members[u].cam; }).length;
    if (cams >= ROOM_CAMS) { toast(L("الحدّ ٤ كاميرات في الغرفة حاليّاً", "Max 4 cameras for now")); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: r.facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20, max: 24 } } }).then(function (s) {
      if (r.done) { stopStream(s); return; }
      r.camTrack = s.getVideoTracks()[0]; r.camOn = true;
      Object.keys(r.peers).forEach(function (u) { rSenders(r, r.peers[u]); });
      rMember(r, { cam: true }); rCap(r); rTile(r, "__me"); rPaint(r);
    }).catch(function (e) { toast(mediaError(e) || L("تعذّر تشغيل الكاميرا", "Couldn't start the camera")); });
  }
  function rFlip(r) {
    r = r || rm; if (!r || !r.camOn || r.switching) return;
    var want = r.facing === "user" ? "environment" : "user"; r.switching = true;
    try { r.camTrack.stop(); } catch (e) {}
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: want } }); })
      .then(function (s) { if (r.done || rm !== r) { stopStream(s); return; } r.camTrack = s.getVideoTracks()[0]; r.facing = want; Object.keys(r.peers).forEach(function (u) { rSenders(r, r.peers[u]); }); rTile(r, "__me"); })
      .catch(function () { toast(L("تعذّر تبديل الكاميرا", "Couldn't switch camera")); })
      .then(function () { r.switching = false; });
  }
  function rToggleHand(r) { r = r || rm; if (!r || !r.live) return; r.hand = r.hand ? 0 : Date.now(); rMember(r, { hand: r.hand }); rTile(r, "__me"); rPaint(r); }
  function rToggleLow(r) {
    r = r || rm; if (!r || !r.live) return;
    r.low = !r.low;
    if (r.low && r.camOn) rToggleCam(r);
    rMember(r, { low: r.low });
    Object.keys(rui.tiles || {}).forEach(function (u) { if (u !== "__me") rTile(r, u); });
    toast(r.low ? L("وضع البيانات القليلة: صوتٌ فقط", "Low-data mode: audio only") : L("عاد الفيديو", "Video is back"));
    rPaint(r);
  }
  function rSendChat(r, text, kind) {
    r = r || rm; text = String(text || "").trim(); if (!r || !r.live || !text) return;
    var o = { from: myUid(), name: myName() || "", text: text.slice(0, 1000), ts: TS() };
    if (kind && NOTE[kind]) o.kind = kind;
    rRef(r, "chat").push(o).catch(function (e) { log("rchat", e && e.message); toast(L("تعذّر الإرسال", "Couldn't send")); });
  }
  function onRChat(r, id, v) {
    if (r.chat.some(function (x) { return x.id === id; })) return;
    // C14: من ينضمّ لاحقاً لا يرى الدردشة التي قبله (الملاحظات والقرارات تبقى للجميع)
    if (!v.kind && v.from !== myUid() && r.joinedAt && (v.ts || 0) < r.joinedAt - 60000 + (srvOffset || 0)) return;
    r.chat.push({ id: id, from: v.from, name: v.from === myUid() ? rName(r, v.from) : (nameOf(v.from) || stranger(v.name || (r.members[v.from] || {}).name)), text: v.text || "", kind: v.kind || null, ts: v.ts || Date.now() });
    if (r.panel !== "chat" && v.from !== myUid()) r.unread++;
    rPaintChat(r); rPaint(r);
  }
  function rReact(e) { var r = rm; if (!r || !r.live) return; rRef(r, "rx").push({ from: myUid(), e: e, ts: TS() }).catch(function () {}); }
  function onRCtl(r, c) {
    if (r.ctlSeen === null) { r.ctlSeen = { mute: c.mute || 0, ask: c.ask || 0, lower: c.lower || 0 }; return; }   // القديم لا يُنفَّذ
    if ((c.mute || 0) > r.ctlSeen.mute) { r.ctlSeen.mute = c.mute; if (r.mic) rToggleMic(r); toast(L("كتمك المضيف", "The host muted you")); }
    if ((c.lower || 0) > r.ctlSeen.lower) { r.ctlSeen.lower = c.lower; if (r.hand) rToggleHand(r); }
    if ((c.ask || 0) > r.ctlSeen.ask) { r.ctlSeen.ask = c.ask; if (!r.mic) { r.askUnmute = true; rPaintBanners(r); } }
  }

  // ---------- أفعال المضيف ----------
  function rHost(r, fn) { r = r || rm; if (!r || !amHost(r)) { toast(L("للمضيف فقط", "Host only")); return; } fn(r); }
  function rCtl(uid, key) { rHost(null, function (r) { var o = {}; o[key] = TS(); rRef(r, "ctl/" + uid).update(o).catch(function () {}); }); }
  function rMuteAll() { rHost(null, function (r) { Object.keys(r.members).forEach(function (u) { if (u !== myUid() && r.members[u].mic !== false) rCtl(u, "mute"); }); toast(L("كُتم الجميع", "Everyone muted")); }); }
  function rLowerAll() { rHost(null, function (r) { Object.keys(r.members).forEach(function (u) { if (r.members[u].hand) { if (u === myUid()) rToggleHand(r); else rCtl(u, "lower"); } }); }); }
  function rAdmit(uid, yes) { rHost(null, function (r) { rRef(r, "adm/" + uid).set(!!yes).catch(function () {}); rRef(r, "req/" + uid).remove().catch(function () {}); }); }
  function rRemove(uid) { rHost(null, function (r) { rRef(r, "kick/" + uid).set(true).then(function () { return rRef(r, "members/" + uid).remove(); }).catch(function (e) { log("kick", e && e.message); }); toast(L("أُزيل ", "Removed ") + rName(r, uid)); }); }
  function rMakeHost(uid) { rHost(null, function (r) { rRef(r, "meta/host").set(uid).catch(function () {}); toast(L("انتقلت الاستضافة إلى ", "Host is now ") + rName(r, uid)); }); }
  function rSetMeta(k, v) { rHost(null, function (r) { rRef(r, "meta/" + k).set(v).catch(function (e) { log("meta", e && e.message); }); }); }
  function rEndAll() { rHost(null, function (r) { rRef(r, "meta/ended").set(true).catch(function () {}); }); }

  // ---------- المغادرة ----------
  var R_END = { full: ["الغرفة ممتلئة (٨ أشخاص حاليّاً)", "The room is full"], kicked: ["أخرجك المضيف من الغرفة", "The host removed you"], denied: ["لم يسمح لك المضيف بالدخول", "The host didn't let you in"],
                ended: ["أنهى المضيف الغرفة", "The host ended the room"], timeup: ["انتهى وقت الغرفة", "Room time is up"] };
  function rLeave(r, reason, opts) {
    r = r || rm; if (!r) return;
    if (r.done) { if (rm === r) rm = null; return; }
    opts = opts || {}; r.done = true;
    var me = myUid(), ref = r.ref, wasHost = amHost(r), members = r.members, meta = r.meta;
    for (var k in r.timers) { clearTimeout(r.timers[k]); clearInterval(r.timers[k]); } r.timers = {};
    if (r.tick) clearInterval(r.tick); r.tick = null;
    r.offs.forEach(function (f) { f(); }); r.offs = [];
    Object.keys(r.peers).forEach(function (u) { try { r.peers[u].pc.close(); } catch (e) {} });
    stopStream(r.local); try { if (r.camTrack) r.camTrack.stop(); } catch (e) {}
    stopTone(); wakeOff();
    if (ref && me) {
      try { ref.child("members/" + me).onDisconnect().cancel(); ref.child("sig/" + me).onDisconnect().cancel(); ref.child("req/" + me).onDisconnect().cancel(); } catch (e) {}
      if (r.state === "waiting") ref.child("req/" + me).remove().catch(function () {});
      if (r.live && reason !== "kicked") {
        var others = Object.keys(members || {}).filter(function (u) { return u !== me; }).sort(function (a, b) { return (members[a].ts || 0) - (members[b].ts || 0); });
        var step = Promise.resolve();
        if (wasHost && others.length && reason !== "ended") step = ref.child("meta/host").set(others[0]).catch(function () {});   // الاستضافة لأقدم الحاضرين
        step.then(function () { return ref.child("members/" + me).remove(); }).then(function () { return ref.child("sig/" + me).remove(); }).then(function () {
          // آخر من يغادر (وهو المضيف): يحذف الغرفة — وتبقى «بطاقتها» إن كانت مجدولة لموعدٍ قادم
          if (wasHost && (!others.length || reason === "ended")) {
            var keep = meta && meta.sched && meta.sched > Date.now() - 3600000 && reason !== "ended";
            // C16: البطاقة المحفوظة تحتفظ بمالكها وموعد تنظيفها (القواعد ترفض حذف المالك)
            var card = keep ? { host: meta.owner || me, title: meta.title || "", ts: meta.ts || Date.now(), sched: meta.sched, locked: false, lobby: !!meta.lobby } : null;
            if (card && meta.owner) card.owner = meta.owner;
            if (card && meta.gc) card.gc = meta.gc;
            setTimeout(function () { ref.set(card ? { meta: card } : null).catch(function () {}); }, reason === "ended" ? 2500 : 0);
          }
        }).catch(function () {});
      }
    }
    if (r.live) addLog({ id: "room-" + r.code + "-" + r.sess, name: "🎥 " + (r.title || L("غرفة سوا", "Sawa room")), callType: "video", type: "outgoing",
      time: L("الآن", "Now"), duration: r.joinedAt ? fmt(Math.max(1, Math.round((Date.now() - r.joinedAt) / 1000))) : null, timestamp: Date.now(),
      participants: Object.keys(r.met).map(function (u) { return r.met[u]; }), cloud: true, room: r.code });
    if (rm === r) rm = null;
    log("rend", r.code, reason);
    if (reason === "left" && !opts.text) { rHide(); return; }
    var tx = opts.text || (R_END[reason] && L(R_END[reason][0], R_END[reason][1])) || L("غادرت الغرفة", "You left the room");
    r.state = "ended"; r.endText = tx;
    if (rui.root) { if (rui.min) rMinimize(false); rPaint(r); }
    setTimeout(function () { if (!rm) rHide(); }, 2600);
  }
  function rTick(r) {
    if (r.done) return;
    if (r.meta.endsAt) {
      var left = Math.round((r.meta.endsAt - now()) / 1000);
      if (left <= 300 && !r.warned5) { r.warned5 = true; toast(L("تبقّت ٥ دقائق على نهاية الغرفة", "5 minutes left")); }
      if (left <= 0) { if (amHost(r)) rEndAll(); else if (left < -20) rLeave(r, "timeup"); }
    }
    rPaintHead(r);
  }

  // ---------- الواجهة ----------
  var DARK = "#0f172a", CARD = "#1e293b", LINE = "#334155", MUTED = "#94a3b8", PRI = "#2e7d5b";
  function rb(icon, label, onclick, opts) {
    opts = opts || {};
    var w = el("div", "display:flex;flex-direction:column;align-items:center;gap:4px;min-width:52px;position:relative");
    var b = el("button", "width:50px;height:50px;border-radius:50%;border:0;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:" + (opts.bg || LINE), icon);
    b.setAttribute("aria-label", label); b.onclick = function (ev) { ev.stopPropagation(); onclick(); };
    w.appendChild(b); w.appendChild(el("span", "font:600 10px system-ui;color:#cbd5e1;white-space:nowrap", label));
    if (opts.badge) w.appendChild(el("span", "position:absolute;top:-2px;left:4px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font:800 10px system-ui;display:flex;align-items:center;justify-content:center;padding:0 4px", String(opts.badge)));
    w._b = b; return w;
  }
  function rBuild() {
    if (rui.root) return rui;
    var root = el("div", "position:fixed;inset:0;z-index:2147483000;background:" + DARK + ";color:#fff;display:none;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;direction:rtl;overflow:hidden");
    root.id = "sawa-room";
    var head = el("div", "display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 8px;background:" + CARD);
    var hd = el("div", "flex:1;min-width:0");
    var title = el("div", "font:800 15px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"), sub = el("div", "font:600 11px system-ui;color:" + MUTED);
    hd.appendChild(title); hd.appendChild(sub);
    var hostBtns = el("div", "display:flex;gap:6px");
    var minB = el("button", "background:" + LINE + ";border:0;color:#fff;border-radius:14px;padding:6px 10px;font:700 11px system-ui", L("تصغير ▾", "Minimize ▾"));
    minB.onclick = function () { rMinimize(true); };
    head.appendChild(hd); head.appendChild(hostBtns); head.appendChild(minB);
    var link = el("div", "display:flex;align-items:center;gap:8px;margin:8px 12px 0;padding:8px 10px;border-radius:14px;background:" + CARD + ";border:1px solid " + LINE);
    var linkTx = el("div", "flex:1;min-width:0;font:700 12px system-ui;direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e2e8f0");
    var cp = el("button", "background:" + LINE + ";border:0;color:#fff;border-radius:10px;padding:6px 9px;font:700 11px system-ui", L("نسخ", "Copy"));
    var sh = el("button", "background:" + LINE + ";border:0;color:#fff;border-radius:10px;padding:6px 9px;font:700 11px system-ui", L("مشاركة", "Share"));
    var qr = el("button", "background:" + LINE + ";border:0;color:#fff;border-radius:10px;padding:6px 9px;font:700 11px system-ui", "QR");
    cp.onclick = function () { rCopyLink(); }; sh.onclick = function () { rShareLink(); }; qr.onclick = function () { rShowQr(); };
    link.appendChild(linkTx); link.appendChild(cp); link.appendChild(sh); link.appendChild(qr);
    var banners = el("div", "display:flex;flex-direction:column;gap:6px;margin:6px 12px 0");
    var grid = el("div", "flex:1;min-height:0;display:grid;gap:8px;padding:8px 12px;align-content:center");
    var center = el("div", "flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:0 24px");
    var cIcon = el("div", "width:84px;height:84px;border-radius:50%;background:" + PRI + "33;border:2px solid " + PRI + ";display:flex;align-items:center;justify-content:center;font-size:36px", "🎥");
    var cT = el("div", "font:800 18px system-ui"), cS = el("div", "font:600 13px system-ui;color:" + MUTED);
    center.appendChild(cIcon); center.appendChild(cT); center.appendChild(cS);
    var panel = el("div", "display:none;flex-direction:column;margin:0 12px 6px;border-radius:16px;background:" + CARD + ";border:1px solid " + LINE + ";max-height:45%;min-height:0;overflow:hidden");
    var bar = el("div", "display:flex;justify-content:space-evenly;align-items:flex-start;padding:10px 4px calc(env(safe-area-inset-bottom,0px) + 14px);background:" + CARD);
    var floats = el("div", "position:absolute;inset:0;pointer-events:none;overflow:hidden");
    var audios = el("div", "display:none");
    root.appendChild(head); root.appendChild(link); root.appendChild(banners); root.appendChild(grid); root.appendChild(center); root.appendChild(panel); root.appendChild(bar); root.appendChild(floats); root.appendChild(audios);
    var pill = el("button", "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:2147483001;display:none;align-items:center;gap:8px;background:#4f46e5;color:#fff;border:0;border-radius:22px;padding:9px 16px;font:700 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.35);direction:rtl");
    pill.onclick = function () { rMinimize(false); };
    if (!document.getElementById("sawa-room-css")) {
      var st = document.createElement("style"); st.id = "sawa-room-css";
      st.textContent = "@keyframes sawaRise{0%{transform:translateY(0) scale(.8);opacity:0}15%{opacity:1}100%{transform:translateY(-70vh) scale(1.3);opacity:0}}";
      document.head.appendChild(st);
    }
    document.body.appendChild(root); document.body.appendChild(pill);
    rui = { root: root, title: title, sub: sub, hostBtns: hostBtns, minB: minB, link: link, linkTx: linkTx, banners: banners, grid: grid, center: center, cT: cT, cS: cS, panel: panel, bar: bar, floats: floats, audios: audios, pill: pill, tiles: {}, min: false };
    return rui;
  }
  function rShow(r) { rBuild(); rui.grid.innerHTML = ""; rui.audios.innerHTML = ""; rui.banners.innerHTML = ""; rui.panel.style.display = "none"; rui.tiles = {}; rMinimize(false); rPaint(r); }
  function rHide() { if (!rui.root) return; rui.root.style.display = "none"; rui.pill.style.display = "none"; rui.min = false; rui.grid.innerHTML = ""; rui.audios.innerHTML = ""; rui.tiles = {}; }
  function rMinimize(on) { if (!rui.root) return; rui.min = !!on; rui.root.style.display = on ? "none" : "flex"; rui.pill.style.display = on ? "flex" : "none"; rPaintHead(rm); }
  function rElapsed(r) { return r.joinedAt ? fmt(Math.floor((Date.now() - r.joinedAt) / 1000)) : "0:00"; }
  function rPaintHead(r) {
    if (!r || !rui.root) return;
    var n = Object.keys(r.members).length;
    rui.title.textContent = (r.title || L("غرفة سوا", "Sawa room")) + (r.meta.locked ? " 🔒" : "");
    var t = r.meta.endsAt ? L("باقٍ ", "Left ") + fmt(Math.max(0, Math.round((r.meta.endsAt - now()) / 1000))) : rElapsed(r);
    rui.sub.textContent = r.state === "live" ? t + " · " + n + " " + L("في الغرفة", "in room") + (amHost(r) ? " · " + L("أنت المضيف", "you're host") : "") : "";
    rui.sub.style.color = r.meta.endsAt && r.meta.endsAt - now() < 300000 ? "#ef4444" : MUTED;
    rui.linkTx.textContent = roomLink(r.code).replace(/^https?:\/\//, "");
    if (rui.min) rui.pill.textContent = "🎥 " + (r.title || "") + " · " + n + "  ▴";
  }
  function rPaint(r) {
    if (!rui.root || !r) return;
    rPaintHead(r);
    var center = r.state !== "live";
    rui.center.style.display = center ? "flex" : "none"; rui.grid.style.display = center ? "none" : "grid";
    rui.link.style.display = r.state === "ended" ? "none" : "flex";
    rui.minB.style.visibility = r.state === "ended" ? "hidden" : "visible";
    if (center) {
      rui.cT.textContent = r.state === "ended" ? (r.endText || "") : (r.title || L("غرفة سوا", "Sawa room"));
      rui.cS.textContent = r.state === "waiting" ? L("في غرفة الانتظار — بانتظار أن يسمح لك المضيف…", "In the waiting room — waiting for the host…") : r.state === "ended" ? "" : L("جارٍ الانضمام للغرفة…", "Joining the room…");
    } else rLayout(r);
    // أزرار المضيف أعلى الشاشة
    var hb = rui.hostBtns; hb.innerHTML = "";
    if (r.state === "live" && amHost(r)) {
      var mk = function (txt, on, fn, lab) { var b = el("button", "background:" + (on ? "#ef444433" : LINE) + ";border:1px solid " + (on ? "#ef444466" : LINE) + ";color:#fff;border-radius:10px;width:32px;height:30px;font-size:14px", txt); b.setAttribute("aria-label", lab); b.onclick = fn; hb.appendChild(b); };
      mk("🔒", r.meta.locked, function () { rSetMeta("locked", !r.meta.locked); toast(r.meta.locked ? L("فُتحت الغرفة", "Room unlocked") : L("قُفلت الغرفة — لا دخول جديد", "Room locked")); }, L("قفل", "Lock"));
      mk("🚪", r.meta.lobby, function () { rSetMeta("lobby", !r.meta.lobby); toast(r.meta.lobby ? L("أُلغيت غرفة الانتظار", "Waiting room off") : L("غرفة الانتظار مفعّلة", "Waiting room on")); }, L("غرفة الانتظار", "Waiting room"));
      mk("⏱", !!r.meta.endsAt, function () { rDurationPick(); }, L("مدّة الغرفة", "Duration"));
    }
    rPaintBanners(r);
    var bar = rui.bar; bar.innerHTML = "";
    if (r.state === "ended") return;
    if (r.state !== "live") { var lv = rb("✕", L("إلغاء", "Cancel"), function () { rLeave(r, "left"); }, { bg: "#ef4444" }); bar.appendChild(lv); return; }
    var mic = rb(r.mic ? "🎤" : "🔇", r.mic ? L("كتم", "Mute") : L("الميكروفون", "Unmute"), function () { rToggleMic(r); }, { bg: r.mic ? LINE : "#ef4444" });
    bar.appendChild(mic);
    bar.appendChild(rb(r.camOn ? "📷" : "🚫", r.camOn ? L("الكاميرا", "Camera") : L("الكاميرا", "Camera"), function () { rToggleCam(r); }, { bg: r.camOn ? PRI : LINE }));
    // خمسة أزرار فقط تتّسع لأصغر شاشة — «ارفع يدك» و«تفاعل» في «المزيد» (الزرّ يتلوّن حين تكون يدك مرفوعة)
    bar.appendChild(rb("💬", L("دردشة", "Chat"), function () { rOpenPanel(r.panel === "chat" ? null : "chat"); }, { bg: r.panel === "chat" ? PRI : LINE, badge: r.unread }));
    bar.appendChild(rb(r.hand ? "✋" : "⋯", r.hand ? L("يدك مرفوعة", "Hand up") : L("المزيد", "More"), function () { rMore(); }, { bg: r.hand ? "#f59e0b" : LINE }));
    bar.appendChild(rb("📞", L("مغادرة", "Leave"), function () { rLeaveConfirm(); }, { bg: "#ef4444" }));
    bar.lastChild._b.style.transform = "rotate(135deg)";
  }
  function rPaintBanners(r) {
    if (!rui.root || !r) return;
    var b = rui.banners; b.innerHTML = "";
    if (r.state !== "live") return;
    var box = function (bg, bd) { return el("div", "display:flex;align-items:center;gap:8px;border-radius:12px;padding:7px 10px;background:" + bg + ";border:1px solid " + bd); };
    var btnS = function (t, bg, fn) { var x = el("button", "border:0;border-radius:9px;padding:5px 9px;font:800 11px system-ui;color:#fff;background:" + bg, t); x.onclick = fn; return x; };
    if (amHost(r)) Object.keys(r.reqs || {}).forEach(function (u) {
      var row = box(PRI + "22", PRI + "66");
      row.appendChild(el("span", "flex:1;font:700 12px system-ui", "🚪 " + (nameOf(u) || stranger(r.reqs[u] && r.reqs[u].name)) + " " + L("في الانتظار", "is waiting")));
      row.appendChild(btnS(L("سماح", "Admit"), "#22c55e", function () { rAdmit(u, true); }));
      row.appendChild(btnS(L("رفض", "Deny"), LINE, function () { rAdmit(u, false); }));
      b.appendChild(row);
    });
    var hands = Object.keys(r.members).filter(function (u) { return r.members[u].hand; }).sort(function (a, c) { return r.members[a].hand - r.members[c].hand; });
    if (hands.length) {
      var hr = box("#f59e0b22", "#f59e0b55");
      hr.appendChild(el("span", "flex:1;font:700 12px system-ui;color:#fbbf24", "✋ " + hands.map(function (u) { return rName(r, u); }).join("، ")));
      if (amHost(r)) hr.appendChild(btnS(L("إنزال الكلّ", "Lower all"), "#b45309", rLowerAll));
      b.appendChild(hr);
    }
    if (r.askUnmute && !r.mic) {
      var ar = box("#4f46e522", "#4f46e566");
      ar.appendChild(el("span", "flex:1;font:700 12px system-ui", L("يطلب المضيف أن تفتح الميكروفون", "The host asks you to unmute")));
      ar.appendChild(btnS(L("فتح", "Unmute"), "#4f46e5", function () { rToggleMic(r); }));
      ar.appendChild(btnS("✕", LINE, function () { r.askUnmute = false; rPaintBanners(r); }));
      b.appendChild(ar);
    }
  }
  function rTileEl(uid) {
    var t = rui.tiles[uid]; if (t) return t;
    var box = el("div", "position:relative;border-radius:16px;overflow:hidden;background:" + CARD + ";border:2px solid " + LINE + ";min-height:0;display:flex;align-items:center;justify-content:center;transition:border-color .2s,box-shadow .2s");
    var v = el("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none"); v.autoplay = true; v.playsInline = true; v.muted = true; v.setAttribute("playsinline", "");
    var av = el("div", "width:56px;height:56px;border-radius:50%;background:" + LINE + ";display:flex;align-items:center;justify-content:center;font:800 22px system-ui");
    var lab = el("div", "position:absolute;bottom:6px;right:8px;left:8px;font:700 11px system-ui;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    var tags = el("div", "position:absolute;top:6px;right:6px;left:6px;display:flex;justify-content:space-between;font-size:13px");
    box.appendChild(v); box.appendChild(av); box.appendChild(lab); box.appendChild(tags);
    var a = el("audio", ""); a.autoplay = true; rui.audios.appendChild(a);
    box.onclick = function () { if (uid !== "__me" && rm && amHost(rm)) rHostMenu(uid); };
    t = rui.tiles[uid] = { box: box, v: v, av: av, lab: lab, tags: tags, a: a };
    return t;
  }
  function rTile(r, uid) {
    if (!rui.root || !r || r.done) return;
    var me = myUid(); if (uid === me) uid = "__me";
    var isMe = uid === "__me", m = isMe ? r.members[me] || { mic: r.mic, cam: r.camOn, hand: r.hand } : r.members[uid], p = isMe ? null : r.peers[uid];
    if (!isMe && !m) { var old = rui.tiles[uid]; if (old) { try { old.v.srcObject = null; old.a.srcObject = null; old.box.remove(); old.a.remove(); } catch (e) {} delete rui.tiles[uid]; } rLayout(r); return; }
    var t = rTileEl(uid), name = isMe ? L("أنت", "You") : rName(r, uid);
    var vt = isMe ? (r.camOn ? r.camTrack : null) : p && p.stream.getVideoTracks().filter(function (x) { return x.readyState === "live" && !x.muted; })[0];
    var showV = !!vt && (isMe ? r.camOn : (m.cam && !r.low));
    // C15: الطرف شغّل الكاميرا ولا تصل الصورة ⇒ بعد ٨ ثوانٍ نعيد التفاوض (مرّة) ونقول ذلك بدل صورةٍ رماديّة صامتة
    if (!isMe && p) {
      var wantV = !!(m.cam && !r.low && p.state === "connected");
      if (wantV && !showV && !p.camWait && !p.camRetried) p.camWait = setTimeout(function () {
        p.camWait = null;
        if (r.done || r.peers[uid] !== p) return;
        var still = !p.stream.getVideoTracks().some(function (x) { return x.readyState === "live" && !x.muted; });
        if (still && r.members[uid] && r.members[uid].cam) { p.camRetried = true; log("cam: no frames from", uid, "→ renegotiate"); rNegotiate(r, p, true); rTile(r, uid); }
      }, 8000);
      if (!wantV || showV) { clearTimeout(p.camWait); p.camWait = null; if (!m.cam) p.camRetried = false; }
    }
    if (isMe) { if (showV && (!t.v.srcObject || t.v.srcObject.getVideoTracks()[0] !== vt)) t.v.srcObject = new global.MediaStream([vt]); t.v.style.transform = r.facing === "environment" ? "none" : "scaleX(-1)"; }
    else {
      if (p && t.a.srcObject !== p.stream) { t.a.srcObject = p.stream; try { t.a.play().catch(function () {}); } catch (e) {} }
      if (showV && t.v.srcObject !== p.stream) t.v.srcObject = p.stream;
    }
    if (showV) try { t.v.play().catch(function () {}); } catch (e) {}
    t.v.style.display = showV ? "block" : "none"; t.av.style.display = showV ? "none" : "flex";
    t.av.textContent = (isMe ? (myName() || "أ") : name).charAt(0); t.av.style.background = isMe ? PRI : LINE;
    var st = isMe ? "" : !p ? L("ينضمّ…", "joining…") : p.state === "connected" ? "" : p.state === "lost" ? L("انقطع", "lost") : p.state === "reconnecting" ? L("شبكة ضعيفة…", "weak…") : L("جارٍ الربط…", "connecting…");
    if (!st && !isMe && m.cam && !showV && !r.low) st = L("📷 الصورة لم تصل بعد", "📷 video not arriving");
    t.lab.textContent = name + (st ? " · " + st : "");
    var mic = isMe ? r.mic : m.mic !== false, hostU = r.meta.host === (isMe ? me : uid);
    t.tags.innerHTML = "";
    t.tags.appendChild(el("span", "", (hostU ? "👑 " : "") + ((isMe ? r.hand : m.hand) ? "✋" : "")));
    t.tags.appendChild(el("span", "background:" + (mic ? "#22c55e33" : "#ef444455") + ";border-radius:10px;padding:1px 5px", mic ? "🎤" : "🔇"));
    var speaking = r.speaker === uid && mic;
    t.box.style.borderColor = speaking ? "#22c55e" : isMe ? PRI : LINE;
    t.box.style.boxShadow = speaking ? "0 0 0 3px #22c55e44" : "none";
    t.box.style.cursor = !isMe && amHost(r) ? "pointer" : "default";
    rLayout(r);
  }
  function rLayout(r) {
    if (!rui.root || !r) return;
    var me = myUid();
    var ids = ["__me"].concat(Object.keys(r.members).filter(function (u) { return u !== me; }).sort(function (a, b) { return (r.members[a].ts || 0) - (r.members[b].ts || 0); }));
    if (!rui.tiles.__me) rTileEl("__me");
    ids = ids.filter(function (u) { return rui.tiles[u]; });
    var n = ids.length, cols = n <= 1 ? 1 : n === 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 2 : 3, rows = Math.ceil(n / cols);
    var anyV = Object.keys(r.members).some(function (u) { return r.members[u].cam; }) || r.camOn;
    rui.grid.style.gridTemplateColumns = "repeat(" + cols + ",1fr)";
    rui.grid.style.gridTemplateRows = "repeat(" + rows + "," + (anyV ? "1fr" : "minmax(0,130px)") + ")";
    ids.forEach(function (u) { var t = rui.tiles[u]; if (t.box.parentNode !== rui.grid) rui.grid.appendChild(t.box); });
  }
  function rFloat(e) {
    if (!rui.root || RX.indexOf(e) < 0) return;
    var s = el("span", "position:absolute;bottom:90px;font-size:34px;animation:sawaRise 2.6s ease-out forwards;left:" + (10 + Math.random() * 75) + "%", e);
    rui.floats.appendChild(s); setTimeout(function () { s.remove(); }, 2700);
  }
  // ---------- لوحات منبثقة ----------
  function sheet(titleTx, build) {
    var ov = el("div", "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:system-ui");
    var box = el("div", "background:" + CARD + ";color:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 8px)");
    box.appendChild(el("div", "width:40px;height:4px;border-radius:2px;background:" + LINE + ";margin:10px auto 6px"));
    if (titleTx) box.appendChild(el("div", "padding:2px 16px 8px;font:800 14px system-ui;text-align:center", titleTx));
    var body = el("div", "overflow-y:auto;flex:1;min-height:0"); box.appendChild(body);
    ov.appendChild(box); ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    var close = function () { ov.remove(); };
    build(body, close); document.body.appendChild(ov);
    return close;
  }
  function item(body, icon, label, fn, danger) {
    var b = el("button", "width:100%;display:flex;align-items:center;gap:12px;padding:13px 18px;background:transparent;border:0;border-top:1px solid " + LINE + ";color:" + (danger ? "#f87171" : "#e2e8f0") + ";font:700 13px system-ui;text-align:right");
    b.appendChild(el("span", "font-size:17px;width:22px;text-align:center", icon)); b.appendChild(el("span", "flex:1", label));
    b.onclick = fn; body.appendChild(b); return b;
  }
  function rHostMenu(uid) {
    var r = rm; if (!r) return;
    var m = r.members[uid] || {};
    sheet(rName(r, uid), function (body, close) {
      item(body, "🔇", m.mic !== false ? L("كتم المشارك", "Mute") : L("اطلب فتح الميكروفون", "Ask to unmute"), function () { rCtl(uid, m.mic !== false ? "mute" : "ask"); close(); });
      item(body, "🔇", L("كتم الجميع", "Mute everyone"), function () { rMuteAll(); close(); });
      if (m.hand) item(body, "✋", L("إنزال يده", "Lower hand"), function () { rCtl(uid, "lower"); close(); });
      item(body, "👑", L("اجعله المضيف", "Make host"), function () { rMakeHost(uid); close(); });
      item(body, "✕", L("إخراج من الغرفة", "Remove from room"), function () { rRemove(uid); close(); }, true);
    });
  }
  function rMore() {
    var r = rm; if (!r) return;
    sheet(null, function (body, close) {
      item(body, "✋", r.hand ? L("أنزل يدك", "Lower hand") : L("ارفع يدك", "Raise hand"), function () { close(); rToggleHand(r); });
      item(body, "😊", L("تفاعل", "React"), function () { close(); rReactBar(); });
      item(body, "➕", L("دعوة من جهات الاتّصال", "Invite contacts"), function () { close(); rInvite(); });
      item(body, "📝", L("المحضر: قرارات · مهامّ · نقاط", "Minutes: decisions · tasks · points"), function () { close(); rOpenPanel("notes"); });
      item(body, r.low ? "🎥" : "📶", r.low ? L("إعادة الفيديو", "Video back on") : L("بيانات قليلة (صوتٌ فقط)", "Low data (audio only)"), function () { close(); rToggleLow(r); });
      if (r.camOn) item(body, "🔄", L("تبديل الكاميرا", "Flip camera"), function () { close(); rFlip(r); });
      if (amHost(r)) {
        item(body, "🔇", L("كتم الجميع", "Mute everyone"), function () { close(); rMuteAll(); });
        item(body, "⏹", L("إنهاء الغرفة للجميع", "End room for everyone"), function () { close(); rEndAll(); }, true);
      }
    });
  }
  function rLeaveConfirm() {
    var r = rm; if (!r) return;
    sheet(L("مغادرة الغرفة؟", "Leave the room?"), function (body, close) {
      item(body, "🚪", L("مغادرة", "Leave"), function () { close(); rLeave(r, "left"); }, true);
      if (amHost(r)) item(body, "⏹", L("إنهاء للجميع", "End for everyone"), function () { close(); rEndAll(); }, true);
      item(body, "↩", L("البقاء", "Stay"), close);
    });
  }
  function rDurationPick() {
    sheet(L("مدّة الغرفة", "Room duration"), function (body, close) {
      [[0, L("بلا حدّ", "No limit")], [30, L("٣٠ دقيقة", "30 min")], [60, L("ساعة", "1 hour")], [90, L("ساعة ونصف", "1.5 hours")], [120, L("ساعتان", "2 hours")]].forEach(function (o) {
        item(body, "⏱", o[1], function () { rSetMeta("endsAt", o[0] ? now() + o[0] * 60000 : null); if (rm) rm.warned5 = false; close(); });
      });
    });
  }
  function rReactBar() {
    sheet(null, function (body, close) {
      var row = el("div", "display:flex;justify-content:space-around;padding:14px 10px");
      RX.forEach(function (e) { var b = el("button", "font-size:30px;background:transparent;border:0", e); b.onclick = function () { rReact(e); close(); }; row.appendChild(b); });
      body.appendChild(row);
    });
  }
  function rCopyLink() {
    var r = rm; if (!r) return; var lk = roomLink(r.code);
    try { navigator.clipboard.writeText(lk).then(function () { toast(L("نُسخ رابط الغرفة", "Room link copied")); }, function () { toast(lk); }); } catch (e) { toast(lk); }
  }
  function rShareLink() {
    var r = rm; if (!r) return; var lk = roomLink(r.code);
    if (navigator.share) navigator.share({ title: r.title || "سوا", text: L("انضمّ إلى غرفة سوا «", "Join the Sawa room “") + (r.title || "") + L("»", "”"), url: lk }).catch(function () {});
    else rCopyLink();
  }
  function rShowQr() {
    var r = rm; if (!r) return;
    sheet(L("امسح للانضمام", "Scan to join"), function (body, close) {
      var q = el("div", "width:220px;height:220px;margin:6px auto 10px;background:#fff;border-radius:16px;padding:10px;box-sizing:content-box"); body.appendChild(q);
      body.appendChild(el("div", "text-align:center;font:700 12px system-ui;color:" + MUTED + ";direction:ltr;padding:0 16px 10px", L("الرمز: ", "Code: ") + r.code));
      try { C().qrLib().then(function (Q) { new Q(q, { text: roomLink(r.code), width: 220, height: 220, colorDark: "#1A1A2E", colorLight: "#FFFFFF", correctLevel: Q.CorrectLevel.M }); }).catch(function (e) { q.textContent = (e && e.message) || "QR"; }); } catch (e) {}
      item(body, "📋", L("نسخ الرابط", "Copy link"), function () { rCopyLink(); close(); });
    });
  }
  // دعوة: رسالة في المحادثة الثنائيّة مع كلّ شخص (يصله إشعار) فيها رابط الغرفة
  function rInvite() {
    var r = rm; if (!r) return;
    var me = myUid(), picked = {}, list = [];
    try { list = C().contacts().filter(function (c) { return c.uid && c.uid !== me && !r.members[c.uid]; }); } catch (e) {}
    sheet(L("دعوة إلى الغرفة", "Invite to the room"), function (body, close) {
      if (!list.length) body.appendChild(el("div", "padding:20px;text-align:center;color:" + MUTED + ";font:600 12px system-ui", L("لا أحد آخر في جهات اتّصالك", "No other contacts")));
      list.forEach(function (c) {
        var fam = (c.families || []).map(function (f) { return f.name; }).join("، ");
        var b = item(body, "◻️", (c.name || "") + (fam ? " · " + fam : ""), function () { picked[c.uid] = !picked[c.uid]; b.firstChild.textContent = picked[c.uid] ? "☑️" : "◻️"; });
      });
      var send = el("button", "margin:12px 16px 4px;width:calc(100% - 32px);padding:11px;border:0;border-radius:12px;background:" + PRI + ";color:#fff;font:800 13px system-ui", L("إرسال الدعوة", "Send invite"));
      send.onclick = function () {
        var to = Object.keys(picked).filter(function (u) { return picked[u]; });
        if (!to.length) { toast(L("اختر شخصاً على الأقلّ", "Pick at least one")); return; }
        var text = "🎥 " + L("دعوة إلى غرفة سوا «", "Invite to Sawa room “") + (r.title || "") + L("» — اضغط الرابط للانضمام:\n", "” — tap to join:\n") + roomLink(r.code);
        to.forEach(function (u) { C().openDm(u).then(function (cid) { if (cid) C().send(cid, text); }); });
        toast(L("أُرسلت الدعوة إلى ", "Invited ") + to.length); close();
      };
      body.appendChild(send);
    });
  }
  // ---------- الدردشة والمحضر ----------
  function rOpenPanel(kind) {
    var r = rm; if (!r || !rui.root) return;
    r.panel = kind; if (kind === "chat") r.unread = 0;
    if (kind === "notes" && !r.noteKind) r.noteKind = "decision";
    rui.panel.style.display = kind ? "flex" : "none";
    rPaintChat(r); rPaint(r);
  }
  function rPaintChat(r) {
    if (!rui.root || !r || !r.panel) return;
    var P = rui.panel; P.innerHTML = "";
    var notes = r.panel === "notes";
    var head = el("div", "display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid " + LINE);
    [["chat", L("دردشة", "Chat")], ["notes", L("المحضر", "Minutes")]].forEach(function (x) {
      var b = el("button", "border:1px solid " + LINE + ";border-radius:9px;padding:5px 10px;font:800 11px system-ui;color:#fff;background:" + (r.panel === x[0] ? PRI : "transparent"), x[1]);
      b.onclick = function () { rOpenPanel(x[0]); }; head.appendChild(b);
    });
    head.appendChild(el("div", "flex:1"));
    if (notes) {
      var sm = el("button", "border:0;border-radius:9px;padding:5px 9px;font:800 11px system-ui;color:#fff;background:#4f46e5", L("ملخّص ↗", "Summary ↗"));
      sm.onclick = rSummary; head.appendChild(sm);
    }
    var x = el("button", "border:0;background:transparent;color:" + MUTED + ";font-size:16px", "✕"); x.onclick = function () { rOpenPanel(null); }; head.appendChild(x);
    P.appendChild(head);
    var listEl = el("div", "flex:1;min-height:60px;overflow-y:auto;padding:6px 10px");
    var items = notes ? r.chat.filter(function (m) { return m.kind; }) : r.chat;
    if (!items.length) listEl.appendChild(el("div", "text-align:center;color:#64748b;font:600 12px system-ui;padding:14px", notes ? L("سجّل القرارات والمهامّ والنقاط هنا — تُرسَل لاحقاً إلى مجموعة", "Record decisions, tasks and points — send them to a group later") : L("لا رسائل بعد", "No messages yet")));
    items.forEach(function (m) {
      var row = el("div", "padding:4px 0");
      var nm = el("div", "font:700 10px system-ui;color:" + MUTED, (m.kind ? NOTE[m.kind][0] + " " + L(NOTE[m.kind][1], NOTE[m.kind][2]) + " · " : "") + (m.from === myUid() ? L("أنت", "You") : m.name));
      row.appendChild(nm); row.appendChild(el("div", "font:500 13px system-ui;color:#fff;white-space:pre-wrap;word-break:break-word", m.text));
      listEl.appendChild(row);
    });
    P.appendChild(listEl);
    if (notes) {
      var kinds = el("div", "display:flex;gap:6px;padding:4px 10px");
      ["decision", "task", "point"].forEach(function (k) {
        var on = r.noteKind === k, b = el("button", "border:1px solid " + (on ? NOTE[k][3] : LINE) + ";border-radius:9px;padding:4px 8px;font:800 11px system-ui;color:" + (on ? NOTE[k][3] : MUTED) + ";background:" + (on ? NOTE[k][3] + "22" : "transparent"), NOTE[k][0] + " " + L(NOTE[k][1], NOTE[k][2]));
        b.onclick = function () { r.noteKind = k; rPaintChat(r); }; kinds.appendChild(b);
      });
      P.appendChild(kinds);
    }
    var row = el("div", "display:flex;gap:6px;padding:6px 10px 10px");
    var inp = el("input", "flex:1;min-width:0;border:1px solid " + LINE + ";background:" + DARK + ";color:#fff;border-radius:10px;padding:8px 10px;font:500 13px system-ui");
    inp.placeholder = notes ? L("اكتب ", "Write a ") + L(NOTE[r.noteKind][1], NOTE[r.noteKind][2]) + "…" : L("اكتب رسالة…", "Message…");
    inp.dir = "auto";
    var go = el("button", "border:0;border-radius:10px;padding:0 14px;background:" + PRI + ";color:#fff;font:800 13px system-ui", L("إرسال", "Send"));
    var fire = function () { rSendChat(r, inp.value, notes ? r.noteKind : null); inp.value = ""; };
    go.onclick = fire; inp.onkeydown = function (e) { if (e.key === "Enter") fire(); };
    row.appendChild(inp); row.appendChild(go); P.appendChild(row);
    listEl.scrollTop = 1e6;
  }
  function rSummaryText(r) {
    var ns = r.chat.filter(function (m) { return m.kind; });
    var out = L("محضر: ", "Minutes: ") + (r.title || L("غرفة سوا", "Sawa room")) + "\n" + new Date().toLocaleString(isAr() ? "ar" : "en") + "\n";
    out += L("الحضور: ", "Present: ") + [myName() || L("أنا", "me")].concat(Object.keys(r.met).map(function (u) { return r.met[u]; })).join("، ") + "\n\n";
    ["decision", "task", "point"].forEach(function (k) {
      var it = ns.filter(function (m) { return m.kind === k; }); if (!it.length) return;
      out += NOTE[k][0] + " " + L(NOTE[k][1], NOTE[k][2]) + " (" + it.length + "):\n";
      it.forEach(function (m, i) { out += "  " + (i + 1) + ". " + m.text + " — " + (m.from === myUid() ? (myName() || "") : m.name) + "\n"; });
      out += "\n";
    });
    if (!ns.length) out += L("لم يُسجَّل شيء.\n", "Nothing recorded.\n");
    return out;
  }
  function rSummary() {
    var r = rm; if (!r) return;
    var text = rSummaryText(r), tasks = r.chat.filter(function (m) { return m.kind === "task"; });
    var groups = [];
    try { var ch = C()._chats(); groups = Object.keys(ch).map(function (k) { return ch[k]; }).filter(function (c) { return c && (c.type === "group" || c.type === "family") && !c.deleted; }); } catch (e) {}
    sheet(L("ملخّص الغرفة", "Room summary"), function (body, close) {
      body.appendChild(el("pre", "margin:0 14px 8px;padding:10px;border-radius:12px;background:" + DARK + ";color:#e2e8f0;font:500 12px system-ui;white-space:pre-wrap;max-height:30vh;overflow:auto;direction:rtl;text-align:right", text));
      item(body, "⬇️", L("تنزيل ملفّ نصّيّ", "Download text file"), function () {
        try { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = L("محضر-", "minutes-") + r.code + ".txt"; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
        close();
      });
      if (!groups.length) body.appendChild(el("div", "padding:12px 18px;color:" + MUTED + ";font:600 12px system-ui", L("لا مجموعات لديك لإرسال المحضر إليها", "You have no groups to send to")));
      groups.forEach(function (g) {
        item(body, "📤", L("إرسال إلى «", "Send to “") + (g.name || "") + L("»", "”") + (tasks.length ? L(" (+ قائمة مهامّ)", " (+ task list)") : ""), function () {
          C().send(g.cid, text);
          if (tasks.length) C().sendTasks(g.cid, L("مهامّ: ", "Tasks: ") + (r.title || ""), tasks.map(function (t, i) { return { id: "t" + i + rid(4), text: t.text, assigneeName: "", dueAt: null }; }));
          toast(L("أُرسل المحضر إلى ", "Sent to ") + (g.name || "")); close();
        });
      });
    });
  }
  // نافذة «انضمام برمز»
  function roomJoinPrompt() {
    if (!enabled()) return false;
    sheet(L("انضمام إلى غرفة", "Join a room"), function (body, close) {
      var inp = el("input", "display:block;margin:6px 16px 10px;width:calc(100% - 32px);box-sizing:border-box;border:1px solid " + LINE + ";background:" + DARK + ";color:#fff;border-radius:12px;padding:11px;font:800 16px system-ui;letter-spacing:3px;text-align:center;direction:ltr");
      inp.placeholder = "ABCD2345"; inp.setAttribute("autocapitalize", "characters");
      body.appendChild(el("div", "padding:0 16px;color:" + MUTED + ";font:600 12px system-ui;text-align:center", L("الصق رابط الغرفة أو اكتب رمزها (٨ حروف)", "Paste the room link or type its 8-letter code")));
      body.appendChild(inp);
      var go = el("button", "margin:0 16px 8px;width:calc(100% - 32px);padding:11px;border:0;border-radius:12px;background:" + PRI + ";color:#fff;font:800 13px system-ui", L("انضمام", "Join"));
      go.onclick = function () { var c = cleanCode(inp.value); if (!c) { toast(L("رمز الغرفة غير صحيح", "Invalid room code")); return; } close(); roomJoin(c); };
      body.appendChild(go);
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
    });
    return true;
  }
  function handleRoomParam() {
    var c = null;
    try { c = new URLSearchParams(global.location.search).get("room"); } catch (e) {}
    if (!c) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("room"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenUid(function () { setTimeout(function () { roomPrejoin(c); }, 400); });
  }
  // C14: رابط الغرفة أو إشعارها لا يُدخلك وحده — شاشة «انضمام؟» والميكروفون مكتوم افتراضيّاً
  function roomPrejoin(code) {
    code = cleanCode(code);
    if (!code) { toast(L("رمز الغرفة غير صحيح", "Invalid room code")); return; }
    if (rm && rm.code === code) { if (rui.min) rMinimize(false); return; }
    var ov = el("div", "position:fixed;inset:0;z-index:2147483003;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui");
    ov.dir = isAr() ? "rtl" : "ltr";
    var box = el("div", "background:#fff;color:#1A1A2E;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:18px 16px calc(env(safe-area-inset-bottom,0px) + 18px);box-sizing:border-box;text-align:center");
    ov.appendChild(box); document.body.appendChild(ov);
    var close = function () { try { ov.remove(); } catch (e) {} };
    ov.onclick = function (e) { if (e.target === ov) close(); };
    box.appendChild(el("div", "font-size:34px", "🎙️"));
    var tt = el("div", "font:800 17px system-ui;margin:4px 0 2px", L("غرفة سوا", "Sawa room")); box.appendChild(tt);
    var sub = el("div", "font:600 12.5px system-ui;color:#8796a5", "…"); box.appendChild(sub);
    var mic = false;
    var mb = el("button", "margin:14px auto 4px;display:block;padding:10px 16px;border-radius:12px;border:1.5px solid #dfe5ec;background:#fff;font:800 13px system-ui;color:#1A1A2E");
    var paintMic = function () { mb.textContent = mic ? L("🎤 الميكروفون: يعمل عند الدخول", "🎤 Mic: on when joining") : L("🔇 الميكروفون: مكتوم عند الدخول", "🔇 Mic: muted when joining"); };
    mb.onclick = function () { mic = !mic; paintMic(); }; paintMic(); box.appendChild(mb);
    var go = el("button", "margin:10px 0 0;width:100%;padding:13px;border:0;border-radius:12px;background:" + PRI + ";color:#fff;font:800 14px system-ui", L("انضمام", "Join"));
    var no = el("button", "margin:8px 0 0;width:100%;padding:12px;border:1.5px solid #dfe5ec;border-radius:12px;background:#fff;color:#1A1A2E;font:800 14px system-ui", L("ليس الآن", "Not now"));
    go.onclick = function () { close(); roomJoin(code, { mic: mic }); };
    no.onclick = close;
    box.appendChild(go); box.appendChild(no);
    try {
      db().ref("rooms/" + code + "/meta").once("value").then(function (s) {
        var m = s.val();
        if (!m || m.ended) { sub.textContent = L("الغرفة غير موجودة أو انتهت", "This room doesn't exist or has ended"); go.disabled = true; go.style.opacity = ".5"; return; }
        tt.textContent = m.title || L("غرفة سوا", "Sawa room");
        var hn = nameOf(m.host);
        sub.textContent = (hn ? L("المضيف: ", "Host: ") + hn : L("المضيف ليس في جهات اتّصالك", "The host isn't in your contacts")) + (m.lobby ? L(" · بموافقة المضيف", " · host approval") : "");
      }).catch(function () { sub.textContent = ""; });
    } catch (e) {}
  }

  // ---------- من الإشعار ----------
  function handleCallParam() {
    var id = null;
    try { id = new URLSearchParams(global.location.search).get("call"); } catch (e) {}
    if (!id) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("call"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenUid(function () { setTimeout(function () { if (/^[gs]/.test(id)) groupIncoming(id); else incoming(id); }, 300); });
  }
  try {
    if (global.navigator && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (ev) {
      var m = ev.data || {};
      if ((m.type === "sawa-open" || m.type === "sawa-push") && m.data && m.data.t === "call" && m.data.call)
        whenUid(function () { if (m.data.gid) groupIncoming(m.data.gid, { from: m.data.from, fromName: m.data.fromName }); else incoming(m.data.call); });
      if (m.type === "sawa-push" && m.data && m.data.t === "sched") schedRefresh(true);
      if (m.type === "sawa-open" && m.data && m.data.room) whenUid(function () { roomPrejoin(m.data.room); });
    });
  } catch (e) {}

  // ---------- الإقلاع ----------
  var uidWaiters = [], lastUid = null;
  function whenUid(f) { if (myUid() && db()) f(); else uidWaiters.push(f); }
  function boot() {
    handleCallParam(); handleRoomParam();
    setInterval(function () {
      var u = myUid();
      if (u && u !== lastUid && db()) {
        lastUid = u; watchInbox(u); schedRefresh(true);
        var w = uidWaiters; uidWaiters = []; w.forEach(function (f) { try { f(); } catch (e) {} });
      }
    }, 700);
  }

  global.SawaRTC = {
    version: VERSION, supported: supported, enabled: enabled, bindApp: bindApp,
    call: startCall, accept: accept, decline: decline, hangup: hangup,
    active: function () { return cur ? { id: cur.id, peer: cur.peer, name: cur.name, type: cur.type, state: cur.state, role: cur.role, route: cur.route || null, out: cur.out || null, routes: !!cur.routes } : null; },
    _cur: function () { return cur; }, _incoming: incoming, _dev: devId,
    _restart: function () { if (cur && cur.pc) { cur.state = "reconnecting"; iceRestart(cur); } },
    // C7: الجماعيّة
    groupCall: function (cid, type, o) { return groupStart({ cid: cid, vc: !!(o && o.vc) }, o && o.vc ? "audio" : type); },   // C24: o.vc = دردشة صوتيّة بلا رنين
    groupWith: function (uids, type, title) { return groupStart({ to: uids }, type, title); },
    groupAccept: groupAccept, groupDecline: groupDecline, groupLeave: groupLeave, admit: gAdmit, addToGroup: gAdd, watchChat: watchChat,
    group: function () { var g = gc; return g ? { gid: g.gid, type: g.type, vc: !!g.vc, state: g.state, role: g.role, title: g.title, members: Object.keys(g.members || {}),
      peers: Object.keys(g.peers).map(function (u) { return { uid: u, state: g.peers[u].state }; }) } : null; },
    // C7: المجدولة
    schedRefresh: schedRefresh, schedSave: schedSave, schedRemove: schedRemove, schedStart: schedStart,
    // C8: الغرف
    roomCreate: roomCreate, roomJoin: roomJoin, prejoin: roomPrejoin, roomJoinPrompt: roomJoinPrompt, roomLink: roomLink, newRoomCode: newCode, roomLeave: function () { if (rm) rLeave(rm, "left"); },
    room: function () { var r = rm; return r ? { code: r.code, state: r.state, host: r.meta.host, title: r.title, members: Object.keys(r.members), mic: r.mic, cam: r.camOn, hand: !!r.hand, low: r.low,
      locked: !!r.meta.locked, lobby: !!r.meta.lobby, chat: r.chat.length, speaker: r.speaker, peers: Object.keys(r.peers).map(function (u) { return { uid: u, state: r.peers[u].state }; }) } : null; },
    _rm: function () { return rm; }, _r: { prejoin: roomPrejoin, toggleMic: rToggleMic, toggleCam: rToggleCam, hand: rToggleHand, low: rToggleLow, chat: rSendChat, react: rReact, admit: rAdmit, remove: rRemove,
      makeHost: rMakeHost, ctl: rCtl, muteAll: rMuteAll, lowerAll: rLowerAll, meta: rSetMeta, endAll: rEndAll, summary: rSummaryText, panel: rOpenPanel },
    _gc: function () { return gc; }, _pick: pickPerson, _gIncoming: groupIncoming
  };
  try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedRefresh(false); }); } catch (e) {}
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
