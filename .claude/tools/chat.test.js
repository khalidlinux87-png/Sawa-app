// C204 — اختبار المحادثات في Chromium (المتصفّح فقط، بلا خادم):
//   ١) الفقاعة: كلّ فقرة تحاذي بدايتها هي (إنجليزيّة في واجهةٍ عربيّة والعكس، ورسالةٌ مختلطة) — بالعربيّة والإنجليزيّة
//   ٢) «معلومات المحادثة»: معرض الوسائط والملفّات (الملفّ باسمه ويُفتح)
//   ٣) عارض الصورة: كاملةً بلا قصّ، وبملء الشاشة
//   ٤) «معلومات المجموعة»: الضغط على عضوٍ يفتح محادثةً خاصّة معه، والمعرض ظاهر
// الاستعمال: node .claude/tools/chat.test.js
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("playwright غير متاح"); process.exit(2); }
const ROOT = path.resolve(__dirname, "../.."), NM = path.join(__dirname, "node_modules");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
const cdn = (u) => { let m;
  if ((m = u.match(/unpkg\.com\/(react(?:-dom)?)@[\d.]+\/umd\/(.+)$/))) return path.join(NM, m[1], "umd", m[2]);
  if ((m = u.match(/gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/))) return path.join(NM, "firebase", m[1]);
  return null; };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(ROOT, u === "/" ? "index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(res);
});
let pass = 0, failN = 0;
const check = (ok, name, extra) => { if (ok) pass++; else { failN++; console.error("✗ " + name + (extra !== undefined ? "  ⇒ " + JSON.stringify(extra) : "")); } };
// صورةٌ مستطيلة 2:1 (PNG صغير مولَّد) لاختبار «بلا قصّ»
const WIDE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEIGBkBAA8JAf8Rh2k8AAAAAElFTkSuQmCC";
const T0 = Date.now();
const MSGS = [
  { id: "m1", senderUserId: "peer", type: "text", text: "Hello! This is a fairly long English message that should wrap onto several lines inside the bubble without breaking awkwardly.", createdAt: T0 - 60000 },
  { id: "m2", senderUserId: "me", type: "text", text: "مرحباً، هذه رسالة عربيّة طويلة بما يكفي لتلتفّ على عدّة أسطر داخل الفقاعة، وفيها كلمة English في الوسط.", createdAt: T0 - 50000 },
  { id: "m3", senderUserId: "me", type: "text", text: "Meeting at 5pm in Khartoum, ok?\nالاجتماع الساعة الخامسة مساءً في الخرطوم إن شاء الله تعالى.", createdAt: T0 - 40000 },
  { id: "m5", senderUserId: "peer", type: "file", text: "", fileName: "تقرير-الأسرة.pdf", fileSize: 245760, fileUrl: "data:application/pdf;base64,JVBERi0xLjQK", mime: "application/pdf", createdAt: T0 - 20000 },
  { id: "m6", senderUserId: "peer", type: "image", text: "", fileUrl: WIDE_PNG, createdAt: T0 - 10000 },
];

async function bubbles(browser, base, lang) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = cdn(r.request().url()); return f && fs.existsSync(f) ? r.fulfill({ path: f, contentType: "application/javascript" }) : r.abort(); });
  await ctx.addInitScript(([ms, lg, photo]) => { try { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", "1");
    localStorage.setItem("sawa_onboarded", String(Date.now())); localStorage.setItem("sawaLang", lg);
    localStorage.setItem("sawa:conversations", JSON.stringify([{ id: "c-1", name: "سلمى", photo, lastMessage: "", lastTime: Date.now(), unread: 0 }]));
    localStorage.setItem("sawa:messages", JSON.stringify({ "c-1": ms })); } catch (e) {} }, [MSGS, lang, WIDE_PNG]);
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "load" }); await page.waitForFunction(() => !!window.SawaApp, null, { timeout: 30000 }); await page.waitForTimeout(1300);
  await page.evaluate(() => { const x = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "×" || /إغلاق|Close/.test(b.getAttribute("aria-label") || "")); if (x) x.click(); });
  await page.waitForTimeout(400);
  const at = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.trim() === "سلمى") break; if (!n) return null; const r = n.parentElement.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (at) await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const find = (needle) => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.includes(needle)) return n; return null; };
    const lines = (node, from, to) => { const rg = document.createRange(); rg.setStart(node, from || 0); rg.setEnd(node, to == null ? node.nodeValue.length : to); const by = {};
      [...rg.getClientRects()].filter((x) => x.width > 2).forEach((x) => { const k = Math.round(x.top); (by[k] = by[k] || []).push(x); });
      return Object.keys(by).map(Number).sort((a, b) => a - b).map((k) => ({ l: Math.round(Math.min(...by[k].map((x) => x.left))), r: Math.round(Math.max(...by[k].map((x) => x.right))) })); };
    const en = find("Hello! This"), ar = find("مرحباً، هذه"), mx = find("Meeting at");
    if (!en || !ar || !mx) return null;
    const cut = mx.nodeValue.indexOf("\n");
    return { en: lines(en), ar: lines(ar), mxEn: lines(mx, 0, cut), mxAr: lines(mx, cut + 1) };
  });
  const same = (a, k) => a && a.length > 1 && a.every((x) => Math.abs(x[k] - a[0][k]) <= 2);
  check(!!r, "[" + lang + "] الرسائل ظاهرة");
  if (r) {
    check(same(r.en, "l"), "[" + lang + "] الإنجليزيّة الملتفّة: كلّ أسطرها تبدأ من اليسار", r.en);
    check(same(r.ar, "r"), "[" + lang + "] العربيّة الملتفّة: كلّ أسطرها تبدأ من اليمين", r.ar);
    check(r.mxAr.length >= 1 && r.mxEn.length >= 1 && r.mxAr[0].r - r.mxEn[0].r > 20 && r.mxEn[0].l < r.mxAr[r.mxAr.length - 1].l, "[" + lang + "] المختلطة: الفقرة الإنجليزيّة يساراً والعربيّة يميناً", r);
  }
  return { ctx, page, errors };
}

server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const en = await bubbles(browser, base, "en"); await en.ctx.close();
    const { ctx, page, errors } = await bubbles(browser, base, "ar");
    const click = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((x) => r.test((x.innerText || "").trim()) || r.test((x.getAttribute("aria-label") || "").trim())); if (b) b.click(); return !!b; }, re);
    // ── ٢) معلومات المحادثة: المعرض ──
    await page.evaluate(() => { const h = [...document.querySelectorAll("h1")].find((x) => (x.innerText || "").trim() === "سلمى"); if (h) h.click(); });
    await page.waitForTimeout(800);
    const gal = await page.evaluate(() => { const g = document.querySelector("[data-media-gallery]"); return g ? g.innerText : null; });
    check(!!gal && /صور وفيديو \(1\)/.test(gal) && /ملفّات \(1\)/.test(gal), "المعرض: صورة واحدة وملفّ واحد", gal);
    await click("^ملفّات");
    await page.waitForTimeout(300);
    const files = await page.evaluate(() => document.querySelector("[data-media-gallery]").innerText);
    check(/تقرير-الأسرة\.pdf/.test(files) && /240 KB/.test(files), "الملفّ باسمه وحجمه (كان الاسم فارغاً)", files);
    check(await click("تقرير-الأسرة"), "صفّ الملفّ قابلٌ للضغط («فتح»)");
    await page.waitForTimeout(400);
    const preview = await page.evaluate(() => !!document.querySelector("iframe[title='تقرير-الأسرة.pdf']"));
    check(preview, "الملفّ يُفتح في المعاينة داخل سوا");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    // ── ٣) عارض الصورة: الصورة المستطيلة كاملة ──
    check(await click("^الصورة$"), "صورة الطرف الآخر قابلةٌ للضغط");
    await page.waitForTimeout(500);
    const pv = await page.evaluate(() => { const d = document.querySelector("[data-photo-viewer]"); if (!d) return null; const img = d.querySelector("img"); const r = img.getBoundingClientRect(), dr = d.getBoundingClientRect();
      return { state: d.getAttribute("data-photo-viewer"), ratio: +(r.width / r.height).toFixed(2), fit: getComputedStyle(img).objectFit, full: dr.width >= innerWidth - 1 && dr.height >= innerHeight - 1, title: d.innerText.slice(0, 40) }; });
    check(pv && pv.full && pv.fit === "contain" && Math.abs(pv.ratio - 2) < 0.05, "العارض بملء الشاشة والصورة كاملة 2:1 بلا قصّ", pv);
    check(pv && /سلمى/.test(pv.title) && pv.state !== "loading", "العارض: الاسم ظاهر وحالة الدقّة محسومة", pv);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    check(!(await page.evaluate(() => !!document.querySelector("[data-photo-viewer]"))), "Esc يغلق العارض");
    // ── ٤) معلومات المجموعة: مراسلة عضوٍ على الخاصّ + المعرض ──
    const gi = await page.evaluate(([ms, photo]) => new Promise((resolve) => {
      const calls = []; window.__sawaFamContact = (uid, name, kind) => calls.push([uid, name, kind]);
      const host = document.createElement("div"); host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;display:flex"; document.body.appendChild(host);
      const group = { id: "grp_t", name: "الأسرة", cloud: true, members: [{ id: "me", uid: "me", name: "أنا", role: "admin" }, { id: "u2", uid: "u2", name: "هدى", photo: photo }] };
      const theme = { isDark: false, colors: Object.assign({}, lightColors, { primary: "#2774BA", primaryDark: "#1E3A63", primaryInk: "#1E3A63", primaryLight: "#E3EEF8", btnFill: "#E7ECF2" }) };
      const el = React.createElement(ThemeContext.Provider, { value: theme }, React.createElement(ToastProvider, null, React.createElement(GroupInfoScreen, { group, myUserId: "me", messages: ms, onMessageMember: (m) => window.__sawaFamContact(m.uid, m.name, "msg"), onRename() {}, onAddMembers() {}, onRemoveMember() {}, onToggleAdmin() {}, onLeave() {}, onBack() {} })));
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null; if (root) root.render(el); else ReactDOM.render(el, host);
      setTimeout(() => {
        const b = host.querySelector("[data-member-dm='u2']"); if (b) b.click();
        const meBtn = host.querySelector("[data-member-dm='me']");
        // C272: صورة العضو تُفتح كبيرةً
        const pb = [...host.querySelectorAll("button")].find((x) => /هدى/.test(x.getAttribute("aria-label") || "") && !x.hasAttribute("data-member-dm"));
        if (pb) pb.click();
        setTimeout(() => {
          const pv = document.querySelector("[data-photo-viewer]"), r = pv && pv.getBoundingClientRect();
          const hit = r ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
          resolve({ calls, meDisabled: !!(meBtn && meBtn.disabled), gallery: !!host.querySelector("[data-media-gallery]"), photoBtn: !!pb,
            viewer: !!pv, viewerOnTop: !!(pv && hit && pv.contains(hit)), viewerTitle: pv ? pv.innerText.slice(0, 30) : null });
          try { root ? root.unmount() : ReactDOM.unmountComponentAtNode(host); } catch (e) {} host.remove();
        }, 400);
      }, 400);
    }), [MSGS, WIDE_PNG]);
    check(gi.calls.length === 1 && gi.calls[0][0] === "u2" && gi.calls[0][2] === "msg", "الضغط على «هدى» يفتح محادثةً خاصّة معها", gi);
    check(gi.meDisabled && gi.gallery, "لا مراسلة للنفس · المعرض في معلومات المجموعة", gi);
    check(gi.photoBtn && gi.viewer && gi.viewerOnTop, "صورة العضو في معلومات المجموعة تُفتح كبيرةً فوق كلّ شيء", gi);
    check(gi.viewerTitle && /هدى/.test(gi.viewerTitle), "عارض صورة العضو يحمل اسمه", gi);
    if (errors.length) { failN++; console.error("✗ استثناءات في الصفحة:\n  " + errors.join("\n  ")); }
    console.log((failN ? "✗" : "✓") + " chat C204: " + pass + " passed, " + failN + " failed");
    process.exitCode = failN ? 1 : 0;
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});
