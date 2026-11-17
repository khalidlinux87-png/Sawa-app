// C271 — اختبار المتصفّح (بلا خادم ولا بيانات حقيقيّة):
//   ١) طبقة التطبيع العربيّ (arMatch · normalizeArabicName · cleanArabicNameInput) + البحث في قائمة العائلة
//   ٢) الاسم الكامل في واجهة «تركيز» وملفّ القريب: لا «…» ولا قصّ
//   ٣) مواعيد صلة الرحم المرنة: المدّة لكلّ قريب ولكلّ درجة · التأخّر · الخطّة إلى الخادم · التنبيه المحلّيّ
//   ٤) ملفّك أنت لا يُسجَّل «متوفّى»: الدالّة · النموذج · الحارس المركزيّ · إصلاح القديم عند الحفظ
// الاستعمال: node .claude/tools/c271.test.js   (رمز الخروج ≠ 0 عند الفشل)
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("playwright غير متاح في هذه البيئة"); process.exit(2); }
const ROOT = path.resolve(__dirname, "../.."), NM = path.join(__dirname, "node_modules");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
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
let pass = 0, failN = 0;
const SHOTS = process.env.SHOTS || "";   // SHOTS=<مجلّد> ⇒ لقطاتٌ للمراجعة البصريّة
const shot = async (pg, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + ".png") }); } };
const check = (ok, name, extra) => { if (ok) pass++; else { failN++; console.error("✗ " + name + (extra !== undefined ? "  ⇒ " + JSON.stringify(extra) : "")); } };

// عائلةٌ صغيرة: «أنا» باسمٍ طويل بأجياله · والدٌ وجدٌّ (فالنسب يُحسب) · أختٌ «فاطمه» بالهاء · أخٌ «يحيي» · خالةٌ «هناء»
const DAY = 86400000;
const P = (id, n, g, k, prox, extra) => Object.assign({ id, local_name: n, gender: g, kinship: k, proximity: prox, alive: true, favorite: false, locations: [], lastContactDate: Date.now() - DAY, addedAt: Date.now() - 30 * DAY, contacts: null, notes: "", linkedTo: null }, extra || {});
const LONG = "عبد الرحمن بن محمد بن عبد الله بن إبراهيم بن عبد العزيز آل سليمان";
const persons = [
  P("me", LONG, "male", "نفسي", null, { alive: false }),   // بياناتٌ قديمة خاطئة: «نفسي» متوفّى
  P("dad", "محمد", "male", "الوالد", "A***"), P("gdad", "عبد الله", "male", "الجد", "A**", { alive: false }),
  P("sis", "فاطمه", "female", "الأخت", "A**"), P("bro", "يحيي", "male", "الأخ", "A**"), P("aunt", "هناء", "female", "الخالة", "A*"),
];
let rn = 0; const relations = []; const R = (s, t, ty) => relations.push({ id: "r" + (rn++), groupId: "g-1", source: s, target: t, type: ty });
R("gdad", "dad", "parent"); R("dad", "me", "parent"); R("dad", "sis", "parent"); R("dad", "bro", "parent");

server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: "block" });
    await ctx.grantPermissions(["notifications"], { origin: base.replace(/\/$/, "") });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = cdn(r.request().url()); return f && fs.existsSync(f) ? r.fulfill({ path: f, contentType: "application/javascript" }) : r.abort(); });
    await ctx.addInitScript((sd) => {
      try {
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("sawa_onboarded", String(Date.now())); localStorage.setItem("sawaLang", "en");
        localStorage.setItem("sawa:groupPersons", JSON.stringify({ "g-1": sd.persons }));
        localStorage.setItem("sawa:kinshipRelations", JSON.stringify(sd.relations));
      } catch (e) {}
    }, { persons, relations });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.SawaApp, null, { timeout: 30000 });
    await page.waitForTimeout(1200);

    // ── ١) التطبيع ───────────────────────────────────────────────
    const norm = await page.evaluate(() => {
      const yes = [["أحمد", "احمد"], ["احمد", "أحمد"], ["إبراهيم", "ابراهيم"], ["آمنة", "امنه"], ["فاطمة", "فاطمه"], ["فاطمة", "فاطمت"], ["فاطمه", "فاطمة"],
        ["يحيى", "يحيي"], ["مصطفى", "مصطفي"], ["هناء", "هنا"], ["داوود", "داود"], ["رؤوف", "رءوف"], ["مسؤول", "مسئول"], ["عبد الله", "عبدالله"], ["عبدالله", "عبد الله"],
        ["أبو بكر", "ابوبكر"], ["بتول", "بت"], ["أحمـــد", "احمد"], ["مُحَمَّد", "محمد"], ["علی", "علي"], ["محمد بن علي", "علي"], ["عائشة", "عايشه"]];
      const no = [["محمد", "أحمد"], ["سارة", "سامي"]];
      return {
        yes: yes.filter(([h, q]) => !arMatch(h, q)),
        no: no.filter(([h, q]) => arMatch(h, q)),
        empty: arMatch("أي شيء", "  "),
        ident: [normalizeArabicName("أحمد") === normalizeArabicName("احمد"), normalizeArabicName("فاطمة") === normalizeArabicName("فاطمه"), normalizeArabicName("علا") !== normalizeArabicName("علاء"), normalizeArabicName("يحيى") === normalizeArabicName("يحيي"), normalizeArabicName("٣") === "3"],
        clean: cleanArabicNameInput("  أحمـــد‏   محمد "),
        rank: [arMatchRank("محمد علي", "مح"), arMatchRank("علي محمد", "مح"), arMatchRank("سعيد", "مح")],
      };
    });
    check(norm.yes.length === 0, "التطبيع: كلّ الصيغ المتكافئة تتطابق", norm.yes);
    check(norm.no.length === 0, "التطبيع: الأسماء المختلفة لا تتطابق", norm.no);
    check(norm.empty === true, "بحثٌ فارغ يطابق الكلّ");
    check(norm.ident.every(Boolean), "هويّة الاسم: أحمد=احمد · فاطمة=فاطمه · علا≠علاء · يحيى=يحيي · ٣=3", norm.ident);
    check(norm.clean === "أحمد محمد", "تنظيف الإدخال: تطويل · محارف خفيّة · مسافات", norm.clean);
    check(norm.rank[0] === 0 && norm.rank[1] === 0 && norm.rank[2] === 9, "ترتيب نتيجة البحث", norm.rank);

    // ── ٣أ) مواعيد صلة الرحم — الدوالّ ──────────────────────────────
    const kin = await page.evaluate(() => {
      localStorage.removeItem("sawa:kinRemind"); setKinRemindSettings({ on: true, hour: 18, byDegree: {} });
      const old = Date.now() - 2 * 86400000;
      const a = { id: "a", kinship: "الأخ", proximity: "A**", alive: true, lastContactDate: old };
      const r = {
        deg: contactEveryDays(a),
        own: contactEveryDays(Object.assign({}, a, { contactEvery: 2 })),
        overOwn: isContactOverdue(Object.assign({}, a, { contactEvery: 1 })), overDeg: isContactOverdue(a),
        noProx: hasContactSchedule({ kinship: "أخرى", alive: true, contactEvery: 3 }), self: hasContactSchedule({ kinship: "نفسي", alive: true, contactEvery: 3 }), dead: hasContactSchedule({ kinship: "الأخ", proximity: "A**", alive: false }),
        bad: [kinClampDays(0), kinClampDays(366), kinClampDays("abc"), kinClampDays("12")],
        labels: [1, 2, 3, 7, 10, 45].map(kinFreqLabel),
      };
      setKinRemindSettings({ byDegree: { "A**": 3 } });
      r.degSet = contactEveryDays(a);
      setKinRemindSettings({ byDegree: {} });
      r.plan = kinRemindPlan({ "g-1": [a, Object.assign({}, a, { id: "b", contactEvery: 1 }), { id: "me", kinship: "نفسي", alive: true, lastContactDate: old }] }).map((x) => x.id + ":" + x.e);
      return r;
    });
    check(kin.deg === 10 && kin.own === 2, "المدّة: درجة الإخوة 10 · مدّة القريب تغلب", [kin.deg, kin.own]);
    check(kin.degSet === 3, "المدّة: ضبط الدرجة (كل 3 أيام) يغيّرها لكلّ إخوتي", kin.degSet);
    check(kin.overOwn === true && kin.overDeg === false, "التأخّر بمدّة القريب (يوميّاً، آخر تواصل قبل يومين)", [kin.overOwn, kin.overDeg]);
    check(kin.noProx && !kin.self && !kin.dead, "موعدٌ لمن لا درجة له إن اختار المستخدم مدّة · لا لنفسي ولا للمتوفّى", [kin.noProx, kin.self, kin.dead]);
    check(kin.bad.join() === ",,,12", "المدّة المخصّصة 1–365 فقط", kin.bad);
    check(kin.labels.join("|") === "Daily|Every 2 days|Every 3 days|Weekly|Every 10 days|Every 45 days", "أسماء المدد", kin.labels);
    check(kin.plan.join() === "g-1:b:1,g-1:a:10", "خطّة الخادم: الأقصر أوّلاً، بلا «نفسي»", kin.plan);

    // ── ٤أ) الحارس — الدالّة ─────────────────────────────────────────
    const sd = await page.evaluate(() => [
      !!selfDeceasedBlock({ id: "x", kinship: "نفسي" }, { alive: false }),
      !!selfDeceasedBlock({ id: "x", kinship: "الأخ", acctMe: true }, { alive: false }),
      !!selfDeceasedBlock({ id: "x", kinship: "الأخ" }, { alive: false }, "x"),
      !!selfDeceasedBlock({ id: "x", kinship: "الأخ", kinStored: "نفسي" }, { alive: false }),
      selfDeceasedBlock({ id: "x", kinship: "الجد" }, { alive: false }),
      selfDeceasedBlock({ id: "x", kinship: "نفسي" }, { alive: true }),
      !!selfDeceasedBlock(null, { kinship: "نفسي", alive: false }),
    ]);
    check(sd[0] && sd[1] && sd[2] && sd[3] && sd[4] === null && sd[5] === null && sd[6], "selfDeceasedBlock: نفسي · حسابي · «هذا أنا» · صاحب الشجرة ممنوعون، والجدّ جائز", sd);

    // ── الواجهة ───────────────────────────────────────────────────────
    const click = (re, scope) => page.evaluate(([src, sc]) => {
      const r = new RegExp(src), root = sc ? document.querySelector(sc) : document;
      const b = [...(root || document).querySelectorAll("button")].find((x) => r.test((x.innerText || "").trim()) || r.test((x.getAttribute("aria-label") || "").trim()));
      if (b) b.click(); return !!b;
    }, [re, scope || null]);
    const ppl = () => page.evaluate(() => JSON.parse(localStorage.getItem("sawa:groupPersons"))["g-1"]);
    const openFamily = async () => {
      await page.goto(base, { waitUntil: "load" }); await page.waitForFunction(() => !!window.SawaApp); await page.waitForTimeout(900);
      await click("^Explore$"); await page.waitForTimeout(500); await click("^Silat Rehim"); await page.waitForTimeout(600);
      const ok = await click("عائلتي"); await page.waitForTimeout(700); return ok;
    };
    // ١ب) البحث في قائمة العائلة بإملاءٍ مختلف
    check(await openFamily(), "العائلة موجودة");
    const searchHits = async (q) => {
      await page.evaluate((v) => {
        const inp = [...document.querySelectorAll("input")].find((x) => /search|ابحث|بحث/i.test(x.placeholder || "") && x.offsetParent);
        if (!inp) return;
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(inp, v); inp.dispatchEvent(new Event("input", { bubbles: true }));
      }, q);
      await page.waitForTimeout(400);
      return page.evaluate(() => document.body.innerText);
    };
    const hasSearch = await page.evaluate(() => [...document.querySelectorAll("input")].some((x) => /search|ابحث|بحث/i.test(x.placeholder || "") && x.offsetParent));
    if (!hasSearch) { await click("^Filter|تصفية|filter", null); await page.waitForTimeout(300); }
    const tx1 = await searchHits("فاطمت"), tx2 = await searchHits("يحيى"), tx3 = await searchHits("هنا"), tx4 = await searchHits("عبدالرحمن");
    check(/فاطمه/.test(tx1), "البحث: «فاطمت» يجد «فاطمه»");
    check(/يحيي/.test(tx2), "البحث: «يحيى» يجد «يحيي»");
    check(/هناء/.test(tx3), "البحث: «هنا» يجد «هناء»");
    check(tx4.indexOf("عبد الرحمن") >= 0, "البحث: «عبدالرحمن» يجد «عبد الرحمن»");
    await searchHits("");

    // ٢) «تركيز»: الاسم الكامل بلا قصّ
    await click("^Tree$"); await page.waitForTimeout(1000);
    const fv = await page.evaluate(() => {
      const clipped = (el) => { if (!el) return "missing"; const cs = getComputedStyle(el); return cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap" || el.scrollWidth > el.clientWidth + 1 ? "clipped" : ""; };
      const ban = document.querySelector("[data-focus-fullname]"), nm = document.querySelector("[data-focus-name]");
      const nodes = [...document.querySelectorAll("[data-focus-canvas] [data-node-name]")];
      return { ban: ban && ban.innerText, nm: nm && nm.innerText, banC: clipped(ban), nmC: clipped(nm), nodeTxt: nodes.map((n) => n.innerText), nodeC: nodes.map(clipped).filter(Boolean).length,
        add: [...document.querySelectorAll("[data-focus-canvas] button")].map((b) => b.innerText.trim()).filter((x) => /^(Spouse|Child|Sibling|Father|Mother|Add)/.test(x) || / of /.test(x)),
        banLines: ban ? Math.round(ban.getBoundingClientRect().height / parseFloat(getComputedStyle(ban).lineHeight)) : 0, banW: ban ? ban.getBoundingClientRect().width : 0 };
    });
    await shot(page, "1-focus");
    check(fv.nm === LONG, "تركيز: الاسم الكامل تحت صورة المختار (كان الاسم الأوّل وحده)", fv.nm);
    check(fv.ban === LONG, "تركيز: رأس الواجهة بالاسم الكامل (والنسب المكتوب فيه لا يُكرَّر)", fv.ban);
    check(fv.add.some((x) => /عبد الرحمن/.test(x)) && !fv.add.some((x) => /of عبد$/.test(x)), "تركيز: «إضافة … لـ عبد الرحمن» لا «عبد»", fv.add);
    check(!fv.banC && !fv.nmC && fv.nodeC === 0, "تركيز: لا «…» ولا قصّ في أيّ اسم", fv);
    check(fv.banLines >= 2 && fv.banW <= 341, "تركيز: الاسم الطويل يلتفّ على أسطر بعرضٍ محدود", [fv.banLines, fv.banW]);
    check(fv.nodeTxt.indexOf("عبد الله") >= 0, "تركيز: البطاقات بالاسم كاملاً («عبد الله» لا «عبد»)", fv.nodeTxt);

    // ٤ب) نموذج «نفسي»: لا مفتاح «متوفّى» · والحفظ يصلح «نفسي» المتوفّى القديم
    await openFamily();
    const openPerson = async (name) => { const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll("button, [role=button]")].find((x) => (x.innerText || "").split("\n").some((l) => l.trim() === n)); if (b) b.click(); return !!b; }, name); await page.waitForTimeout(700); return ok; };
    check(await openPerson(LONG), "ملفّ «أنا» يُفتح");
    const prof = await page.evaluate(() => {
      const el = document.querySelector("[data-full-name]"), h1 = document.querySelector("h1"), cs = el && getComputedStyle(el);
      return { txt: el && el.innerText, wrap: cs && cs.whiteSpace, over: el ? el.scrollWidth > el.clientWidth + 1 : true, h1Trunc: h1 ? getComputedStyle(h1).textOverflow === "ellipsis" : null, lineage: (document.querySelector("[data-full-lineage]") || {}).innerText || "", kinCard: !!document.querySelector("[data-kin-reminder]") };
    });
    await shot(page, "2-profile-self");
    check(prof.txt === LONG && prof.wrap === "normal" && !prof.over, "الملفّ: الاسم كاملاً ويلتفّ", prof);
    check(prof.h1Trunc === false, "الملفّ: عنوان الرأس لا يُقصّ بـ«…»", prof.h1Trunc);
    check(prof.lineage === "", "الملفّ: الاسم المكتوب بنسبه لا يُكرَّر نسبه", prof.lineage);
    check(!prof.kinCard, "لا تذكير تواصلٍ مع نفسك");
    check(await click("^Edit$"), "زرّ «تعديل»"); await page.waitForTimeout(600);
    const form = await page.evaluate(() => ({ toggle: !!document.querySelector("[data-deceased-toggle]"), note: !!document.querySelector("[data-self-alive]") }));
    await page.evaluate(() => { const n = document.querySelector("[data-self-alive]"); n && n.scrollIntoView({ block: "center" }); }); await shot(page, "3-self-form");
    check(!form.toggle && form.note, "نموذج «نفسي»: لا مفتاح «متوفّى»، وسطرٌ يشرح", form);
    check(await click("^Save changes$"), "حفظ"); await page.waitForTimeout(700);
    const meAfter = (await ppl()).find((p) => p.id === "me");
    check(meAfter && meAfter.alive === true, "حفظ ملفّك يصلح «متوفّى» القديم", meAfter && meAfter.alive);

    // ٤ج) الحارس المركزيّ: «هل هو على قيد الحياة؟»/حدث الوفاة لا يمرّ لنفسي — عبر النموذج لقريبٍ آخر يبقى المفتاح
    await openFamily(); await openPerson("محمد"); await click("^Edit$"); await page.waitForTimeout(600);
    check(await page.evaluate(() => !!document.querySelector("[data-deceased-toggle]")), "نموذج الوالد: مفتاح «متوفّى» موجود");

    // ٣ب) بطاقة التذكير في ملفّ القريب: «كل يومين» ثمّ مخصّص 5 ثمّ «حسب الدرجة»
    await openFamily(); check(await openPerson("فاطمه"), "ملفّ «فاطمه»");
    check(await page.evaluate(() => !!document.querySelector("[data-kin-reminder]")), "بطاقة «تذكير التواصل» في الملفّ");
    const sisLine = await page.evaluate(() => (document.querySelector("[data-full-lineage]") || {}).innerText || "");
    check(/^فاطمه بنت محمد بن عبد الله( بن إبراهيم)?$/.test(sisLine), "الملفّ: سطر النسب الكامل من الشجرة (إبراهيم أُضيف من نسب «أنا» عند حفظه — C104)", sisLine);
    await click("^Every 2 days$", "[data-freq-picker]"); await page.waitForTimeout(500);
    check(((await ppl()).find((p) => p.id === "sis") || {}).contactEvery === 2, "اختيار «كل يومين» يُحفظ للقريب");
    await click("^Custom", "[data-freq-picker]"); await page.waitForTimeout(300);
    await page.fill("[data-freq-custom]", "5"); await page.click("[data-freq-save]"); await page.waitForTimeout(500);
    check(((await ppl()).find((p) => p.id === "sis") || {}).contactEvery === 5, "مدّةٌ مخصّصة (كل 5 أيام) تُحفظ");
    await page.evaluate(() => { const n = document.querySelector("[data-kin-reminder]"); n && n.scrollIntoView({ block: "center" }); }); await shot(page, "4-kin-card");
    const chip = await page.evaluate(() => document.body.innerText);
    check(/Every 5 days — just for them/.test(chip), "الملفّ يعرض المدّة ومصدرها", chip.match(/Every 5 days[^\n]*/));
    await click("^By degree", "[data-freq-picker]"); await page.waitForTimeout(500);
    check(((await ppl()).find((p) => p.id === "sis") || {}).contactEvery == null, "«حسب الدرجة» يعيدها");

    // ٣ج) الإعدادات: المدّة لكلّ درجة
    await click("^Settings$"); await page.waitForTimeout(500);
    check(await page.evaluate(() => !!document.querySelector("[data-kin-settings]")), "ورقة «مواعيد صلة الرحم»");
    await page.evaluate(() => { const card = document.querySelector("[data-kin-settings] [data-freq-picker]"); const b = [...card.querySelectorAll("button")].find((x) => x.innerText.trim() === "Every 3 days"); b && b.click(); });
    await page.waitForTimeout(300);
    const kr = await page.evaluate(() => JSON.parse(localStorage.getItem("sawa:kinRemind") || "{}"));
    check(kr.byDegree && kr.byDegree["A***"] === 3, "مدّة الدرجة الأولى «كل 3 أيام» تُحفظ", kr);
    await page.evaluate(() => { const b = [...document.querySelectorAll("[data-kin-settings] button")].find((x) => /^\d/.test(x.innerText.trim()) && /8/.test(x.innerText)); b && b.click(); });
    await page.waitForTimeout(200);
    await shot(page, "5-kin-settings");
    check(JSON.parse(await page.evaluate(() => localStorage.getItem("sawa:kinRemind"))).hour === 8, "ساعة الإشعار تُحفظ");

    // ٣د) الخطّة تُرسَل إلى الخادم (kin.remind.set) — SawaSync وهميّ
    const sent = await page.evaluate(async () => {
      const calls = []; window.SawaSync.isReady = () => true; window.SawaSync.call = (op, p) => { calls.push({ op, p }); return Promise.resolve({ ok: true }); };
      setKinRemindSettings({ on: true, hour: 18 });
      await new Promise((r) => setTimeout(r, 5500));
      return calls;
    });
    const last = sent[sent.length - 1];
    check(last && last.op === "kin.remind.set" && last.p.items.length >= 4 && last.p.hour === 18 && typeof last.p.tz === "number", "الخطّة تصل الخادم (المدد · الساعة · المنطقة الزمنيّة)", last && { op: last.op, n: last.p.items.length, hour: last.p.hour });
    check(last && last.p.items.every((x) => x.id.indexOf(":me") < 0), "الخطّة بلا «نفسي»");

    // ٣هـ) التنبيه المحلّيّ الاحتياطيّ (بلا خادم): مرّةً في اليوم
    const local = await page.evaluate(async () => {
      localStorage.removeItem("sawa:kinRemindSrv"); localStorage.removeItem("sawa:kinRemindLocal");
      setKinRemindSettings({ on: true, hour: 0 });
      try { Object.defineProperty(Notification, "permission", { configurable: true, get: () => "granted" }); } catch (e) {}   // Chromium بلا واجهة يرفض الإذن دائماً
      const shown = []; const reg = { showNotification: (t, o) => { shown.push([t, o.body, o.tag]); return Promise.resolve(); } };
      navigator.serviceWorker.getRegistration = () => Promise.resolve(reg);
      const gp = { "g-1": [{ id: "x", local_name: "سعاد", kinship: "الأخت", proximity: "A**", alive: true, contactEvery: 1, lastContactDate: Date.now() - 3 * 86400000 }] };
      const a = kinRemindLocalTick(gp); await new Promise((r) => setTimeout(r, 50));
      const b = kinRemindLocalTick(gp);
      return { a, b, shown };
    });
    check(local.a === true && local.b === false && local.shown.length === 1 && local.shown[0][2] === "sawa-kin" && /سعاد/.test(local.shown[0][1]), "تنبيهٌ محلّيّ واحد في اليوم بأسماء من حان", local);

    if (errors.length) { failN++; console.error("✗ استثناءات في الصفحة:\n  " + errors.join("\n  ")); }
    console.log((failN ? "✗" : "✓") + " C271: " + pass + " passed, " + failN + " failed");
    process.exitCode = failN ? 1 : 0;
  } catch (e) {
    console.error("✗ تعطّل الاختبار:", e && e.stack || e); process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
});
