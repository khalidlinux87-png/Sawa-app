// اختبار دخانٍ للواجهة في Chromium (Playwright المثبّت في البيئة):
// يقدّم المستودع محلّياً · React وFirebase من node_modules بدل الـCDN (قد يكون محجوباً) · يتخطّى شاشات البداية ·
// يفتح «المكالمات» و«الاتّصال بالرمز» ويضغط «اتصال» ⇒ يجب أن تظهر رسالة الخطأ بلا أيّ استثناء في الصفحة.
// الاستعمال: node .claude/tools/smoke.js        (رمز الخروج ≠ 0 عند الفشل)
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("playwright غير متاح في هذه البيئة"); process.exit(2); }
const ROOT = path.resolve(__dirname, "../.."), NM = path.join(__dirname, "node_modules");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const cdn = (u) => {
  let m;
  if ((m = u.match(/unpkg\.com\/(react(?:-dom)?)@[\d.]+\/umd\/(.+)$/))) return path.join(NM, m[1], "umd", m[2]);
  if ((m = u.match(/gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/))) return path.join(NM, "firebase", m[1]);
  return null;
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(ROOT, u === "/" ? "index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(res);
});
const fail = (msg) => { console.error("✗ " + msg); process.exitCode = 1; };
server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    // CDN ⇒ node_modules · كلّ اتّصالٍ خارجيّ آخر (Firebase الحيّ…) يُقطع: الاختبار لا يلمس بيانات حقيقيّة
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = cdn(r.request().url()); return f && fs.existsSync(f) ? r.fulfill({ path: f, contentType: "application/javascript" }) : r.abort(); });
    await ctx.addInitScript(() => { try { localStorage.setItem("sawa_onboarded", String(Date.now())); localStorage.setItem("sawaLang", "en"); } catch (e) {} });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.SawaApp, null, { timeout: 30000 }).catch(() => fail("التطبيق لم يقلع (window.SawaApp غير موجود)"));
    await page.waitForTimeout(1500);
    // يضغط زرّاً بنصّه أو باسمه (أزرار الأيقونات: الاسم في aria-label)
    const click = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.innerText.trim()) || r.test((x.getAttribute("aria-label") || "").trim())); if (b) b.click(); return !!b; }, re);
    if (!(await click("(^|\\n)Calls$"))) fail("تبويب «Calls» غير موجود");
    await page.waitForTimeout(800);
    if (!(await click("^Call by code$"))) fail("«Call by code» غير موجود");
    await page.waitForTimeout(500);
    await page.evaluate(() => { if (window.SawaChat) window.SawaChat.findSheet = undefined; });   // يفرض مسار رسالة الخطأ
    for (const d of "1234567890") await click("^" + d + "$");
    await click("^Call$");
    await page.waitForTimeout(1200);
    const body = await page.evaluate(() => document.body.innerText);
    if (!/Couldn't start the call/.test(body)) fail("رسالة «Couldn't start the call» لم تظهر");
    if (errors.length) fail("استثناءات في الصفحة:\n  " + errors.join("\n  "));
    if (!process.exitCode) console.log("✓ smoke OK — boots, Calls tab, dial-pad fallback, no page errors");
  } finally { await browser.close(); server.close(); }
});
