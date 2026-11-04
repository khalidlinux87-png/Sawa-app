// C203 — اختبار قواعد الشجرة وواجهتها في Chromium (المتصفّح فقط، بلا خادم ولا بيانات حقيقيّة):
//   ١) الدوالّ النقيّة: marriageCheck · inferredMarriageType · nameGenerations · computeGenerations · treeNavGroups · kinCompute (الأصهار)
//   ٢) الواجهة بعائلةٍ مزروعة (family-seed.js): فصل الأجيال في الشجرة الكاملة · أزرار الأصل/الفروع/الأصهار ·
//      «إضافة عدّة أقارب»: الاسم بجيلين، منع الزوج الثاني، بطاقة السياق · الحفظ ثمّ «تراجع» من الإشعار · «السجلّ».
// الاستعمال: node .claude/tools/family.test.js   (رمز الخروج ≠ 0 عند الفشل)
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("playwright غير متاح في هذه البيئة"); process.exit(2); }
const ROOT = path.resolve(__dirname, "../.."), NM = path.join(__dirname, "node_modules");
const seed = require("./family-seed.js");
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
const check = (ok, name, extra) => { if (ok) pass++; else { failN++; console.error("✗ " + name + (extra !== undefined ? "  ⇒ " + JSON.stringify(extra) : "")); } };

server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = cdn(r.request().url()); return f && fs.existsSync(f) ? r.fulfill({ path: f, contentType: "application/javascript" }) : r.abort(); });
    await ctx.addInitScript((sd) => {
      try {
        if (sessionStorage.getItem("seeded")) return;   // الزرع مرّةً واحدة — إعادة التحميل تُبقي التعديلات
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("sawa_onboarded", String(Date.now())); localStorage.setItem("sawaLang", "en");
        localStorage.setItem("sawa:groupPersons", JSON.stringify({ "g-1": sd.persons }));
        localStorage.setItem("sawa:kinshipRelations", JSON.stringify(sd.relations));
      } catch (e) {}
    }, seed);
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.SawaApp, null, { timeout: 30000 });
    await page.waitForTimeout(1200);

    // ── ١) الدوالّ النقيّة ───────────────────────────────────────────
    const unit = await page.evaluate(() => {
      const P = (id, g) => ({ id, local_name: id, gender: g });
      const R = (s, t, type, id) => ({ id: id || s + t + type, source: s, target: t, type });
      const ppl = [P("h1", "male"), P("h2", "male"), P("w1", "female"), P("w2", "female"), P("w3", "female"), P("w4", "female"), P("w5", "female"), P("x", ""), P("son", "male"), P("dau", "female")];
      const r0 = [R("h1", "son", "parent"), R("h1", "dau", "parent")];
      const code = (rels, a, b, type) => (marriageCheck(ppl, rels, a, b, type) || {}).code || null;
      const four = [R("h1", "w1", "spouse"), R("h1", "w2", "spouse"), R("h1", "w3", "spouse"), R("h1", "w4", "spouse")];
      return {
        ok: code([], "h1", "w1", "spouse"),
        sameSex: code([], "h1", "h2", "spouse"),
        sameSexEx: code([], "w1", "w2", "ex_spouse"),
        noGender: code([], "h1", "x", "spouse"),
        polyandry: code([R("h1", "w1", "spouse")], "h2", "w1", "spouse"),
        polyandryAsEx: code([R("h1", "w1", "spouse")], "h2", "w1", "ex_spouse"),
        fifthWife: code(four, "h1", "w5", "spouse"),
        fifthAsEx: code(four, "h1", "w5", "ex_spouse"),
        mahramChild: code(r0, "h1", "dau", "spouse"),
        mahramSibling: code(r0, "son", "dau", "spouse"),
        // العمّة وبنت الأخ ممنوعتان، وبنت العمّ وبنت ابن العمّ جائزتان
        kin: (() => {
          const G = [P("gf", "male"), P("dad", "male"), P("aunt", "female"), P("me", "male"), P("bro", "male"), P("niece", "female"), P("unc", "male"), P("cous", "female"), P("cous2", "male"), P("cousd", "female")];
          const RR = [R("gf", "dad", "parent"), R("gf", "aunt", "parent"), R("gf", "unc", "parent"), R("dad", "me", "parent"), R("dad", "bro", "parent"), R("bro", "niece", "parent"), R("unc", "cous", "parent"), R("unc", "cous2", "parent"), R("cous2", "cousd", "parent")];
          const c = (b) => (marriageCheck(G, RR, "me", b, "spouse") || {}).code || null;
          return [c("aunt"), c("niece"), c("cous"), c("cousd")];
        })(),
        inferCur: inferredMarriageType(ppl, [], "h2", "w1"),
        inferEx: inferredMarriageType(ppl, [R("h1", "w1", "spouse")], "h2", "w1"),
        inferNone: inferredMarriageType(ppl, [], "h1", "h2"),
        viol: marriageViolations(ppl, [R("h1", "w1", "spouse"), R("h2", "w1", "spouse")]).map((v) => v.code),
        names: ["محمد", "محمد أحمد", "محمد بن أحمد", "عبد الله", "عبد الله محمد", "نور الدين", "نور الدين علي", "أبو بكر", "فاطمة بنت علي", "Fatima bint Ali"].map(nameGenerations),
      };
    });
    check(unit.ok === null, "زواجٌ صحيح يُقبل", unit.ok);
    check(unit.sameSex === "same_sex" && unit.sameSexEx === "same_sex", "جنسٌ واحد يُرفض (قائماً وسابقاً)", [unit.sameSex, unit.sameSexEx]);
    check(unit.noGender === "gender_unknown", "زواجٌ بلا جنسٍ معروف يُرفض", unit.noGender);
    check(unit.polyandry === "polyandry" && unit.polyandryAsEx === null, "زوجٌ ثانٍ حاليّ يُرفض، والسابق يُقبل", [unit.polyandry, unit.polyandryAsEx]);
    check(unit.fifthWife === "max_wives" && unit.fifthAsEx === null, "خامسةٌ حاليّة تُرفض، والسابقة تُقبل", [unit.fifthWife, unit.fifthAsEx]);
    check(unit.mahramChild === "mahram" && unit.mahramSibling === "mahram", "لا زواج بين أصلٍ وفرع أو إخوة", [unit.mahramChild, unit.mahramSibling]);
    check(JSON.stringify(unit.kin) === JSON.stringify(["mahram", "mahram", null, null]), "العمّة وبنت الأخ ممنوعتان، وبنت العمّ وبنت ابن العمّ جائزتان", unit.kin);
    check(unit.inferCur === "spouse" && unit.inferEx === "ex_spouse" && unit.inferNone === null, "الاستنتاج: قائم/سابق/لا شيء", [unit.inferCur, unit.inferEx, unit.inferNone]);
    check(unit.viol.includes("polyandry"), "مخالفات قديمة تُكتشف", unit.viol);
    check(JSON.stringify(unit.names) === JSON.stringify([1, 2, 2, 1, 2, 1, 2, 1, 2, 2]), "عدّ أجيال الاسم (المركّب اسمٌ واحد)", unit.names);

    const tree = await page.evaluate((sd) => {
      const g = computeGenerations(sd.persons, sd.relations);
      const nav = treeNavGroups(sd.persons.map((p) => (p.id === "p-kha" ? p : p)), sd.relations, "p-kha");
      const k = kinCompute(sd.persons, sd.relations, "p-kha");
      return {
        crossHuda: g.isCrossGen("p-kha", "p-hud"), crossSalma: g.isCrossGen("p-kha", "p-sal"),
        genKha: g.gen["p-kha"], genSae: g.gen["p-sae"], genHud: g.gen["p-hud"], genSal: g.gen["p-sal"], genHas: g.gen["p-has"],
        usul: nav.usul.map((x) => x.id), furu: nav.furu.map((x) => x.id),
        labels: { has: k["p-has"].kinship, yas: k["p-yas"].kinship, uth: k["p-uth"].kinship, sec: k["p-has"].section },
      };
    }, seed);
    check(tree.crossHuda === true && tree.crossSalma === false, "زواج هدى عابرٌ للأجيال، وسلمى لا", [tree.crossHuda, tree.crossSalma]);
    check(tree.genSae === tree.genKha && tree.genHud === tree.genKha + 1, "هدى جيلٌ تحت خالد وسعيد (أبوها) في جيله", tree);
    check(tree.genSal === tree.genKha && tree.genHas === tree.genKha - 1, "سلمى تُحاذى بزوجها وأبوها فوقها", tree);
    check(tree.usul.join() === "p-moh,p-zay,p-ali" && tree.furu.join() === "p-son", "الأصل والفروع من «أنا»", [tree.usul, tree.furu]);
    check(tree.labels.has === "والد الزوجة" && tree.labels.yas === "أخ الزوجة" && tree.labels.uth === "جد الزوجة لأمها" && tree.labels.sec === "ashar", "قرابات الأصهار وقسمها", tree.labels);

    // ── ٢) الواجهة ───────────────────────────────────────────────────
    const click = (re, opts) => page.evaluate(([src, scope]) => {
      const r = new RegExp(src);
      const root = scope ? document.querySelector(scope) : document;
      const b = [...(root || document).querySelectorAll("button")].find((x) => r.test((x.innerText || "").trim()) || r.test((x.getAttribute("aria-label") || "").trim()));
      if (b) b.click(); return !!b;
    }, [re, opts || null]);
    const text = () => page.evaluate(() => document.body.innerText);
    const openFamily = async () => { await click("^Explore$"); await page.waitForTimeout(600); const ok = await click("^Silat Rehim"); await page.waitForTimeout(700); return ok; };
    check(await openFamily(), "«Silat Rehim» موجود");
    check(await click("عائلتي"), "العائلة موجودة"); await page.waitForTimeout(700);
    check(await click("^Tree$"), "زرّ الشجرة"); await page.waitForTimeout(900);
    await page.waitForTimeout(800);
    const zt = await page.evaluate(() => JSON.parse(localStorage.getItem("sawa:kinshipRelations")).filter((r) => [r.source, r.target].sort().join() === ["p-tar", "p-zay"].sort().join()).map((r) => r.type));
    check(JSON.stringify(zt) === JSON.stringify(["ex_spouse"]), "زواج زينب وطارق المستنتَج عند فتح الشجرة «سابق» لا زوجٌ ثانٍ", zt);
    const navTxt = await page.evaluate(() => { const n = document.querySelector("[data-tree-nav]"); return n ? n.innerText : ""; });
    check(/Roots \(3\)/.test(navTxt) && /Branches \(1\)/.test(navTxt) && /In-laws \(\d+\)/.test(navTxt), "شريط الأصل/الفروع/الأصهار بأعداده", navTxt);
    await click("^In-laws"); await page.waitForTimeout(400);
    const strip = await page.evaluate(() => document.querySelector("[data-tree-nav]").innerText);
    check(/حسن/.test(strip) && /ياسر/.test(strip) && /عثمان/.test(strip) && /سلمى/.test(strip), "الأصهار: والد الزوجة وأخوها وجدّها والزوجة", strip);
    check(!/علي\b|محمد/.test(strip.replace(/In-laws.*\n?/, "")), "الأصهار لا تضمّ الأصول", strip);
    await click("^Roots"); await page.waitForTimeout(300);
    const rootsStrip = await page.evaluate(() => document.querySelector("[data-tree-nav]").innerText);
    check(/⬆ علي/.test(rootsStrip), "«الأصل» يبدأ برأس السلسلة (علي)", rootsStrip);

    // الشجرة الكاملة: لا يجتمع أصلٌ وفرعه في صفّ، وهدى ليست بجانب خالد
    await click("^Tree$", "[role=tablist], .flex-1"); await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === "Tree"); b[b.length - 1] && b[b.length - 1].click(); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Expand all|Collapse/.test(x.innerText || "")); void b; });
    const rows = await page.evaluate((sd) => {
      const y = {};
      document.querySelectorAll("[data-pid]").forEach((el) => { const r = el.getBoundingClientRect(); if (r.height) y[el.getAttribute("data-pid")] = Math.round(r.top); });
      const bad = [];
      sd.relations.filter((r) => r.type === "parent").forEach((r) => { if (y[r.source] != null && y[r.target] != null && Math.abs(y[r.source] - y[r.target]) < 30) bad.push(r.source + "/" + r.target); });
      return { y, bad, far: [...document.querySelectorAll("button")].some((b) => /💍 (wife|زوجته) هدى/.test(b.innerText || "")) };
    }, seed);
    check(Object.keys(rows.y).length >= 8, "الشجرة الكاملة مرسومة", Object.keys(rows.y).length);
    check(rows.bad.length === 0, "لا والد وابنه في صفٍّ واحد", rows.bad);
    check(rows.y["p-hud"] == null || Math.abs(rows.y["p-hud"] - rows.y["p-sae"]) >= 30, "هدى ليست في صفّ أبيها سعيد", [rows.y["p-hud"], rows.y["p-sae"]]);
    check(rows.far, "شارة «💍 زوجته هدى ↗» عند خالد");

    // «إضافة عدّة أقارب» لسلمى (متزوّجة): زوجٌ ثانٍ ممنوع قبل الحفظ
    const openBulk = async (pid) => {
      await page.evaluate((id) => { const c = document.querySelector(`[data-pid="${id}"] button`); c && c.click(); }, pid);
      await page.waitForTimeout(500);
      return click("^Add several relatives at once");
    };
    check(await openBulk("p-sal"), "قائمة سلمى ⇐ إضافة عدّة أقارب"); await page.waitForTimeout(500);
    check(await click("^Husband$"), "خيار «Husband» لامرأة"); await page.waitForTimeout(300);
    await page.fill("textarea", "زيد بن عمرو"); await page.waitForTimeout(400);
    let ctxTxt = await page.evaluate(() => (document.querySelector("[data-rel-context]") || {}).innerText || "");
    check(/currently married/.test(ctxTxt), "بطاقة السياق تمنع الزوج الثاني", ctxTxt);
    const saveDisabled = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Can't save/.test(x.innerText || "")); return !!b && b.disabled; });
    check(saveDisabled, "زرّ الحفظ معطّل مع السبب");
    await click("^Close$|^×$|^Cancel$"); await page.keyboard.press("Escape"); await page.waitForTimeout(500);

    // زوجةٌ لخالد: الاسم بجيلين ⇒ ثمّ الحفظ ⇒ «تراجع» من الإشعار يُزيلها
    await page.goto(base, { waitUntil: "load" }); await page.waitForFunction(() => !!window.SawaApp); await page.waitForTimeout(1000);
    await openFamily(); await click("عائلتي"); await page.waitForTimeout(600); await click("^Tree$"); await page.waitForTimeout(800);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === "Tree"); b[b.length - 1] && b[b.length - 1].click(); });   // العرض الكامل
    await page.waitForTimeout(800);
    check(await openBulk("p-kha") || (await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^Add several relatives/.test(x.innerText || "")); b && b.click(); return !!b; })), "قائمة خالد ⇐ إضافة عدّة أقارب");
    await page.waitForTimeout(400);
    check(await click("^Wives$"), "خيار «Wives»"); await page.waitForTimeout(300);
    const ph = await page.evaluate(() => [document.querySelector("textarea").getAttribute("placeholder"), (document.getElementById("qr-name-hint") || {}).innerText || ""]);
    check(/bint/.test(ph[0]) && /father's name/.test(ph[1]), "مثال الزوجة بنسبها، والسطر تحته يطلب اسم الأب", ph);
    await page.fill("textarea", "نورة"); await page.waitForTimeout(300);
    ctxTxt = await page.evaluate(() => (document.querySelector("[data-rel-context]") || {}).innerText || "");
    check(/Add the father's name to: نورة/.test(ctxTxt) && /wife of «خالد/.test(ctxTxt), "اسمٌ واحد ⇒ تنبيه «أضف اسم الأب» وسياقٌ واضح", ctxTxt);
    await page.fill("textarea", "نورة بنت علي"); await page.waitForTimeout(300);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("sawa:groupPersons"))["g-1"].length);
    check(await click("^Add 1 relative"), "الحفظ متاحٌ بعد اسم الأب"); await page.waitForTimeout(500);
    const undoBtn = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "Undo"));
    check(undoBtn, "إشعار النجاح يحمل «Undo»");
    await page.waitForTimeout(700);
    const mid = await page.evaluate(() => JSON.parse(localStorage.getItem("sawa:groupPersons"))["g-1"].map((p) => p.local_name));
    check(mid.length === before + 2 && mid.includes("نورة") && mid.includes("علي"), "أُضيفت نورة وأبوها علي (النسب)", mid);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "Undo"); b && b.click(); });
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("sawa:groupPersons"))["g-1"].map((p) => p.local_name));
    check(after.length === before && !after.includes("نورة"), "«تراجع» أعادها كما كانت", after);
    const redo = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "Redo"));
    check(redo, "بعد التراجع: «Redo»");
    // السجلّ: سطر الإضافة وسطر التراجع، والتراجع متاح
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await click("^Done$|^Close$"); await page.waitForTimeout(300);
    check(await click("^History$"), "زرّ «History» في الشجرة"); await page.waitForTimeout(600);
    const hist = await text();
    check(/History & undo/.test(hist) && /Undid:/.test(hist) && /Undo/.test(hist), "شاشة السجلّ بالتراجع", hist.slice(0, 400));

    if (errors.length) { failN++; console.error("✗ استثناءات في الصفحة:\n  " + errors.join("\n  ")); }
    console.log((failN ? "✗" : "✓") + " family C203: " + pass + " passed, " + failN + " failed");
    process.exitCode = failN ? 1 : 0;
  } finally { await browser.close(); server.close(); }
});
