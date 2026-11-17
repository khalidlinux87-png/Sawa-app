// C332/C333: تنزيل الوسائط قطعةً قطعة — يُستخرج الكود الحقيقيّ من sawa-chat.js ويُشغَّل على Firestore وهميّ ببياناتٍ ثنائيّة حقيقيّة
// الاستعمال: node .claude/tools/media.test.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, "../../sawa-chat.js"), "utf8");
const grab = (start, end) => { const i = src.indexOf(start), j = src.indexOf(end, i); if (i < 0 || j < 0) throw new Error("not found: " + start); return src.slice(i, j); };
const code = grab("  function withTimeout(", "  function idb()") + grab("  function b64ToBlob(", "  function dataUrlToBlob(") +
  grab("  var mediaPct = {};", "  // C140:");
let chunkMs = 3, hang = new Set(), missing = new Set(), calls = [], inflight = 0, maxIn = 0, deny = false, metaDoc = null, chunks = [];
const setData = (bytes, size) => { const b64 = Buffer.from(bytes).toString("base64"); chunks = []; for (let i = 0; i < b64.length; i += size) chunks.push(b64.slice(i, i + size)); metaDoc = { n: chunks.length, mime: "video/mp4" }; };
const chunkDoc = (k) => ({ get: () => { calls.push(k); inflight++; maxIn = Math.max(maxIn, inflight);
  return new Promise((res) => { if (hang.has(k)) return; setTimeout(() => { inflight--; res({ exists: !missing.has(k) && k < chunks.length, data: () => ({ d: chunks[k] }) }); }, chunkMs); }); } });
const metaRef = { get: () => deny ? Promise.reject(Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" })) : Promise.resolve({ exists: !!metaDoc, data: () => metaDoc }),
  collection: () => ({ doc: (k) => chunkDoc(Number(k)), get: () => Promise.resolve({ forEach: (f) => chunks.forEach((d, k) => f({ id: String(k), data: () => ({ d }) })) }) }) };
const fsdbMock = () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => metaRef }) }) }) });
let tokCalls = 0, r2Hits = [], r2Status = 200, r2Bytes = null;
const callMock = (op) => { tokCalls++; return op === "media.tok" ? Promise.resolve({ r2: true, q: "?u=a&e=1&s=x", exp: Date.now() + 86400000 }) : Promise.reject(new Error("op")); };
global.fetch = async (u) => { r2Hits.push(u); return new Response(r2Status === 200 ? r2Bytes : "{}", { status: r2Status, headers: { "Content-Length": String(r2Status === 200 ? r2Bytes.length : 2), "Content-Type": "video/mp4" } }); };
const api = new Function("fsdb", "call", "L", code + "; return { fetchMedia, fetchByMeta, chunkCache, r2Kind };")(fsdbMock, callMock, (a) => a);
const realST = setTimeout; global.setTimeout = (f, ms, ...a) => realST(f, ms >= 30000 ? 60 : ms, ...a);   // مهلات 30/45 ث ⇒ 60 مللي ث للاختبار
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗ " + m); } };
const same = async (blob, bytes) => Buffer.compare(Buffer.from(await blob.arrayBuffer()), Buffer.from(bytes)) === 0;
(async () => {
  const vid = crypto.randomBytes(3 * 1024 * 1024 + 17);   // ~3 ميغابايت ⇒ 6 قطع، والأخيرة ناقصة بحشو =
  setData(vid, 700000);
  let pcts = []; const b = await api.fetchMedia("c", "v1", (p) => pcts.push(p));
  ok(await same(b, vid), "bytes identical after per-chunk decode");
  ok(b.type === "video/mp4", "mime from meta (" + b.type + ")");
  ok(maxIn <= 4 && maxIn >= 2, "parallel, at most 4 (max " + maxIn + ")");
  ok(pcts[0] === 0 && pcts[pcts.length - 1] === 100, "progress 0 → 100 (" + pcts.join(",") + ")");
  ok(!api.chunkCache["c:v1"], "cache cleared after success");
  hang = new Set([4]); calls = [];
  let err = null; try { await api.fetchMedia("c", "v2", () => {}); } catch (e) { err = e.message; }
  ok(err === "timeout", "stalled chunk → timeout (" + err + ")");
  const kept = (api.chunkCache["c:v2"] || { b: [] }).b.filter((x) => x != null).length;
  ok(kept >= metaDoc.n - 1, "downloaded chunks kept (" + kept + "/" + metaDoc.n + ")");
  hang = new Set(); calls = []; pcts = [];
  const b2 = await api.fetchMedia("c", "v2", (p) => pcts.push(p));
  ok(calls.length === metaDoc.n - kept, "retry fetched only missing (" + calls.length + ")");
  ok(await same(b2, vid), "retry result identical");
  missing = new Set([2]); err = null; try { await api.fetchMedia("c", "v3"); } catch (e) { err = e.message; } missing = new Set();
  ok(err === "incomplete", "missing chunk → incomplete (" + err + ")");
  const odd = crypto.randomBytes(5000); setData(odd, 1001);   // قطعٌ بطولٍ ليس مضاعفاً لـ4 ⇒ مسار الاحتياط
  ok(await same(await api.fetchMedia("c", "v4"), odd), "chunks not multiple of 4 → fallback still exact");
  const old = crypto.randomBytes(4000); setData(old, 700000); metaDoc = { mime: "image/jpeg" };   // وثيقةٌ قديمة بلا n
  ok(await same(await api.fetchMedia("c", "v5"), old), "old meta without n → single query, exact");
  setData(vid, 700000); deny = true;
  const b6 = await api.fetchByMeta(metaRef, "st:v6", "video/mp4", () => {}); deny = false;
  ok(await same(b6, vid) && b6.type === "video/mp4", "meta read denied (old rules) → falls back, exact, mime kept");
  metaDoc = null; err = null; try { await api.fetchMedia("c", "v7"); } catch (e) { err = e.message; }
  ok(err === "gone", "deleted media → gone (" + err + ")");
  // C334: الوسيط في R2 — وثيقة الوسيط r2:true ⇒ ملفٌّ ثنائيّ من الرابط الموقَّع بنسبة تنزيل، بلا قراءة القطع
  r2Bytes = crypto.randomBytes(2 * 1024 * 1024 + 5); metaDoc = { r2: true, mime: "video/mp4", n: 0, done: true }; calls = []; pcts = [];
  const r1 = await api.fetchMedia("cc1", "fr2a", (p) => pcts.push(p));
  ok(await same(r1, r2Bytes) && r1.type === "video/mp4", "r2: bytes identical, mime kept");
  ok(calls.length === 0, "r2: no chunk reads (" + calls.length + ")");
  ok(r2Hits.length === 1 && /\/m\/cc1\/fr2a\?u=a&e=1&s=x$/.test(r2Hits[0]), "r2: signed URL (" + r2Hits[0] + ")");
  ok(pcts.length > 0 && pcts[pcts.length - 1] >= 90, "r2: progress reported (" + pcts.slice(-3).join(",") + ")");
  api.r2Kind["fr2b"] = { type: "image", mime: "image/jpeg" }; metaDoc = null; r2Hits = [];
  const r2b = await api.fetchMedia("cc1", "fr2b");
  ok(await same(r2b, r2Bytes) && r2b.type === "image/jpeg" && tokCalls === 1, "r2: known from the message ⇒ no meta read, token reused (tok " + tokCalls + ")");
  r2Status = 404; err = null; try { await api.fetchMedia("cc1", "fr2b"); } catch (e) { err = e.message; }
  ok(err === "gone", "r2: 404 → gone (" + err + ")");
  console.log(fail ? "✗ media C333: " + fail + " failed, " + pass + " passed" : "✓ media C333: " + pass + " passed, 0 failed");
  process.exit(fail ? 1 : 0);
})();
