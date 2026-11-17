const fs = require("fs");
// C332: تنزيل الوسائط قطعةً قطعة — يُستخرج fetchMedia الحقيقيّ من sawa-chat.js ويُشغَّل على Firestore وهميّ
// الاستعمال: node .claude/tools/media.test.js
const path = require("path");
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, "../../sawa-chat.js"), "utf8");
const grab = (start, endMarker) => { const i = src.indexOf(start); const j = src.indexOf(endMarker, i); if (i < 0 || j < 0) throw new Error("not found " + start); return src.slice(i, j); };
const wt = grab("  function withTimeout(", "  function idb()");
const fm = grab("  var mediaParts = {}, mediaPct = {};", "  // C140:");
let chunkMs = 5, hang = new Set(), missing = new Set(), calls = [], inflight = 0, maxIn = 0, meta = { n: 12, mime: "image/jpeg" }, oldFmt = false;
const mkDoc = (k) => ({ get: () => { calls.push(k); inflight++; maxIn = Math.max(maxIn, inflight);
  return new Promise((res) => { if (hang.has(k)) return; setTimeout(() => { inflight--; res({ exists: !missing.has(k), data: () => ({ d: "<" + k + ">" }) }); }, chunkMs); }); } });
const fsdbMock = () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: (mid) => ({
  get: () => Promise.resolve({ exists: true, data: () => (oldFmt ? { mime: meta.mime } : meta) }),
  collection: () => ({ doc: (k) => mkDoc(Number(k)), get: () => Promise.resolve({ forEach: (f) => { for (let k = 0; k < 3; k++) f({ id: String(k), data: () => ({ d: "<" + k + ">" }) }); } }) }) }) }) }) }) });
const fn = new Function("fsdb", "b64ToBlob", wt + fm + "; return { fetchMedia, mediaParts, withTimeout };");
const api = fn(fsdbMock, (s, mime) => ({ s, mime }));
// speed up the 45 s per-chunk timeout for the stall test
const realST = setTimeout; global.setTimeout = (f, ms, ...a) => realST(f, ms >= 30000 ? 60 : ms, ...a);
let fail = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++; };
(async () => {
  let pcts = []; const b = await api.fetchMedia("c", "m1", (p) => pcts.push(p));
  ok(b.s === Array.from({ length: 12 }, (_, k) => "<" + k + ">").join(""), "12 chunks joined in order");
  ok(maxIn <= 4 && maxIn >= 2, "parallel, at most 4 at once (max " + maxIn + ")");
  ok(pcts[0] === 0 && pcts[pcts.length - 1] === 100, "progress 0 → 100 (" + pcts.join(",") + ")");
  ok(!api.mediaParts.m1, "parts cleared after success");
  calls = []; hang = new Set([7]);
  let err = null; try { await api.fetchMedia("c", "m2", () => {}); } catch (e) { err = e.message; }
  ok(err === "timeout", "stalled chunk → timeout error (" + err + ")");
  const kept = api.mediaParts.m2 ? api.mediaParts.m2.d.filter((x) => typeof x === "string").length : 0;
  ok(kept >= 8, "downloaded chunks kept for retry (" + kept + "/12)");
  hang = new Set(); calls = []; pcts = [];
  const b2 = await api.fetchMedia("c", "m2", (p) => pcts.push(p));
  ok(calls.length === 12 - kept, "retry fetched only the " + (12 - kept) + " missing chunks (fetched " + calls.length + ")");
  ok(b2.s.startsWith("<0><1>") && b2.s.endsWith("<11>"), "retry result complete");
  ok(pcts[0] === Math.round(kept * 100 / 12), "retry progress starts where it left off (" + pcts[0] + "%)");
  missing = new Set([3]); err = null; try { await api.fetchMedia("c", "m3"); } catch (e) { err = e.message; }
  ok(err === "incomplete", "missing chunk → incomplete (" + err + ")"); missing = new Set();
  oldFmt = true; const b3 = await api.fetchMedia("c", "m4"); oldFmt = false;
  ok(b3.s === "<0><1><2>", "old format without n uses the single query");
  console.log(fail ? "✗ media C332: " + fail + " failed" : "✓ media C332: 11 passed, 0 failed"); process.exit(fail ? 1 : 0);
})();
