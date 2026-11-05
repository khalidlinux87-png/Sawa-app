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

    // ── C204: والدٌ لعدّة إخوة · نوع الأخوّة · معاينة الدمج ─────────────────
    const c204 = await page.evaluate(() => {
      const P = (id, g) => ({ id, local_name: id, gender: g });
      const R = (s, t, type, id, half) => Object.assign({ id: id || s + ">" + t, source: s, target: t, type }, half ? { half } : {});
      const ppl = [P("F", "male"), P("M1", "female"), P("M2", "female"), P("A", "male"), P("B", "male"), P("C", "female"), P("X", "male"), P("XF", "male"), P("N", "male"), P("K1", "male"), P("K2", "female")];
      const rels = [R("F", "M1", "spouse"), R("F", "M2", "spouse"), R("F", "A", "parent"), R("M1", "A", "parent"), R("F", "B", "parent"), R("M1", "B", "parent"), R("F", "C", "parent"), R("XF", "X", "parent")];
      const sib = famSiblingsOf(ppl, rels, "A").map((x) => x.id + ":" + x.type).sort().join(",");
      const toPaternal = planSiblingType(ppl, rels, "A", "B", "father", "M2");
      const toFull = planSiblingType(ppl, rels, "A", "C", "full", null);
      const clash = planSiblingType(ppl, rels, "A", "X", "full", null);
      const bpNew = planBatchParent(ppl.concat([P("NEWF", "male")]), rels, "NEWF", ["K1", "K2", "A"]);
      const bpMom = planBatchParent(ppl, rels, "M2", ["C", "A"]);
      const bpCycle = planBatchParent(ppl, rels, "A", ["F"]);
      const dupA = famMergePreview(ppl, rels, "A", "B"), dupX = famMergePreview(ppl, rels, "F", "C");
      return { sib, toPaternal, toFull, clash: !!clash.error, bpNew: [bpNew.add.map((e) => e.target).join(), bpNew.skipped.map((x) => x.id).join()], bpMom: bpMom.add.map((e) => e.target).join() + "|" + bpMom.skipped.map((x) => x.id).join(), bpCycle: bpCycle.skipped.length, dupA: [dupA.movedCount, dupA.warn.length, !!dupA.block], dupX: !!dupX.block };
    });
    check(c204.sib === "B:full,C:unknown", "إخوة A: B شقيق، وC (أبٌ مشترك فقط) غير محدَّد", c204.sib);
    check(c204.toPaternal.remove.includes("M1>B") && c204.toPaternal.add.some((e) => e.source === "M2" && e.target === "B") && c204.toPaternal.add.some((e) => e.type === "sibling" && e.half === "father"), "«لأب»: تُفكّ أمّ B المشتركة وتُربط M2، وتُسجَّل الأخوّة لأب", c204.toPaternal);
    check(c204.toFull.add.some((e) => e.source === "M1" && e.target === "C") && !c204.toFull.error, "«شقيق»: ترث C أمّ A", c204.toFull);
    check(c204.clash, "«شقيق» مع أبٍ مختلف مسجَّل يُرفض");
    check(c204.bpNew[0] === "K1,K2" && c204.bpNew[1] === "A", "أبٌ جديد لثلاثة: يُتخطّى من له أب", c204.bpNew);
    check(c204.bpMom === "C|A", "أمٌّ لـ C (بلا أمّ) وتخطّي A (أمّه M1)", c204.bpMom);
    check(c204.bpCycle === 1, "لا يكون المرء والدَ أبيه");
    check(c204.dupA[0] === 2 && c204.dupA[2] === false && c204.dupX === true, "معاينة الدمج: عدد العلاقات المنقولة، ومنع دمج ذكرٍ وأنثى", [c204.dupA, c204.dupX]);

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

    // ── C204 (واجهة): اللوحة · قائمة البطاقة · والدٌ لعدّة إخوة · نوع الأخوّة · دمج مكرّر · قائمة الأقارب ──
    const rels = () => page.evaluate(() => JSON.parse(localStorage.getItem("sawa:kinshipRelations")));
    const ppl = () => page.evaluate(() => JSON.parse(localStorage.getItem("sawa:groupPersons"))["g-1"]);
    const openTreeFull = async () => {
      await page.goto(base, { waitUntil: "load" }); await page.waitForFunction(() => !!window.SawaApp); await page.waitForTimeout(900);
      await openFamily(); await click("عائلتي"); await page.waitForTimeout(500); await click("^Tree$"); await page.waitForTimeout(700);
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === "Tree"); b[b.length - 1] && b[b.length - 1].click(); });
      await page.waitForTimeout(900);
    };
    const cardMenu = async (pid, re) => {
      await page.evaluate((id) => { const c = document.querySelector(`[data-pid="${id}"] button`); c && c.click(); }, pid); await page.waitForTimeout(450);
      return click(re);
    };
    await openTreeFull();
    const canvas = await page.evaluate(() => {
      const v = document.querySelector("[data-tree-canvas]"); if (!v) return null;
      const vr = v.getBoundingClientRect(); let bad = 0, n = 0;
      document.querySelectorAll("[data-pid]").forEach((c) => { n++; const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2 - vr.left + v.scrollLeft, cy = r.top + r.height / 2 - vr.top + v.scrollTop;
        if (cx < v.clientWidth / 2 - 1 || cx > v.scrollWidth - v.clientWidth / 2 + 1 || cy < v.clientHeight / 2 - 1 || cy > v.scrollHeight - v.clientHeight / 2 + 1) bad++; });
      const me = document.querySelector("[data-tree-me='1']"), mr = me && me.getBoundingClientRect();
      return { n, bad, meIn: !!mr && mr.left >= vr.left && mr.right <= vr.right && mr.top >= vr.top && mr.bottom <= vr.bottom };
    });
    check(canvas && canvas.n >= 8 && canvas.bad === 0, "اللوحة: كلّ بطاقة تُسحب إلى وسط الشاشة (في المحورين)", canvas);
    check(canvas && canvas.meIn, "اللوحة تبدأ عند «أنا»", canvas);
    // والدٌ لعدّة إخوة: أمٌّ جديدة لسعيد (بلا أمّ) — ويُعرض سببُ تخطّي من له أمّ
    check(await cardMenu("p-sae", "^Parent for several siblings"), "قائمة البطاقة: «Parent for several siblings»"); await page.waitForTimeout(400);
    await click("^Mother$"); await page.waitForTimeout(200);
    await page.fill("[data-batch-parent] input", "حليمة بنت يوسف"); await page.waitForTimeout(300);
    const bp = await page.evaluate(() => document.querySelector("[data-batch-parent]").innerText);
    check(/سعيد/.test(bp) && !/سعيد[^\n]*\n[^\n]*has a/.test(bp), "سعيد مؤهَّل (بلا أمّ مسجَّلة)", bp.slice(0, 300));
    check(await click("^Link to 1$"), "زرّ «Link to 1»"); await page.waitForTimeout(700);
    let P2 = await ppl(), R2 = await rels();
    const hal = P2.find((x) => x.local_name === "حليمة") || {};
    check(!!hal && R2.some((r) => r.type === "parent" && r.source === hal.id && r.target === "p-sae") && P2.some((x) => x.local_name === "يوسف"), "حليمة أمٌّ لسعيد، وأبوها يوسف أُضيف من النسب", hal);
    check(R2.some((r) => [r.source, r.target].sort().join() === [hal.id, "p-sal2"].sort().join() && r.type === "spouse"), "زواج صالح وحليمة (والدَي سعيد) يُستنتج", R2.filter((r) => r.source === hal.id || r.target === hal.id).map((r) => r.type));
    // نوع الأخوّة: عمر «لأب» لخالد (يشاركه الأب وحده)
    await openTreeFull();
    check(await cardMenu("p-kha", "^Sibling type"), "قائمة البطاقة: «Sibling type»"); await page.waitForTimeout(400);
    const st0 = await page.evaluate(() => document.querySelector("[data-sibling-type]").innerText);
    check(/عمر/.test(st0) && /فارس/.test(st0), "قائمة إخوة خالد: عمر (أب) وفارس (أم)", st0.slice(0, 300));
    // من الوالدين المسجّلين: عمر ابن محمد وزينب (استُنتجت أمّه عند فتح الشجرة) ⇒ شقيق · فارس ابن زينب وطارق ⇒ لأم
    check(/عمر[\s\S]*?Now: full/.test(st0) && /فارس[\s\S]*?Now: maternal half/.test(st0), "النوع محسوبٌ من الوالدين: عمر شقيق، فارس لأم", st0.slice(0, 300));
    // تعديل: عمر «لأب» ⇒ تُفكّ أمّه زينب، وتحمل حافّة الأخوّة النوع
    await page.evaluate(() => { const row = [...document.querySelectorAll("[data-sibling-type] > div")].find((d) => /عمر/.test(d.innerText || "")); const b = row && row.querySelector("button"); b && b.click(); });
    await page.waitForTimeout(300);
    check(await click("^Paternal$"), "خيار «Paternal»"); await page.waitForTimeout(300);
    const prevTxt = await page.evaluate(() => document.querySelector("[data-sibling-type]").innerText);
    check(/زينب is unlinked as عمر's mother/.test(prevTxt), "المعاينة: تُفكّ زينب أمّاً عن عمر", prevTxt.slice(0, 400));
    check(await click("^Apply$"), "«Apply»"); await page.waitForTimeout(700);
    R2 = await rels();
    check(!R2.some((r) => r.type === "parent" && r.source === "p-zay" && r.target === "p-omr") && R2.some((r) => r.type === "sibling" && r.half === "father" && [r.source, r.target].sort().join() === ["p-kha", "p-omr"].sort().join()), "عمر أخٌ لأب: بلا أمّ زينب، والأخوّة half=father", R2.filter((r) => r.source === "p-omr" || r.target === "p-omr").map((r) => r.source + ">" + r.target + ":" + r.type + (r.half ? "/" + r.half : "")));
    // دمج مكرّر: «محمد» مرّتين
    await page.addInitScript(() => { if (sessionStorage.getItem("inject-dup") !== "1") return; sessionStorage.setItem("inject-dup", "done"); const g = JSON.parse(localStorage.getItem("sawa:groupPersons")); g["g-1"].push({ id: "p-moh2", local_name: "محمد", gender: "male", kinship: "أخرى", alive: true, locations: [] }); localStorage.setItem("sawa:groupPersons", JSON.stringify(g)); const r = JSON.parse(localStorage.getItem("sawa:kinshipRelations")); r.push({ id: "rdup", groupId: "g-1", source: "p-moh2", target: "p-sae", type: "sibling" }); localStorage.setItem("sawa:kinshipRelations", JSON.stringify(r)); });
    await page.evaluate(() => sessionStorage.setItem("inject-dup", "1"));
    await openTreeFull();
    check(await cardMenu("p-moh2", "^Merge with a duplicate"), "قائمة البطاقة: «Merge with a duplicate»"); await page.waitForTimeout(400);
    const dup = await page.evaluate(() => document.querySelector("[data-dup-sheet]").innerText);
    check(/محمد/.test(dup) && /stays/.test(dup), "المكرّر يُقترح تلقائيّاً بالاسم ومعاينةٌ لما ينتقل", dup.slice(0, 300));
    const keepBtn = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-dup-sheet] button")].find((x) => /^That:/.test((x.innerText || "").trim())); if (b) b.click(); return !!b; });
    await page.waitForTimeout(200);
    check(keepBtn && await click("^Merge the records$"), "«أيّ النسختين تبقى» ثمّ الدمج"); await page.waitForTimeout(700);
    P2 = await ppl(); R2 = await rels();
    check(!P2.some((x) => x.id === "p-moh2") && R2.some((r) => r.type === "sibling" && [r.source, r.target].sort().join() === ["p-moh", "p-sae"].sort().join()), "حُذف المكرّر وانتقلت علاقته إلى الأصل", R2.filter((r) => r.source === "p-sae" || r.target === "p-sae").map((r) => r.source + ">" + r.target + ":" + r.type));
    // قائمة الأقارب: صفٌّ واحد للتصفية + «المزيد»
    await page.goto(base, { waitUntil: "load" }); await page.waitForFunction(() => !!window.SawaApp); await page.waitForTimeout(900);
    await openFamily(); await click("عائلتي"); await page.waitForTimeout(700);
    const lst = await page.evaluate(() => ({ more: !!document.querySelector("[data-fam-more]"), oldTools: [...document.querySelectorAll("button")].some((b) => /^By lineage$|^Select$/.test((b.innerText || "").trim())) }));
    check(lst.more && !lst.oldTools, "قائمة الأقارب: «More» بدل صفّ الأدوات", lst);

    // ── C205: واجهة «تركيز» — أربعة أجداد وستّة إخوة أعرض من الشاشة: كلّ بطاقةٍ تُسحب إلى وسط اللوحة، والمختار ظاهرٌ عند الفتح ──
    {
      const fs2 = require("./focus-seed.js");
      const ctx2 = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: "block" });
      await ctx2.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = cdn(r.request().url()); return f && fs.existsSync(f) ? r.fulfill({ path: f, contentType: "application/javascript" }) : r.abort(); });
      await ctx2.addInitScript((sd) => { try { localStorage.setItem("sawa_onboarded", String(Date.now())); localStorage.setItem("sawaLang", "en"); localStorage.setItem("sawa:groupPersons", JSON.stringify({ "g-1": sd.persons })); localStorage.setItem("sawa:kinshipRelations", JSON.stringify(sd.relations)); } catch (e) {} }, fs2);
      const pg2 = await ctx2.newPage();
      pg2.on("pageerror", (e) => errors.push(e.message));
      await pg2.goto(base, { waitUntil: "load" }); await pg2.waitForFunction(() => !!window.SawaApp); await pg2.waitForTimeout(1000);
      const c2 = (re) => pg2.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((x) => r.test((x.innerText || "").trim())); if (b) b.click(); return !!b; }, re);
      await c2("^Explore$"); await pg2.waitForTimeout(500); await c2("^Silat Rehim"); await pg2.waitForTimeout(600); await c2("عائلتي"); await pg2.waitForTimeout(600); await c2("^Tree$"); await pg2.waitForTimeout(900);
      const fv = await pg2.evaluate((names) => {
        const v = document.querySelector("[data-focus-canvas]"); if (!v) return null;
        const vr = v.getBoundingClientRect(), bad = [];
        names.forEach((nm) => { const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.trim() === nm) {
          const r = n.parentElement.getBoundingClientRect(), cx = r.left + r.width / 2 - vr.left + v.scrollLeft, cy = r.top + r.height / 2 - vr.top + v.scrollTop;
          if (!(cx >= v.clientWidth / 2 - 1 && cx <= v.scrollWidth - v.clientWidth / 2 + 1 && cy >= v.clientHeight / 2 - 1 && cy <= v.scrollHeight - v.clientHeight / 2 + 1)) bad.push(nm); } });
        const c = v.querySelector("[data-focus-center]").getBoundingClientRect();
        return { bad, focusIn: c.left >= vr.left && c.right <= vr.right && c.top >= vr.top && c.bottom <= vr.bottom, wide: v.scrollWidth > v.clientWidth * 2 };
      }, ["ابوالحسن", "زينب", "احمد", "فاطمة", "محمد", "سعاد", "إبتهال", "أسماء", "إيمان", "عمر", "خديجة", "يوسف"]);
      check(fv && fv.bad.length === 0, "تركيز: كلّ الأجداد والإخوة يُسحبون إلى وسط اللوحة (لا قصّ عند الأطراف)", fv);
      check(fv && fv.focusIn, "تركيز: المختار ظاهرٌ كاملاً عند الفتح", fv);
      await ctx2.close();
    }

    if (errors.length) { failN++; console.error("✗ استثناءات في الصفحة:\n  " + errors.join("\n  ")); }
    console.log((failN ? "✗" : "✓") + " family C203–C205: " + pass + " passed, " + failN + " failed");
    process.exitCode = failN ? 1 : 0;
  } finally { await browser.close(); server.close(); }
});
