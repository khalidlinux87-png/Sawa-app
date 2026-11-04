// ESLint (قواعد الصحّة فقط — لا أسلوب): يكشف المعرّفات غير المعرّفة والمفاتيح المكرّرة والتعريف المزدوج وما شابه.
// يفحصه lint.sh على: الحزمة المجمَّعة app.p1…p9 (تُنفَّذ نصّاً واحداً في الصفحة) · sawa-*.js · sw.js
const browser = ("window document navigator location localStorage sessionStorage console fetch setTimeout clearTimeout setInterval clearInterval " +
  "requestAnimationFrame cancelAnimationFrame queueMicrotask structuredClone reportError Promise URL URLSearchParams Blob File FileReader FormData " +
  "Image Audio Option Notification WebSocket EventSource crypto atob btoa TextEncoder TextDecoder indexedDB IDBKeyRange caches self globalThis " +
  "alert confirm prompt open close print performance history screen getComputedStyle matchMedia getSelection scrollTo innerWidth innerHeight " +
  "devicePixelRatio visualViewport addEventListener removeEventListener dispatchEvent postMessage parent top opener frames name status origin " +
  "isSecureContext MutationObserver ResizeObserver IntersectionObserver PerformanceObserver Event CustomEvent EventTarget AbortController AbortSignal " +
  "DOMException Headers Request Response ReadableStream WritableStream TransformStream CompressionStream DecompressionStream BroadcastChannel " +
  "MessageChannel MessageEvent Worker XMLHttpRequest DOMParser XMLSerializer ImageData ImageBitmap createImageBitmap OffscreenCanvas Path2D " +
  "DataTransfer ClipboardItem MediaMetadata CSS FontFace HTMLElement HTMLCanvasElement HTMLVideoElement HTMLImageElement HTMLAudioElement " +
  "HTMLMediaElement HTMLInputElement HTMLTextAreaElement Element Node NodeFilter Text Range Document DocumentFragment SVGElement KeyboardEvent " +
  "PointerEvent TouchEvent MouseEvent RTCPeerConnection RTCSessionDescription RTCIceCandidate RTCRtpSender RTCRtpReceiver MediaStream " +
  "MediaStreamTrack MediaRecorder AudioContext webkitAudioContext OfflineAudioContext AudioWorkletNode SpeechSynthesisUtterance speechSynthesis " +
  "PushManager BarcodeDetector PublicKeyCredential VideoFrame VideoDecoder VideoEncoder ImageDecoder WebAssembly Intl WeakRef FinalizationRegistry " +
  "escape unescape event").split(/\s+/);
const sw = "clients registration skipWaiting importScripts Clients Client WindowClient ExtendableEvent FetchEvent PushEvent NotificationEvent".split(" ");
// مكتبات CDN والوحدات التي تعرّفها ملفّات التطبيق نفسها (تُحمَّل قبل/بعد بعضها في index.html)
const app = "React ReactDOM firebase google SawaAuth SawaSync SawaChat SawaRTC SawaCore SawaLog SawaApp Android".split(" ");
const g = Object.fromEntries([...browser, ...sw, ...app].filter(Boolean).map((k) => [k, "readonly"]));

const rules = {
  "no-undef": "error", "no-dupe-keys": "error", "no-dupe-args": "error", "no-duplicate-case": "error", "no-dupe-else-if": "error",
  "no-redeclare": ["error", { builtinGlobals: false }],   // الواجهة تسمّي أيقوناتٍ Lock/Image (lucide) عمداً
  "no-self-assign": "error", "no-self-compare": "error", "no-unsafe-negation": "error", "use-isnan": "error", "valid-typeof": "error",
  "no-compare-neg-zero": "error", "no-unsafe-finally": "error", "no-unsafe-optional-chaining": "error", "no-loss-of-precision": "error",
  "no-const-assign": "error", "no-func-assign": "error", "no-class-assign": "error", "no-obj-calls": "error", "getter-return": "error",
  "no-setter-return": "error", "no-shadow-restricted-names": "error", "no-empty-character-class": "error", "no-invalid-regexp": "error",
  "for-direction": "error", "no-new-native-nonconstructor": "error", "no-constructor-return": "error",
  // تحذيرات (أنماطٌ مقصودة أحياناً: «false && …» لإخفاء قسم، «while ((m = re.exec()))»)
  "no-constant-binary-expression": "warn", "no-cond-assign": ["warn", "except-parens"], "no-unreachable": "warn", "no-fallthrough": "warn",
  "no-sparse-arrays": "warn", "no-unused-labels": "warn", "no-async-promise-executor": "warn", "array-callback-return": "warn",
  "no-unmodified-loop-condition": "warn", "no-useless-backreference": "warn", "no-misleading-character-class": "warn",
};
// الشيفرة تحمل تعليقات «eslint-disable-next-line react-hooks/exhaustive-deps» من مصدرها الأصليّ — قاعدةٌ صمّاء تقبلها
const reactHooksStub = { rules: { "exhaustive-deps": { create: () => ({}) }, "rules-of-hooks": { create: () => ({}) } } };
export default [
  { files: ["**/*.js"], plugins: { "react-hooks": reactHooksStub }, linterOptions: { reportUnusedDisableDirectives: "off" }, languageOptions: { sourceType: "script", ecmaVersion: "latest", globals: g }, rules },
];
