function t(key, params) {
    let s;
    if (isRTL() === false) s = __SAWA_STRINGS_EN[key];
    if (s == null) s = __SAWA_STRINGS[key];
    if (s == null)
        return key;
    if (params)
        Object.keys(params).forEach(k => { s = s.replace(new RegExp('{' + k + '}', 'g'), params[k]); });
    return s;
}
function setLocale(lang) { try {
    window.__SAWA_LANG = lang;
    localStorage.setItem("sawaLang", lang);
    // اتجاه المستند نفسه — يؤثر على مربعات الإدخال والتمرير
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === "en") ? "ltr" : "rtl";
    window.dispatchEvent(new CustomEvent("sawa-lang", { detail: lang }));
}
catch (e) { } }
// ─── direction helpers ─────────────────────────────────────────
function isRTL() { try {
    return (window.__SAWA_LANG || "ar") !== "en";
}
catch (e) {
    return true;
} }
// وسم اللغة لتنسيق التواريخ والأوقات والأرقام. كان "ar-SD" مثبَّتاً في
// 117 موضعاً، فكانت الأرقام والتواريخ تبقى عربية في الواجهة الإنجليزية.
function loc() { return isRTL() ? "ar-SD" : "en-GB"; }
// لا تُغيّر هاتين الدالتين. جُرّب قلبهما في 3 سبتمبر فانقلب الشريط
// السفلي وترويسة استكشف وبطاقات صلة الرحم — أي أن 616 موضعاً تعتمد
// على هذا السلوك وهي صحيحة. الخلل كان في صفَّي قائمة المحادثات وحدهما
// (كُتبا بترتيب معكوس في الترميز) وأُصلحا موضعياً بـ flex-row صريحة.
const rowStart = () => isRTL() ? 'flex-row-reverse' : 'flex-row';
const rowEnd = () => isRTL() ? 'flex-row' : 'flex-row-reverse';
const textStart = () => isRTL() ? 'text-right' : 'text-left';
const textEnd = () => isRTL() ? 'text-left' : 'text-right';
const ms = (n) => isRTL() ? `mr-${n}` : `ml-${n}`;
const me = (n) => isRTL() ? `ml-${n}` : `mr-${n}`;
const ps = (n) => isRTL() ? `pr-${n}` : `pl-${n}`;
const pe = (n) => isRTL() ? `pl-${n}` : `pr-${n}`;
const flipIcon = () => isRTL() ? { transform: 'scaleX(-1)' } : undefined;
// ──────────────────────────────────────────────────────────────
// ============================================================
// ⚙️ إعدادات جمع الملاحظات — عدّل هنا فقط
// ============================================================
// رقم الواتساب الذي تصل عليه ملاحظات المجرِّبين.
// الصيغة: رمز الدولة بلا + وبلا أصفار بادئة، ثم الرقم.
//   السودان: 249 ثم الرقم بلا الصفر  →  "249912345678"
//   السعودية: 966 ثم الرقم بلا الصفر →  "966501234567"
// اتركه فارغاً "" لتعطيل واتساب واستعمال مشاركة النظام العامة.
const FEEDBACK_WHATSAPP = "447478682670";
// اسم النسخة يُرسَل مع كل ملاحظة — يميّز بلاغات النسخ القديمة
const APP_VERSION = "v17";
// ============================================================
// طبقة المنصّة — كل نداءات المتصفح تمر من هنا.
// عند الانتقال لـ React Native تُستبدل هذه الدوال الثلاث فقط:
//   copyText  → Clipboard.setString
//   shareText → Share.share
//   saveTextFile → RNFS.writeFile + Share.open
// ============================================================
function copyText(text) {
    var _a;
    // تُرجع Promise دائماً حتى تعمل .then/.await في كل مواضع الاستدعاء
    try {
        const p = (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(text);
        return p && typeof p.then === "function" ? p.catch(() => { }) : Promise.resolve();
    }
    catch (_b) {
        return Promise.resolve();
    }
}
function shareText(payload) {
    try {
        if (navigator.share) {
            navigator.share(payload);
            return true;
        }
    }
    catch (_a) { }
    copyText((payload === null || payload === void 0 ? void 0 : payload.text) || (payload === null || payload === void 0 ? void 0 : payload.url) || "");
    return false;
}
function saveTextFile(filename, content) {
    try {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    }
    catch (_a) {
        return false;
    }
}
// ============================================================
// التخزين الدائم — طبقة واحدة تُستبدل بـ AsyncStorage في React Native
// ============================================================
const SAWA_STORE_PREFIX = "sawa:";
function loadPersisted(key, fallback) {
    var _a;
    try {
        const raw = (_a = window.localStorage) === null || _a === void 0 ? void 0 : _a.getItem(SAWA_STORE_PREFIX + key);
        if (raw == null)
            return fallback;
        const parsed = JSON.parse(raw);
        // نرفض أي بيانات محفوظة بشكل مخالف للمتوقَّع (نسخة قديمة أو تالفة)
        if (Array.isArray(fallback) && !Array.isArray(parsed))
            return fallback;
        if (fallback && typeof fallback === "object" && !Array.isArray(fallback)
            && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)))
            return fallback;
        if (typeof fallback === "boolean" && typeof parsed !== "boolean")
            return fallback;
        return parsed;
    }
    catch (_b) {
        return fallback;
    }
}
// محتوى الوسائط (base64) لا يُحفظ أبداً: صورة واحدة تتجاوز سعة التخزين كلها،
// فيفشل الحفظ وتضيع المحادثات. نحفظ البيانات الوصفية فقط ونضع علامة على المفقود.
// عند الانتقال لـ RN تُستبدل هذه بروابط ملفات على الخادم.
function stripMediaPayload(value) {
    if (Array.isArray(value))
        return value.map(stripMediaPayload);
    if (value && typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) {
            if (k === "fileUrl" || k === "dataUrl" || k === "photoData") {
                if (value[k])
                    out.mediaDropped = true;
                out[k] = null;
            }
            else {
                out[k] = stripMediaPayload(value[k]);
            }
        }
        return out;
    }
    return value;
}
let storageWarned = false;
function savePersisted(key, value) {
    var _a;
    try {
        const safe = key === "messages" || key === "groupMessages" || key === "momentsPosts"
            ? stripMediaPayload(value)
            : value;
        (_a = window.localStorage) === null || _a === void 0 ? void 0 : _a.setItem(SAWA_STORE_PREFIX + key, JSON.stringify(safe));
        return true;
    }
    catch (e) {
        // التخزين ممتلئ أو محظور — لا ننهار، لكن لا نصمت أيضاً
        if (!storageWarned) {
            storageWarned = true;
            console.warn("سوا: تعذّر حفظ «" + key + "» — التخزين ممتلئ أو محظور.", e);
            try {
                window.dispatchEvent(new CustomEvent("sawa:storage-full", { detail: { key } }));
            }
            catch (_b) { }
        }
        return false;
    }
}
// مثل useState لكن يحفظ تلقائياً ويستعيد عند التشغيل.
// الحفظ مؤجَّل (debounce) حتى لا نكتب للتخزين مع كل ضغطة مفتاح.
function usePersistedState(key, initialValue, delay = 400) {
    const [value, setValue] = useState(() => loadPersisted(key, initialValue));
    const timer = useRef(null);
    const latest = useRef(value);
    latest.current = value;
    useEffect(() => {
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => savePersisted(key, latest.current), delay);
        return () => { if (timer.current)
            clearTimeout(timer.current); };
    }, [key, value, delay]);
    // نضمن الحفظ عند إغلاق الصفحة قبل انتهاء المهلة
    useEffect(() => {
        const flush = () => savePersisted(key, latest.current);
        window.addEventListener("pagehide", flush);
        return () => {
            window.removeEventListener("pagehide", flush);
            flush();
        };
    }, [key]);
    return [value, setValue];
}
// ============================================================
// ErrorBoundary — يمنع انهيار التطبيق كاملاً عند خطأ في أي مكوّن
// ============================================================
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("خطأ في سوا:", error, info === null || info === void 0 ? void 0 : info.componentStack);
    }
    render() {
        var _a;
        if (!this.state.error)
            return this.props.children;
        return (React.createElement("div", { style: {
                position: "fixed", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 28,
                backgroundColor: "#F7F8FA", direction: "rtl", fontFamily: "inherit",
            } },
            React.createElement("div", { style: {
                    width: 64, height: 64, borderRadius: 32, display: "flex",
                    alignItems: "center", justifyContent: "center", marginBottom: 18,
                    backgroundColor: "#EF444422",
                } },
                React.createElement("span", { style: { fontSize: 30 } }, "\u26A0\uFE0F")),
            React.createElement("p", { style: { fontWeight: 800, fontSize: 17, color: "#0F172A", marginBottom: 8 } }, t("hsl_khta_ghyr_mtwqa")),
            React.createElement("p", { style: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 1.7, marginBottom: 22, maxWidth: 300 } }, t("byanatk_mhfwza_jrb_alawda")),
            React.createElement("div", { style: { display: "flex", flexDirection: "row-reverse", gap: 10, flexWrap: "wrap", justifyContent: "center" } },
                React.createElement("button", { onClick: () => {
                        try {
                            Object.keys(window.localStorage || {})
                                .filter((k) => k.startsWith(SAWA_STORE_PREFIX))
                                .forEach((k) => window.localStorage.removeItem(k));
                        }
                        catch (_a) { }
                        window.location.reload();
                    }, style: { padding: "11px 22px", borderRadius: 14, border: "none", backgroundColor: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 13 } }, t("msh_albyanat_wiaada_altshghyl")),
                React.createElement("button", { onClick: () => this.setState({ error: null }), style: { padding: "11px 22px", borderRadius: 14, border: "none", backgroundColor: "#1E88E5", color: "#fff", fontWeight: 800, fontSize: 13 } }, t("almhawla_mra_akhra")),
                React.createElement("button", { onClick: () => window.location.reload(), style: { padding: "11px 22px", borderRadius: 14, border: "1px solid #CBD5E1", backgroundColor: "transparent", color: "#475569", fontWeight: 700, fontSize: 13 } }, t("iaada_altshghyl"))),
            React.createElement("details", { style: { marginTop: 26, maxWidth: 320, width: "100%" } },
                React.createElement("summary", { style: { fontSize: 11, color: "#94A3B8", cursor: "pointer", textAlign: "center" } }, t("tfasyl_tqnya")),
                React.createElement("pre", { style: {
                        fontSize: 10, color: "#64748B", backgroundColor: "#E2E8F0", padding: 10,
                        borderRadius: 10, marginTop: 8, overflow: "auto", maxHeight: 130,
                        whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left",
                    } }, String(((_a = this.state.error) === null || _a === void 0 ? void 0 : _a.message) || this.state.error)))));
    }
}
// رابط الدعوة — معرَّف في sawa-core.js (إعدادات النشر).
// القيمة الاحتياطية للحالة التي يُحمَّل فيها هذا الملف وحده.
const SAWA_INVITE_URL = window.SAWA_INVITE_URL || "https://sawasilat.netlify.app";
const APP_LOGO_RAHIM = "./icons/icon-192.png"; // ⛔ مسار لا نصّ
const SAWA_LOGO = "data:image/png;base64,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";
// ============================================================================
// نظام الثيم (نفس بنية سوا/صلة الرحم بالضبط)
// ============================================================================
// 4 مظاهر قابلة للتبديل — نفس القيم الموثّقة رسمياً بمستند سوا
const ACCENT_THEMES = {
    sawa: { labelKey: "acc_swa", accent: "#2F80C8", accentDark: "#1E3A63", accentTint: "#BFE0F5" },
    orange: { labelKey: "acc_brtqaly", accent: "#E8823D", accentDark: "#B5602B", accentTint: "#FBD9BA" },
    purple: { labelKey: "acc_bnfsjy", accent: "#8B5FA8", accentDark: "#5F3F78", accentTint: "#E3D3ED" },
    navy: { labelKey: "acc_khly", accent: "#1E3A63", accentDark: "#132743", accentTint: "#C7D4E3" },
    // مستخلَصة من شعار أرحام نفسه: أخضره وزيتيّه. افتراض أرحام، وخيارٌ في سوا.
    green: { labelKey: "acc_akhdr", accent: "#187854", accentDark: "#0C4854", accentTint: "#CFE9DD" },
};
const lightColors = {
    primary: "#2F80C8", primaryDark: "#1E3A63", primaryLight: "#BFE0F5",
    accent: "#D98E04", danger: "#C0392B", success: "#1B7A43",
    bg: "#F5F7FA", card: "#FFFFFF", text: "#111827", textMuted: "#6B7280", border: "#E2E5E9",
};
const darkColors = {
    primary: "#5AA9E6", primaryDark: "#2F5C8F", primaryLight: "#173049",
    accent: "#E8A93D", danger: "#E5695C", success: "#5CD692",
    bg: "#0E1116", card: "#171B21", text: "#EDEFF2", textMuted: "#8A93A0", border: "#262B33",
};
const ThemeContext = createContext(null);
const ToastContext = createContext(null);
function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    function showToast(message, type = "success") {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }
    return (React.createElement(ToastContext.Provider, { value: { showToast } },
        children,
        React.createElement(ToastHost, { toasts: toasts })));
}
function ToastHost({ toasts }) {
    const { colors } = useTheme();
    if (toasts.length === 0)
        return null;
    return (React.createElement("div", { className: "absolute bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none" }, toasts.map((toast) => (React.createElement("div", { key: toast.id, className: `rounded-full px-4 py-2 text-xs font-bold shadow-lg flex ${rowStart()} items-center gap-1.5`, style: {
            backgroundColor: toast.type === "error" ? colors.danger : colors.success,
            color: "#fff",
        } },
        toast.type === "error" ? React.createElement(AlertCircle, { size: 13, color: "#fff" }) : React.createElement(Check, { size: 13, color: "#fff" }),
        toast.message)))));
}
function SkeletonBox({ height = 16, width = "100%", rounded = "rounded-md" }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `${rounded} animate-pulse`, style: { height, width, backgroundColor: colors.border, opacity: 0.5 } }));
}
const useTheme = () => useContext(ThemeContext);
// ============================================================================
// مكوّنات مشتركة
// ============================================================================
function Card({ children, style, className = "" }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `rounded-2xl border p-3 ${className}`, style: { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10, ...style } }, children));
}
function Button({ label, icon: Icon, onPress, variant = "filled", disabled, className = "" }) {
    const { colors } = useTheme();
    const filled = variant === "filled";
    return (React.createElement("button", { onClick: onPress, disabled: disabled, className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-extrabold transition-transform active:scale-[0.98] ${className}`, style: {
            backgroundColor: filled ? colors.primary : colors.card,
            color: filled ? "#fff" : colors.primary,
            border: filled ? "none" : `1.5px solid ${colors.primary}`,
            opacity: disabled ? 0.5 : 1,
            boxShadow: filled && !disabled ? `0 4px 14px ${colors.primary}40` : "none",
        } },
        Icon && React.createElement(Icon, { size: 18 }),
        " ",
        label));
}
function Badge({ label, variant = "neutral", icon: Icon, size = "md" }) {
    const { isDark } = useTheme();
    const variants = {
        danger: { bg: isDark ? "#4A2420" : "#FBE9E7", fg: isDark ? "#FF8A7A" : "#C0392B" },
        warning: { bg: isDark ? "#4A3714" : "#FCEFD6", fg: isDark ? "#F2B953" : "#B8720A" },
        success: { bg: isDark ? "#173A26" : "#E3F3EA", fg: isDark ? "#5CD692" : "#1B7A43" },
        neutral: { bg: isDark ? "#232F2A" : "#F7F8FA", fg: isDark ? "#8FA39C" : "#6B7280" },
    };
    const v = variants[variant] || variants.neutral;
    const small = size === "sm";
    return (React.createElement("span", { className: `inline-flex ${rowStart()} items-center rounded-full font-bold ${small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"}`, style: { backgroundColor: v.bg, color: v.fg } },
        Icon && React.createElement(Icon, { size: small ? 10 : 12, className: `${ms("1")}` }),
        label));
}
function NumericAmountInput({ value, onChange, placeholder, className, style }) {
    const ref = useRef(null);
    function handleChange(e) {
        const rawCursor = e.target.selectionStart;
        const before = e.target.value.slice(0, rawCursor);
        // نحسب كم رقماً فعلياً قبل موضع المؤشر (بعد تصفية أي حرف غير رقمي)
        const digitsBeforeCursor = (before.match(/\d/g) || []).length;
        const filtered = e.target.value.replace(/\D/g, "");
        onChange(filtered);
        // نُعيد موضع المؤشر لمكانه الصحيح بعد إعادة الرسم — يمنع القفز
        // للنهاية أو التكرار الظاهري أثناء الكتابة بلوحات المفاتيح العربية
        requestAnimationFrame(() => {
            if (ref.current)
                ref.current.setSelectionRange(digitsBeforeCursor, digitsBeforeCursor);
        });
    }
    return (React.createElement("input", { ref: ref, dir: "ltr", value: value, onChange: handleChange, placeholder: placeholder, inputMode: "numeric", className: className, style: style }));
}
function Chip({ label, active, onPress, disabled = false }) {
    const { colors } = useTheme();
    return (React.createElement("button", { onClick: disabled ? undefined : onPress, disabled: disabled, className: "rounded-full text-xs px-3.5 py-2 border mb-2 whitespace-nowrap shrink-0", style: {
            backgroundColor: active ? colors.primary : colors.card,
            borderColor: active ? colors.primary : colors.border,
            color: active ? "#fff" : (disabled ? colors.textMuted : colors.text),
            fontWeight: active ? 700 : 400,
            opacity: disabled ? 0.45 : 1,
        } }, label));
}
function PinDots({ length = 6, filled = 0, error = false }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex justify-center my-6 gap-3" }, Array.from({ length }).map((_, i) => (React.createElement("div", { key: i, className: "w-4 h-4 rounded-full border-2", style: {
            borderColor: error ? colors.danger : colors.primary,
            backgroundColor: i < filled ? (error ? colors.danger : colors.primary) : "transparent",
        } })))));
}
function PinKeypad({ onDigit, onBackspace, onBiometric, showBiometric }) {
    const { colors } = useTheme();
    const keys = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["bio", "0", "back"]];
    return (React.createElement("div", { className: "flex flex-col items-center pb-4" }, keys.map((row, i) => (React.createElement("div", { key: i, className: "flex" }, row.map((k) => {
        if (k === "bio") {
            return (React.createElement("button", { key: k, onClick: onBiometric, disabled: !showBiometric, className: "w-16 h-16 rounded-full flex items-center justify-center m-2" }, showBiometric && React.createElement(Fingerprint, { size: 24, color: colors.primary })));
        }
        if (k === "back") {
            return (React.createElement("button", { key: k, onClick: onBackspace, className: "w-16 h-16 rounded-full flex items-center justify-center m-2" },
                React.createElement(Delete, { size: 20, color: colors.text })));
        }
        return (React.createElement("button", { key: k, onClick: () => onDigit(k), className: "w-16 h-16 rounded-full flex items-center justify-center m-2 text-2xl font-semibold", style: { color: colors.text } }, k));
    }))))));
}
function EmptyState({ icon: Icon, label }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex flex-col items-center justify-center py-16 px-6" },
        React.createElement(Icon, { size: 30, color: colors.border }),
        React.createElement("p", { className: "text-xs text-center mt-2", style: { color: colors.textMuted } }, label)));
}
function TopBar({ title, subtitle, onBack, actions, avatar }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `flex items-center px-4 pt-10 pb-3 ${rowStart()}`, style: { backgroundColor: colors.primary } },
        onBack && React.createElement("button", { onClick: onBack, className: `${ms("2")}` },
            React.createElement(ChevronLeft, { color: "#fff", size: 22 })),
        // الأفاتار داخل كتلة الاسم لا شقيقاً لها، وإلا انفصل عنه في الصف المعكوس.
        // avatar: true = الحرف الأول من العنوان، أو نص مخصّص.
        // justify-end يجمع النص والأفاتار معاً عند طرف واحد بدل تباعدهما عبر
        // المنتصف. لا يعتمد على اتجاه الصف، فيصحّ في الحالتين.
        React.createElement("div", { className: `flex-1 min-w-0 flex items-center justify-end gap-2 ${me("3")}` },
            React.createElement("div", { className: `min-w-0 ${textStart()}` },
                React.createElement("h1", { className: "text-white text-sm font-bold truncate" }, title),
                subtitle && React.createElement("p", { className: "text-[10px] truncate", style: { color: "#ffffffcc" } }, subtitle)),
            avatar && React.createElement("div", { className: "w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-sm", style: { backgroundColor: "rgba(255,255,255,0.22)", color: "#fff" } }, ((avatar === true ? title : avatar) || "?").charAt(0))),
        React.createElement("div", { className: "shrink-0" }, actions)));
}
function generateRecoveryCodes() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => {
        let code = "";
        for (let i = 0; i < 8; i++) {
            if (i === 4)
                code += "-";
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    });
}
// ============================================================================
// شاشة إعداد PIN
// ============================================================================
function SetupPinScreen({ onDone }) {
    const { colors } = useTheme();
    const [step, setStep] = useState("enter");
    const [firstPin, setFirstPin] = useState("");
    const [pin, setPin] = useState("");
    const [mismatch, setMismatch] = useState(false);
    const [codes, setCodes] = useState([]);
    const [confirmed, setConfirmed] = useState(false);
    function handleDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        setMismatch(false);
        if (next.length === 6) {
            if (step === "enter") {
                setFirstPin(next);
                setTimeout(() => { setStep("confirm"); setPin(""); }, 150);
            }
            else {
                if (next === firstPin) {
                    setCodes(generateRecoveryCodes());
                    setStep("codes");
                }
                else {
                    setMismatch(true);
                    setTimeout(() => { setPin(""); setStep("enter"); setFirstPin(""); }, 700);
                }
            }
        }
    }
    if (step === "codes") {
        return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
            React.createElement(Key, { size: 36, color: colors.primary, className: "mx-auto" }),
            React.createElement("h2", { className: "text-lg font-extrabold text-center mt-3", style: { color: colors.text } }, t("rmwz_alastrjaa_alahtyatya")),
            React.createElement("p", { className: "text-xs text-center mt-2 px-2", style: { color: colors.textMuted } }, t("ahfz_hdhh_alrmwz_fy")),
            React.createElement(Card, { style: { marginTop: 16 } }, codes.map((c, i) => (React.createElement("div", { key: i, className: "text-center font-bold my-1 tracking-widest", style: { color: colors.text } }, c)))),
            React.createElement("button", { onClick: () => setConfirmed(!confirmed), className: `flex ${rowStart()} items-center gap-2 justify-center mt-4 mx-auto` },
                React.createElement("div", { className: "w-5 h-5 rounded border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : "transparent" } }, confirmed && React.createElement(Check, { size: 12, color: "#fff" })),
                React.createElement("span", { className: "text-xs", style: { color: colors.text } }, t("hfzt_alrmwz_fy_mkan"))),
            React.createElement("div", { className: "mt-4" },
                React.createElement(Button, { label: t("mtabaa"), onPress: () => onDone(firstPin, codes), disabled: !confirmed }))));
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
            React.createElement(Lock, { size: 30, color: colors.primary }),
            React.createElement("h2", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, step === "enter" ? "أنشئ رمز قفل التطبيق" : "أكّد الرمز"),
            React.createElement("p", { className: "text-xs text-center mt-2 px-8", style: { color: colors.textMuted } }, step === "enter" ? "هذا الرمز يحميك أنت وجميع بيانات التطبيق" : "أدخل نفس الرمز مرة أخرى"),
            React.createElement(PinDots, { filled: pin.length, error: mismatch }),
            mismatch && React.createElement("p", { className: "text-xs font-bold", style: { color: colors.danger } }, t("alrmzan_ghyr_mttabqyn"))),
        React.createElement(PinKeypad, { onDigit: handleDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), showBiometric: false })));
}
// ============================================================================
// شاشة القفل
// ============================================================================
function LockScreen({ onUnlock, onForgot, correctPin, biometricEnabled }) {
    const { colors } = useTheme();
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockMsg, setLockMsg] = useState("");
    function handleDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        if (next.length === 6) {
            if (next === correctPin) {
                onUnlock();
            }
            else {
                const a = attempts + 1;
                setAttempts(a);
                setError(true);
                if (a === 4)
                    setLockMsg("محاولات كثيرة — انتظر 30 ثانية (محاكاة)");
                else if (a >= 5)
                    setLockMsg("محاولات كثيرة — انتظر 5 دقائق (محاكاة)");
                setTimeout(() => { setPin(""); setError(false); }, 500);
            }
        }
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
            React.createElement("div", { className: "w-16 h-16 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.primary } },
                React.createElement("span", { className: "text-white text-xl font-extrabold" }, appName())),
            React.createElement("h2", { className: "text-sm font-bold", style: { color: colors.text } }, t("adkhl_rmz_alqfl")),
            React.createElement(PinDots, { filled: pin.length, error: error }),
            lockMsg && React.createElement("p", { className: "text-xs font-bold text-center px-8", style: { color: colors.danger } }, lockMsg),
            React.createElement("button", { onClick: onForgot, className: "mt-3 text-xs font-bold", style: { color: colors.primary } }, t("nsyt_alrmz"))),
        React.createElement(PinKeypad, { onDigit: handleDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), onBiometric: onUnlock, showBiometric: biometricEnabled })));
}
// ============================================================================
// شاشة نسيت الرمز
// ============================================================================
function ForgotPinScreen({ onBack, onRecovered, validCodes }) {
    const { colors } = useTheme();
    const [step, setStep] = useState("choose");
    const [codeInput, setCodeInput] = useState("");
    const [otpInput, setOtpInput] = useState("");
    const [error, setError] = useState("");
    const [pin, setPin] = useState("");
    const [firstPin, setFirstPin] = useState("");
    const [newPinStep, setNewPinStep] = useState("enter");
    const [mismatch, setMismatch] = useState(false);
    function verifyCode() {
        if (validCodes.includes(codeInput.trim().toUpperCase())) {
            setStep("newPin");
        }
        else {
            setError(t("alrmz_ghyr_shyh_aw"));
        }
    }
    function verifyOtp() {
        if (otpInput === "123456")
            setStep("newPin");
        else
            setError(t("rmz_althqq_ghyr_shyh"));
    }
    function handleNewPinDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        setMismatch(false);
        if (next.length === 6) {
            if (newPinStep === "enter") {
                setFirstPin(next);
                setTimeout(() => { setNewPinStep("confirm"); setPin(""); }, 150);
            }
            else if (next === firstPin) {
                onRecovered(next, generateRecoveryCodes());
            }
            else {
                setMismatch(true);
                setTimeout(() => { setPin(""); setNewPinStep("enter"); }, 700);
            }
        }
    }
    if (step === "newPin") {
        return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
                React.createElement(Lock, { size: 28, color: colors.primary }),
                React.createElement("h2", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, newPinStep === "enter" ? "عيّن رمز جديد" : "أكّد الرمز الجديد"),
                React.createElement(PinDots, { filled: pin.length, error: mismatch })),
            React.createElement(PinKeypad, { onDigit: handleNewPinDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), showBiometric: false })));
    }
    return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
        React.createElement("button", { "aria-label": t("ighlaq"), onClick: onBack, className: "mb-4" },
            React.createElement(X, { size: 20, color: colors.textMuted })),
        step === "choose" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-1", style: { color: colors.text } }, t("astrjaa_alwswl")),
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("akhtr_tryqa_alastrjaa")),
            React.createElement("button", { onClick: () => setStep("code"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Key, { size: 20, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("rmz_astrjaa_ahtyaty")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("adkhl_ahd_alrmwz_alty")))),
            React.createElement("button", { onClick: () => setStep("otp"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Mail, { size: 20, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("rmz_thqq_abr_albryd")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("nrsl_rmza_ila_alqnaa")))),
            React.createElement("button", { onClick: () => setStep("reset"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border`, style: { borderColor: colors.danger, backgroundColor: colors.card } },
                React.createElement(AlertTriangle, { size: 20, color: colors.danger }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.danger } }, t("iaada_tayyn_kamla_mladh")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("ymsh_jmya_albyanat_almhlya")))))),
        step === "code" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-4", style: { color: colors.text } }, t("adkhl_alrmz_alahtyaty")),
            React.createElement("input", { dir: "ltr", value: codeInput, onChange: (e) => setCodeInput(e.target.value.toUpperCase()), placeholder: "XXXX-XXXX", className: "w-full border rounded-xl px-3 py-3 text-center tracking-widest mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            error && React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, error),
            React.createElement(Button, { label: t("thqq"), onPress: verifyCode }))),
        step === "otp" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-1", style: { color: colors.text } }, t("adkhl_rmz_althqq")),
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("jrb_123456_mhakaa")),
            React.createElement("input", { dir: "ltr", value: otpInput, onChange: (e) => setOtpInput(e.target.value), placeholder: "000000", maxLength: 6, className: "w-full border rounded-xl px-3 py-3 text-center tracking-widest mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            error && React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, error),
            React.createElement(Button, { label: t("thqq"), onPress: verifyOtp }))),
        step === "reset" && (React.createElement(React.Fragment, null,
            React.createElement(AlertTriangle, { size: 32, color: colors.danger, className: "mx-auto mb-3" }),
            React.createElement("h2", { className: "text-base font-extrabold text-center mb-2", style: { color: colors.text } }, t("mtakd_mn_almsh_alkaml")),
            React.createElement("p", { className: "text-xs text-center mb-4 px-4", style: { color: colors.textMuted } }, t("hdha_ymsh_rmz_alqfl")),
            React.createElement(Button, { label: t("amsh_kl_shy"), variant: "filled", onPress: () => onRecovered(null, null, true), className: "mb-2", style: { backgroundColor: colors.danger } }),
            React.createElement(Button, { label: t("ilgha"), variant: "outline", onPress: () => setStep("choose") })))));
}
// ============================================================================
// شاشة رموز الاسترجاع بعد الاسترجاع
// ============================================================================
function PostRecoveryCodesScreen({ codes, onDone }) {
    const { colors } = useTheme();
    const [confirmed, setConfirmed] = useState(false);
    return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
        React.createElement(Key, { size: 36, color: colors.primary, className: "mx-auto" }),
        React.createElement("h2", { className: "text-lg font-extrabold text-center mt-3", style: { color: colors.text } }, t("rmwz_astrjaa_jdyda")),
        React.createElement("p", { className: "text-xs text-center mt-2 px-2", style: { color: colors.textMuted } }, t("alqdyma_asbht_laghya_tlqayya")),
        React.createElement(Card, { style: { marginTop: 16 } }, codes.map((c, i) => React.createElement("div", { key: i, className: "text-center font-bold my-1 tracking-widest", style: { color: colors.text } }, c))),
        React.createElement("button", { onClick: () => setConfirmed(!confirmed), className: `flex ${rowStart()} items-center gap-2 justify-center mt-4 mx-auto` },
            React.createElement("div", { className: "w-5 h-5 rounded border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : "transparent" } }, confirmed && React.createElement(Check, { size: 12, color: "#fff" })),
            React.createElement("span", { className: "text-xs", style: { color: colors.text } }, t("hfzt_alrmwz_bmkan_amn"))),
        React.createElement("div", { className: "mt-4" },
            React.createElement(Button, { label: t("mtabaa"), onPress: onDone, disabled: !confirmed }))));
}
// ============================================================================
// شاشات التطبيق الرئيسي
// ============================================================================
function ConnectBackendScreen({ onDone, onSkip }) {
    const { colors } = useTheme();
    const [phone, setPhone] = useState("");
    const [step, setStep] = useState("phone"); // phone | otp
    const [code, setCode] = useState("");
    const [error, setError] = useState(false);
    const DEMO_CODE = "1234";
    function handleVerify() {
        if (code.trim() === DEMO_CODE) {
            setError(false);
            onDone(t("mstkhdm_swa", { app: appName() }));
        }
        else {
            setError(true);
        }
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col justify-center items-center p-6", style: { backgroundColor: colors.bg } },
        React.createElement("img", { src: IS_RAHIM ? APP_LOGO_RAHIM : SAWA_LOGO, alt: appName(), style: { width: 80, height: 80, objectFit: "contain", marginBottom: 16 } }),
        React.createElement("h2", { className: "text-xl font-extrabold text-center mb-1", style: { color: colors.text } }, t("mrhba_bk_fy_swa")),
        step === "phone" ? (React.createElement("div", { className: "w-full mt-6" },
            React.createElement("label", { className: `text-xs font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } }, t("rqm_aljwal")),
            React.createElement("input", { dir: "ltr", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "09XXXXXXXX", inputMode: "tel", className: `w-full border rounded-2xl px-4 py-3 text-sm mb-4 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 } }),
            React.createElement(Button, { label: t("irsal_rmz_althqq"), onPress: () => phone.trim() && setStep("otp"), disabled: !phone.trim() }),
            React.createElement("button", { onClick: onSkip, className: "mt-3 text-xs font-bold w-full text-center", style: { color: colors.textMuted } }, t("tkhty")))) : (React.createElement("div", { className: "w-full mt-6" },
            React.createElement("p", { className: "text-xs text-center mb-4", style: { color: colors.textMuted } },
                t("arsl_rmz_althqq_ila"),
                React.createElement("span", { className: "font-bold", style: { color: colors.text } }, phone)),
            React.createElement("label", { className: `text-xs font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } },
                t("rmz_althqq"),
                React.createElement("span", { style: { color: colors.primary } },
                    "(\u062A\u062C\u0631\u064A\u0628\u064A: ",
                    DEMO_CODE,
                    ")")),
            React.createElement("input", { dir: "ltr", value: code, onChange: (e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(false); }, placeholder: "1234", inputMode: "numeric", maxLength: 4, className: "w-full border rounded-2xl px-4 py-3 text-lg mb-1 tracking-widest text-center font-extrabold", style: { borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 }, autoFocus: true }),
            error && React.createElement("p", { className: "text-xs text-center mb-2 font-bold", style: { color: colors.danger } },
                "\u0631\u0645\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u060C \u062C\u0631\u0651\u0628: ",
                DEMO_CODE),
            React.createElement("div", { className: "mt-3" },
                React.createElement(Button, { label: t("dkhwl"), onPress: handleVerify, disabled: code.length < 4 })),
            React.createElement("button", { onClick: () => setStep("phone"), className: "mt-3 text-xs font-bold w-full text-center", style: { color: colors.textMuted } }, t("tghyyr_alrqm"))))));
}
function PlaceholderTab({ icon: Icon, title, note }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex-1 overflow-y-auto flex flex-col items-center justify-center p-6", style: { backgroundColor: colors.bg } },
        React.createElement(Icon, { size: 40, color: colors.border }),
        React.createElement("h3", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, title),
        React.createElement("p", { className: "text-xs text-center mt-1", style: { color: colors.textMuted } }, note)));
}
function MeScreen({ onOpenSettings, onOpenNotifications, statusOption, profilePhoto, onLogout, onOpenLinkedDevices, onOpenWrapped, onOpenFeedback, onExportTree, onImportTree }) {
    const { colors } = useTheme();
    const statusMap = {
        online: { label: t("hala_mtsl"), color: colors.success },
        busy: { label: t("hala_mshghwl"), color: colors.danger },
        away: { label: t("hala_bayd"), color: colors.accent },
        unavailable: { label: t("hala_ghyr_mtah"), color: colors.textMuted },
    };
    const currentStatus = statusMap[statusOption] || statusMap.online;
    const listItems = [
        { key: "feedback", label: t("me_arsl_mlahza"), icon: Send, onPress: onOpenFeedback, color: "#10B981" },
        { key: "settings", label: t("me_iadadat_almlf"), icon: MoreHorizontal, onPress: onOpenSettings },
        { key: "notifications", label: t("me_mrkz_altnbyhat"), icon: BellIcon, onPress: onOpenNotifications },
        // ⛔ الأجهزة المرتبطة ربطُ محادثات، والإحصائيات إحصاءُ رسائل
        // ومكالمات — كلاهما خارج صلة الرحم فيُسحبان من أرحام.
        ...(IS_RAHIM ? [] : [
            { key: "devices", label: t("me_alajhza_almrtbta"), icon: Smartphone, onPress: onOpenLinkedDevices, color: "#3B82F6" },
            { key: "wrapped", label: t("me_ihsayyaty"), icon: BarChart3, onPress: onOpenWrapped, color: "#EC4899" },
        ]),
        { key: "export", label: t("me_tsdyr_alshjra"), icon: Download, onPress: onExportTree, color: "#0EA5E9" },
        { key: "import", label: t("me_astyrad_alshjra"), icon: Upload, onPress: onImportTree, color: "#8B5CF6" },
        // الجسر (B5): لوحة السحابة والمشاركة (رفع، Google، روابط، استعادة) — sawa-sync.js
        { key: "cloud", label: t("me_rfa_alshjra"), icon: Cloud, onPress: () => { if (window.SawaSync) (window.SawaSync.openPanel ? window.SawaSync.openPanel() : window.SawaSync.uploadCurrent()); }, color: "#187854" },
        // في مرحلة التجربة: الوصول للملاحظات من مكان ثابت يعرفه المجرِّب
    ];
    // اختبار قلب الاتجاه — شاشة ثانية
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { style: { background: `linear-gradient(160deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`, paddingBottom: 132, position: "relative" } },
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between px-5 pt-5 pb-4` },
                React.createElement("span", { className: "text-base font-extrabold text-white tracking-wide" }, appName()),
                React.createElement("span", { className: "text-xs font-bold", style: { color: "rgba(255,255,255,0.6)" } }, t("hsaby")))),
        React.createElement("div", { className: "mx-4 rounded-2xl shadow-lg px-5 pt-5 pb-4", style: { backgroundColor: colors.card, marginTop: -120, position: "relative", zIndex: 2, border: `1px solid ${colors.border}` } },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-4` },
                React.createElement("div", { className: "shrink-0 rounded-2xl overflow-hidden flex items-center justify-center", style: { width: 68, height: 68, backgroundColor: colors.primaryLight, border: `3px solid ${colors.primary}` } },
                    profilePhoto && React.createElement("img", { src: profilePhoto, alt: t("swrty"), className: "w-full h-full object-cover" }),
                    !profilePhoto && React.createElement("span", { className: "text-2xl font-extrabold", style: { color: colors.primary } }, t("s"))),
                React.createElement("div", { className: `flex-1 ${textStart()}`, style: { minWidth: 0 } },
                    React.createElement("h3", { className: "text-base font-extrabold truncate", style: { color: colors.text } }, t("mstkhdm_swa", { app: appName() })),
                    React.createElement("p", { className: "text-xs mt-0.5 truncate", style: { color: colors.textMuted }, dir: "ltr" }, "+249 9X XXX XXXX"),
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-2` },
                        React.createElement("span", { className: "w-2 h-2 rounded-full shrink-0", style: { backgroundColor: currentStatus.color } }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: currentStatus.color } }, currentStatus.label))),
                React.createElement("button", { "aria-label": t("tadyl"), onClick: onOpenSettings, className: "shrink-0 rounded-xl flex items-center justify-center", style: { width: 36, height: 36, backgroundColor: colors.primaryLight } },
                    React.createElement(Edit2, { size: 15, color: colors.primary })))),
        React.createElement("div", { className: "mt-4 flex flex-col", style: { backgroundColor: colors.card } }, listItems.map((item, i) => (React.createElement("button", { "aria-label": t("altaly"), key: item.key, onClick: item.onPress, className: `w-full flex ${rowStart()} items-center justify-between px-4 py-3.5`, style: { borderBottom: i < listItems.length - 1 ? `1px solid ${colors.border}` : "none" } },
            React.createElement(item.icon, { size: 18, color: item.color || colors.primary }),
            React.createElement("span", { className: `flex-1 text-sm font-bold ${textStart()} ${ms("2")}`, style: { color: colors.text } }, item.label),
            React.createElement(ChevronLeft, { size: 16, color: colors.textMuted, style: { transform: "scaleX(-1)" } }))))),
        React.createElement("div", { className: "mt-2", style: { backgroundColor: colors.card } },
            React.createElement("button", { onClick: onLogout, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3.5` },
                React.createElement(LogOut, { size: 18, color: colors.danger }),
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("tsjyl_alkhrwj")))),
        // رقم النسخة — يُحقن آلياً من sw.js عند كل بناء (انظر build.sh)
        React.createElement("p", { className: "text-[10px] text-center py-4", style: { color: colors.textMuted } }, appName() + " " + SAWA_BUILD)));
}
// نظام الدعوة والمكافأة — رموز ثابتة مبرمجة بالكود (مو مولّدة عشوائياً)،
// و50 ج.س بالضبط لكل طرف عند استخدام رمز الطرف الآخر
// __SAWA_BUILD__ — يستبدلها build.sh برقم النسخة من sw.js
const SAWA_BUILD = "v190";
const SAWA_APP = (function () {
    try {
        const q = new URLSearchParams(location.search).get("app"); // ⛔ مُعرِّف لا نصّ
        if (q === "rahim" || q === "sawa")
            return q;
        const w = window.__SAWA_APP; // ⛔ يُتحقَّق منه كالرابط: مجهولٌ يسقط للافتراض
        return (w === "rahim" || w === "sawa") ? w : "sawa";
    }
    catch (e) {
        return "sawa";
    }
})();
const IS_RAHIM = SAWA_APP === "rahim";
// اسمٌ وشعارٌ لكلّ تطبيق. شعار أرحام ملفٌّ في موقعه لا base64 مضمّن،
// فلا يحمل سوا وزنَ شعارٍ لا يعرضه.
function appName() { return IS_RAHIM ? t("arham") : t("swa"); } // ⛔ لا تستبدل t("swa") هنا استبدالاً شاملاً
const MY_REFERRAL_CODE = "SAWA-SARA";
const OTHER_REFERRAL_CODE = "SAWA-KHALID";
const REFERRAL_REWARD_SDG = 50;
function ReferralSection({ myCode, redeemedCode, onRedeem }) {
    const { colors } = useTheme();
    const [codeInput, setCodeInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    function handleCopy() {
        copyText(myCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }
    function handleRedeem() {
        setError("");
        const normalized = codeInput.trim().toUpperCase();
        if (normalized === myCode) {
            setError(t("la_ymknk_astkhdam_rmzk"));
            return;
        }
        if (normalized !== OTHER_REFERRAL_CODE) {
            setError(t("rmz_aldawa_ghyr_shyh"));
            return;
        }
        if (redeemedCode) {
            setError(t("astkhdmt_rmz_dawa_mn"));
            return;
        }
        onRedeem(normalized);
        setCodeInput("");
    }
    return (React.createElement("div", { className: "w-[90%] mt-4" },
        React.createElement("h4", { className: `text-sm font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
            React.createElement(Gift, { size: 16, color: colors.primary }),
            t("dawa_asdqa")),
        React.createElement(Card, null,
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1` },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("rmzk_alkhas")),
                React.createElement("button", { onClick: handleCopy, className: "text-[10px] font-bold", style: { color: colors.primary } }, copied ? t("ps_tm_alnskh") : t("ps_nskh"))),
            React.createElement("div", { className: "rounded-xl border px-3 py-2 text-center font-extrabold tracking-widest mb-3", style: { borderColor: colors.border, color: colors.primary, backgroundColor: colors.primaryLight } }, myCode),
            React.createElement("span", { className: "text-xs font-bold block mb-1.5", style: { color: colors.textMuted } }, t("andk_rmz_mn_sdyq")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                React.createElement("input", { dir: "ltr", value: codeInput, onChange: (e) => setCodeInput(e.target.value), placeholder: "SAWA-XXXXX", disabled: !!redeemedCode, className: "flex-1 border rounded-xl px-3 py-2 text-sm text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, opacity: redeemedCode ? 0.5 : 1 } }),
                React.createElement("button", { onClick: handleRedeem, disabled: !!redeemedCode || !codeInput.trim(), className: "rounded-xl px-4 py-2 text-xs font-bold", style: { backgroundColor: redeemedCode || !codeInput.trim() ? colors.border : colors.primary, color: redeemedCode || !codeInput.trim() ? colors.textMuted : "#fff" } }, t("astkhdm"))),
            !!error && React.createElement("p", { className: "text-[11px] font-bold mt-2 text-center", style: { color: colors.danger } }, error),
            redeemedCode && (React.createElement("p", { className: "text-[11px] font-bold mt-2 text-center", style: { color: colors.success } },
                t("ps_astkhdm_rmz"),
                redeemedCode,
                t("ps_rsydk_altshjyay"),
                REFERRAL_REWARD_SDG,
                t("ps_sdg_msjl"))))));
}
const MY_SAFETY_NUMBER = "2D23 4077 97D6 FD4D 1345"; // بصمة أمان تجريبية ثابتة — تُقارَن يدوياً مع جهة الاتصال عبر قناة آمنة أخرى
function ProfileSettingsScreen({ onBack, onChangePin, biometricEnabled, setBiometricEnabled, autoLockDelay, setAutoLockDelay, remainingCodes, onLockNow, onOpenSessions, profilePhoto, setProfilePhoto, interfaceLanguage, setInterfaceLanguage, pinLockEnabled, setPinLockEnabled, browserNotifEnabled, onToggleBrowserNotif, statusOption, setStatusOption, customStatusMessage, setCustomStatusMessage, redeemedReferralCode, onRedeemReferral, blockUnsolicited, setBlockUnsolicited, identityVerified, chatBackupEnabled, setChatBackupEnabled, onDeleteKeys, backendLinked, onUnlink, }) {
    const { colors, isDark, toggleDark, accentKey, setAccentKey, accentThemes, fontScale, setFontScale, highContrast, setHighContrast, dataSaver, setDataSaver } = useTheme();
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const options = [{ label: t("ps_fwra"), value: 0 }, { label: t("ps_bad_dqyqa"), value: 60 }, { label: t("ps_bad_5_dqayq"), value: 300 }];
    const statusMeta = {
        online: { label: t("ps_mtsl"), color: colors.success },
        busy: { label: t("ps_mshghwl"), color: colors.danger },
        away: { label: t("ps_bayd"), color: colors.accent },
        unavailable: { label: t("ps_ghyr_mtah"), color: colors.textMuted },
    };
    const photoInputRef = useRef(null);
    const [copiedSafety, setCopiedSafety] = useState(false);
    const [showQrNote, setShowQrNote] = useState(false);
    const [confirmDeleteKeys, setConfirmDeleteKeys] = useState(false);
    function handlePhotoChange(e) {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => setProfilePhoto(ev.target.result);
        reader.readAsDataURL(file);
    }
    // تجربة أولى لقلب الاتجاه على شاشة واحدة.
    // dir سمة موروثة من <html>، فنفرضها هنا لعزل الشاشة عن بقية التطبيق.
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement(TopBar, { title: t("iadadat_almlf_alshkhsy"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("alswra_alshkhsya")),
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 mb-5` },
                React.createElement("input", { ref: photoInputRef, type: "file", accept: "image/*", className: "hidden", onChange: handlePhotoChange }),
                React.createElement("div", { className: "w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } }, profilePhoto ? React.createElement("img", { src: profilePhoto, alt: t("swrty"), className: "w-full h-full object-cover" }) : React.createElement(Images, { size: 20, color: colors.textMuted })),
                React.createElement("button", { onClick: () => { var _a; return (_a = photoInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "text-sm font-bold", style: { color: colors.primary } }, profilePhoto ? t("ps_tghyyr_alswra") : t("ps_rfa_swra"))),
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("lwn_mzhr_alttbyq")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-5` }, Object.entries(accentThemes).map(([key, theme]) => (React.createElement("button", { "aria-label": t("takyd"), key: key, onClick: () => setAccentKey(key), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: theme.accent, border: accentKey === key ? `3px solid ${colors.text}` : "none" } }, accentKey === key && React.createElement(Check, { size: 14, color: "#fff" }))))),
            React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5` },
                React.createElement("button", { onClick: toggleDark, className: "w-11 h-6 rounded-full relative", style: { backgroundColor: isDark ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center", style: { [isDark ? "right" : "left"]: 2 } }, isDark ? React.createElement(Moon, { size: 11, color: colors.primary }) : React.createElement(Sun, { size: 11, color: colors.accent }))),
                React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("alwda_allyly"))),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("lgha_alwajha")),
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                        React.createElement(Globe, { size: 14, color: colors.primary }),
                        React.createElement("button", { onClick: () => setInterfaceLanguage("ar"), className: "text-xs font-bold", style: { color: interfaceLanguage === "ar" ? colors.primary : colors.textMuted } }, t("alarbya")),
                        React.createElement("span", { style: { color: colors.textMuted } }, "\u2039"),
                        React.createElement("button", { onClick: () => setInterfaceLanguage("en"), className: "text-xs font-bold", style: { color: interfaceLanguage === "en" ? colors.primary : colors.textMuted } }, "English"))),
                React.createElement("p", { className: "text-[10px] mt-2", style: { color: colors.textMuted } }, t("hdha_mthal_awly_ytrjm"))),
            React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("imkanya_alwswl")),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("hjm_alkht"))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` }, [{ v: 0.9, l: t("ps_sghyr") }, { v: 1, l: t("ps_aady") }, { v: 1.15, l: t("ps_kbyr") }, { v: 1.3, l: t("ps_akbr") }].map((s) => (React.createElement("button", { key: s.v, onClick: () => setFontScale(s.v), className: "flex-1 rounded-full border py-2", style: { backgroundColor: fontScale === s.v ? colors.primary : colors.card, borderColor: fontScale === s.v ? colors.primary : colors.border } },
                    React.createElement("span", { className: "text-xs font-bold", style: { color: fontScale === s.v ? "#fff" : colors.text } }, s.l))))),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
                    React.createElement("button", { onClick: () => setHighContrast(!highContrast), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: highContrast ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [highContrast ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("wda_altbayn_alaaly")),
                    React.createElement(Eye, { size: 16, color: colors.textMuted }))),
            !IS_RAHIM && React.createElement(Card, { className: `flex ${rowStart()} items-start gap-2.5` },
                React.createElement("button", { onClick: () => setDataSaver(!dataSaver), className: "w-11 h-6 rounded-full relative shrink-0 mt-0.5", style: { backgroundColor: dataSaver ? colors.primary : colors.border }, "aria-label": t("twfyr_albyanat") },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [dataSaver ? "right" : "left"]: 2 } })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-sm font-bold block mb-1", style: { color: colors.text } }, t("twfyr_albyanat")),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("la_thml_alswr_walfydyw"))),
                React.createElement(Download, { size: 16, color: colors.textMuted, className: "shrink-0 mt-0.5" })),
            React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5` },
                React.createElement("button", { onClick: () => setPinLockEnabled(!pinLockEnabled), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: pinLockEnabled ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [pinLockEnabled ? "right" : "left"]: 2 } })),
                React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("qfl_alttbyq_brmz_pin")),
                React.createElement(Lock, { size: 16, color: colors.textMuted })),
            pinLockEnabled && (React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5 mb-2` },
                    React.createElement("button", { onClick: () => setBiometricEnabled(!biometricEnabled), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: biometricEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [biometricEnabled ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("fth_balbsma_face_id"))),
                React.createElement("p", { className: `text-xs font-bold mb-2 ${textStart()}`, style: { color: colors.textMuted } }, t("alqfl_altlqayy_and_alkhlfya")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, options.map((o) => (React.createElement("button", { key: o.value, onClick: () => setAutoLockDelay(o.value), className: "rounded-full px-3 py-1.5 text-xs border", style: { backgroundColor: autoLockDelay === o.value ? colors.primary : colors.card, color: autoLockDelay === o.value ? "#fff" : colors.text, borderColor: autoLockDelay === o.value ? colors.primary : colors.border } }, o.label)))),
                React.createElement("button", { onClick: onChangePin, className: `w-full flex ${rowStart()} items-center gap-2 py-2 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Key, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("tghyyr_rmz_alqfl"))),
                !IS_RAHIM && React.createElement("button", { onClick: onOpenSessions, className: `w-full flex ${rowStart()} items-center gap-2 py-2 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Smartphone, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("alajhza_almsjla_alsyrfr"))),
                React.createElement("p", { className: `text-[11px] ${textStart()} pt-1`, style: { color: colors.textMuted } },
                    t("ps_tbqa_lk"),
                    remainingCodes,
                    t("ps_mn_10_rmwz")))),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
                    React.createElement("button", { onClick: onToggleBrowserNotif, className: "w-11 h-6 rounded-full relative", style: { backgroundColor: browserNotifEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [browserNotifEnabled ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("ishaarat_almtsfh_alhqyqya")),
                    React.createElement(BellIcon, { size: 16, color: colors.textMuted })),
                React.createElement("p", { className: `text-[10px] mt-2 ${textStart()}`, style: { color: colors.textMuted } }, t("ystkhdm_idhn_alishaarat_alfaly"))),
            !IS_RAHIM && React.createElement(ReferralSection, { myCode: MY_REFERRAL_CODE, redeemedCode: redeemedReferralCode, onRedeem: onRedeemReferral }),
            !IS_RAHIM && React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("haltk")),
            !IS_RAHIM && React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, Object.entries(statusMeta).map(([key, s]) => (React.createElement("button", { key: key, onClick: () => setStatusOption(key), className: "rounded-full px-3 py-1.5 border", style: { backgroundColor: statusOption === key ? s.color : colors.card, borderColor: statusOption === key ? s.color : colors.border } },
                    React.createElement("span", { className: "text-xs font-bold", style: { color: statusOption === key ? "#fff" : colors.text } }, s.label))))),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: customStatusMessage, onChange: (e) => setCustomStatusMessage(e.target.value), placeholder: t("adf_rsala_hala_mkhssa"), className: "w-full border rounded-xl px-3 py-2 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } })),
            !IS_RAHIM && React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("mfatyh_altshfyr")),
            !IS_RAHIM && React.createElement(Card, null,
                React.createElement("p", { className: `text-[11px] ${textStart()} mb-1`, style: { color: colors.textMuted } }, t("bsma_alaman_safety_number")),
                React.createElement("p", { className: "text-center font-bold tracking-widest mb-1.5", style: { color: colors.text } }, MY_SAFETY_NUMBER),
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-3`, style: { color: colors.textMuted } }, t("thqq_mn_hdha_alrqm")),
                React.createElement("div", { className: `rounded-xl p-2.5 mb-3 flex ${rowStart()} items-center gap-2`, style: { backgroundColor: colors.success + "22" } },
                    React.createElement(ShieldCheck, { size: 16, color: colors.success }),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.success } }, t("tshfyr_mn_trf_ila")),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("jmya_alrsayl_walmlfat_mshfra")))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => setShowQrNote(true), className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2`, style: { backgroundColor: colors.primary } },
                        React.createElement(QrCode, { size: 14, color: "#fff" }),
                        React.createElement("span", { className: "text-xs font-bold text-white" }, "QR Code")),
                    React.createElement("button", { "aria-label": t("nskh"), onClick: () => { copyText(MY_SAFETY_NUMBER).then(() => { setCopiedSafety(true); setTimeout(() => setCopiedSafety(false), 1500); }); }, className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2`, style: { backgroundColor: colors.primary } },
                        React.createElement(Copy, { size: 14, color: "#fff" }),
                        React.createElement("span", { className: "text-xs font-bold text-white" }, copiedSafety ? "تم النسخ ✓" : "نسخ"))),
                showQrNote && React.createElement("p", { className: "text-[10px] text-center mt-2", style: { color: colors.textMuted } }, t("myza_ard_qr_code"))),
            React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("alkhswsya_walaman")),
            React.createElement(Card, { className: "p-0 overflow-hidden" },
                !IS_RAHIM && React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("hzr_alrsayl_ghyr_almtlwba")),
                    React.createElement("button", { onClick: () => setBlockUnsolicited(!blockUnsolicited) },
                        React.createElement(Badge, { variant: blockUnsolicited ? "success" : "neutral", label: blockUnsolicited ? t("ps_mfaal") : t("ps_mattl") }))),
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("althqq_mn_alhwya")),
                        React.createElement(UserCheck, { size: 15, color: colors.textMuted })),
                    React.createElement(Badge, { variant: identityVerified ? "success" : "neutral", label: identityVerified ? t("ps_mwthq") : t("ps_ghyr_mwthq") })),
                React.createElement("button", { onClick: () => setShowPrivacyPolicy(true), className: `w-full flex ${rowStart()} items-center justify-between p-3` },
                    React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("syasa_alkhswsya")),
                    React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, style: { transform: "scaleX(-1)" } }))),
            showPrivacyPolicy && (React.createElement("div", { className: "absolute inset-0 z-50 flex flex-col", style: { backgroundColor: colors.bg } },
                React.createElement(TopBar, { title: t("syasa_alkhswsya"), onBack: () => setShowPrivacyPolicy(false) }),
                React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
                    React.createElement("div", { className: "rounded-xl border p-4", style: { borderColor: colors.border, backgroundColor: colors.card } },
                        React.createElement("p", { className: "text-sm leading-relaxed", style: { color: colors.text } }, t("hdhy_maayna_tjrybya_lttbyq")))))),
            React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("idara_alhsab")),
            React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5 mb-3` },
                backendLinked ? React.createElement(Cloud, { size: 16, color: colors.success }) : React.createElement(CloudOff, { size: 16, color: colors.textMuted }),
                React.createElement("span", { className: `flex-1 text-sm ${textStart()}`, style: { color: colors.text } }, backendLinked ? t("ps_mrbwt") : t("ps_ghyr_mrbwt")),
                backendLinked && React.createElement("button", { onClick: onUnlink, className: "text-xs font-bold", style: { color: colors.danger } }, t("ilgha_alrbt"))),
            !confirmDeleteKeys ? (React.createElement("button", { onClick: () => setConfirmDeleteKeys(true), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl p-3.5 border mb-3`, style: { backgroundColor: colors.card, borderColor: colors.danger } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("hdhf_mfatyh_altshfyr")),
                React.createElement(Trash2, { size: 16, color: colors.danger }))) : (React.createElement("div", { className: "rounded-xl border p-3 mb-3", style: { borderColor: colors.danger } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("takyd_hdha_ymsh_rmz")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { onDeleteKeys(); setConfirmDeleteKeys(false); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold text-white" }, t("nam_ahdhf_nhayya"))),
                    React.createElement("button", { onClick: () => setConfirmDeleteKeys(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))))));
}
function EncryptedNotesDemoScreen({ onBack, notes, onAdd, onDelete }) {
    const { colors } = useTheme();
    const [text, setText] = useState("");
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("tjrba_altkhzyn_almshfr"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
            React.createElement("p", { className: "text-[11px] p-4 pb-0", style: { color: colors.textMuted } }, t("smoke_test_bs_ythbt")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 p-4` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: text, onChange: (e) => setText(e.target.value), placeholder: t("aktb_mlahza_tjrybya"), className: "flex-1 border rounded-xl px-3 py-2 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("button", { "aria-label": t("takyd"), onClick: () => { if (text.trim()) {
                        onAdd(text.trim());
                        setText("");
                    } }, className: "w-11 h-11 rounded-lg flex items-center justify-center", style: { backgroundColor: colors.primary } },
                    React.createElement(Check, { size: 18, color: "#fff" }))),
            React.createElement("div", { className: "flex-1 overflow-y-auto px-4" },
                notes.length === 0 && React.createElement(EmptyState, { icon: Server, label: t("la_twjd_mlahzat_mhfwza") }),
                notes.map((n) => (React.createElement("div", { key: n.id, className: `flex ${rowStart()} items-center justify-between rounded-xl p-3 border mb-2`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement("span", { className: `flex-1 text-sm ${textStart()}`, style: { color: colors.text } }, n.text),
                    React.createElement("button", { "aria-label": t("hdhf"), onClick: () => onDelete(n.id) },
                        React.createElement(Trash2, { size: 16, color: colors.danger })))))))));
}
// ============================================================================
// بيانات صلة الرحم — نفس الأسماء والبنية المستخدمة فعلياً بمشروع sawa-rn
// ============================================================================
// مجموعة واحدة فارغة — المستخدم يسمّي عائلته ويضيف مجموعات بنفسه
const initialFamilyGroups = [
    { id: "g-1", name: "عائلتي", description: "", role: "owner" },
];
const initialGroupPersons = {
    "g-1": []
};
const initialKinship = [];
const initialSchedules = [];

const initialEvents = [];

const initialMembers = {
    "g-1": [{ userId: "u-1", name: "أنت", role: "owner" }],
};
const initialSettings = { "g-1": { allowMemberEvents: true }, "g-2": { allowMemberEvents: false } };
const statusLabels = { sick: "مريض حالياً", travel: "مسافر حالياً", newlywed: "متزوج حديثاً", abroad: "مغترب خارج البلاد" };
const proximityVariant = { "A***": "danger", "A**": "danger", "A*": "warning", "A": "warning", B: "neutral", C: "neutral" };
// درجات القرب تُشتقّ آلياً من صلة القرابة — ليست خياراً يدوياً.
// كلما زادت النجوم قربت الدرجة وقصرت المدة المسموحة بلا تواصل.
const proximityLabels = {
    "A***": "الدرجة الأولى",
    "A**": "الدرجة الثانية",
    "A*": "الدرجة الثالثة",
    "A": "الدرجة الرابعة",
    "B": "الدرجة الخامسة",
    "C": "الدرجة السادسة",
};
const proximityContactDays = {
    "A***": 7, // الوالدان والأبناء
    "A**": 10, // الإخوة والأخوات
    "A*": 14, // الأعمام والعمات والأخوال والخالات
    "A": 21, // أبناء الأعمام والعمات والأخوال والخالات
    "B": 30, // عمات وخالات الوالدين
    "C": 45, // أبناؤهم
};
// اشتقاق الدرجة من صلة القرابة — المصدر الوحيد للحقيقة
const KINSHIP_PROXIMITY = {
    "الوالد": "A***", "الوالدة": "A***", "الابن": "A***", "البنت": "A***",
    "الأخ": "A**", "الأخت": "A**",
    "الجد لأم": "A**", "الجدة لأم": "A**",
    "العم": "A*", "العمة": "A*", "الخال": "A*", "الخالة": "A*",
    "الجد": "A**", "الجدة": "A**",
    "ابن العم": "A", "بنت العم": "A", "ابن الخال": "A", "بنت الخال": "A",
    "ابن العمة": "A", "بنت العمة": "A", "ابن الخالة": "A", "بنت الخالة": "A",
    "عم الوالد": "B", "عمة الوالد": "B", "خال الوالد": "B", "خالة الوالد": "B",
    "عم الوالدة": "B", "عمة الوالدة": "B", "خال الوالدة": "B", "خالة الوالدة": "B",
    "ابن عم الوالد": "C", "بنت عم الوالد": "C", "ابن خال الوالدة": "C", "بنت خال الوالدة": "C",
    "الحفيد": "A**", "الحفيدة": "A**",
    "ابن الأخ": "A**", "بنت الأخ": "A**",
    "ابن الأخت": "A**", "بنت الأخت": "A**",
    "الزوج": "A***", "الزوجة": "A***",
    "زوجة الابن": "A**", "زوج البنت": "A**", // درجةً دون الابن/البنت — كما «زوجة الأخ» دون «الأخ»
    "الزوج السابق": "C", "الزوجة السابقة": "C", // ⛔ خاملة — البوّابة في isContactOverdue
    "زوج الأخت": "A*", "زوجة الأخ": "A*",
    "نفسي": "A***",   // صاحب الشجرة نفسه — أقرب ما يكون
    "أخرى": "A*",
};
// تجميع الصلات في أقسام — القائمة تجاوزت ثلاثين خياراً فصار التصفّح شاقاً
const KINSHIP_SECTIONS = [
    {
        key: "self", titleKey: "sec_self", icon: "🙋",
        items: ["نفسي"],
    },
    {
        key: "usul", titleKey: "sec_usul", icon: "👴",
        items: ["الوالد", "الوالدة", "الجد", "الجدة", "الجد لأم", "الجدة لأم"],
    },
    {
        key: "furu", titleKey: "sec_furu", icon: "👶",
        items: ["الابن", "البنت", "زوجة الابن", "زوج البنت", "الحفيد", "الحفيدة"],
    },
    {
        key: "ikhwa", titleKey: "sec_ikhwa", icon: "🧑‍🤝‍🧑",
        items: ["الأخ", "الأخت", "ابن الأخ", "بنت الأخ", "ابن الأخت", "بنت الأخت", "زوجة الأخ", "زوج الأخت"],
    },
    {
        key: "amm", titleKey: "sec_amm", icon: "🌿",
        items: ["العم", "العمة", "ابن العم", "بنت العم", "ابن العمة", "بنت العمة"],
    },
    {
        key: "khal", titleKey: "sec_khal", icon: "🌾",
        items: ["الخال", "الخالة", "ابن الخال", "بنت الخال", "ابن الخالة", "بنت الخالة"],
    },
    {
        key: "jeel3", titleKey: "sec_jeel3", icon: "🏛️",
        items: [
            "عم الوالد", "عمة الوالد", "خال الوالد", "خالة الوالد",
            "عم الوالدة", "عمة الوالدة", "خال الوالدة", "خالة الوالدة",
            "ابن عم الوالد", "بنت عم الوالد", "ابن خال الوالدة", "بنت خال الوالدة",
        ],
    },
    {
        key: "zawj", titleKey: "sec_zawj", icon: "💍",
        items: ["الزوج", "الزوجة", "الزوج السابق", "الزوجة السابقة"],
    },
    {
        key: "other", titleKey: "sec_other", icon: "•",
        items: ["أخرى"],
    },
];
function proximityForKinship(kinship) {
    return KINSHIP_PROXIMITY[kinship] || "A*";
}
// ============================================================
// فرع العائلة — مشتقّ من الصلة كالدرجة والجنس، لا يُسأل عنه.
// «الخال» جهة أم بالضرورة، و«العم» جهة أب. أما الوالدان والإخوة
// والأبناء فهم أصل الفرعين معاً لا أحدهما — ولذلك «both».
// ============================================================
const KINSHIP_BRANCH = {
    // جهة الأب: العمومة وما تفرّع عنها
    "العم": "paternal", "العمة": "paternal",
    "ابن العم": "paternal", "بنت العم": "paternal",
    "ابن العمة": "paternal", "بنت العمة": "paternal",
    "الجد": "paternal", "الجدة": "paternal",
    "عم الوالد": "paternal", "عمة الوالد": "paternal",
    "ابن عم الوالد": "paternal", "بنت عم الوالد": "paternal",
    // جهة الأم: الخؤولة وما تفرّع عنها
    "الخال": "maternal", "الخالة": "maternal",
    "ابن الخال": "maternal", "بنت الخال": "maternal",
    "ابن الخالة": "maternal", "بنت الخالة": "maternal",
    "الجد لأم": "maternal", "الجدة لأم": "maternal",
    "خال الوالدة": "maternal", "خالة الوالدة": "maternal",
    "ابن خال الوالدة": "maternal", "بنت خال الوالدة": "maternal",
    // الصلات المتقاطعة: النسبة للوالد الذي جاءت منه لا لجنس القريب.
    // «خال الوالد» أخو أمّ أبي — فهو في خط الأب رغم أنه «خال».
    // و«عم الوالدة» أخو أبي أمّي — في خط الأم رغم أنه «عم».
    "خال الوالد": "paternal", "خالة الوالد": "paternal",
    "عم الوالدة": "maternal", "عمة الوالدة": "maternal",
    // الجذع المشترك — ينتمي للفرعين لا لأحدهما
    "نفسي": "both",
    "الوالد": "both", "الوالدة": "both",
    "الأخ": "both", "الأخت": "both",
    "الابن": "both", "البنت": "both",
    "الحفيد": "both", "الحفيدة": "both",
    "الزوج": "both", "الزوجة": "both",
    "زوجة الابن": "both", "زوج البنت": "both",
    "الزوج السابق": "both", "الزوجة السابقة": "both",
    // أبناء الإخوة وأزواجهم: جذع مشترك كالإخوة أنفسهم. كانت تسقط على
    // الافتراضي "both" — صحيحاً بالصدفة. صريحةٌ الآن فلا يعتمد صوابها عليه.
    "ابن الأخ": "both", "بنت الأخ": "both",
    "ابن الأخت": "both", "بنت الأخت": "both",
    "زوجة الأخ": "both", "زوج الأخت": "both",
    "أخرى": "both",
};
function branchForKinship(kinship) {
    return KINSHIP_BRANCH[kinship] || "both";
}
// نطاق وحدة: مفاتيح لا نصوص (t() هنا تتجمّد على لغة الإقلاع)
const branchLabelKeys = { paternal: "br_ab", maternal: "br_um", both: "br_mshtrk" };
// المدن المستخرجة من عناوين الأقارب — لا قائمة ثابتة، فالمستخدم قد
// يكون له أقارب في أي مكان. نعرض ما هو موجود فعلاً في بياناته.
function extractCities(persons) {
    const counts = {};
    (persons || []).forEach((p) => {
        (p.locations || []).forEach((loc) => {
            const txt = (loc.address_text || "").trim();
            if (!txt)
                return;
            // آخر مقطع بعد الفاصلة هو المدينة عادةً: «حي العمارات، الخرطوم»
            const city = txt.split(/[,،]/).map((s) => s.trim()).filter(Boolean).pop();
            if (city)
                counts[city] = (counts[city] || 0) + 1;
        });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([city, n]) => ({ city, n }));
}
function personInCity(p, city) {
    return (p.locations || []).some((loc) => (loc.address_text || "").includes(city));
}
// ============================================================
// دوال مساعدة لربط صلة الرحم بالمحادثات
// ============================================================
// حساب عدد الأيام منذ آخر تواصل
function daysSinceContact(lastContactDate) {
    if (!lastContactDate)
        return Infinity;
    return Math.floor((Date.now() - lastContactDate) / (1000 * 60 * 60 * 24));
}
// «آخر تواصل» بصياغةٍ عربية سليمة للعدد (أمس، يومين، أيام، يوماً)
function contactAgoLabel(lastContactDate) {
    const d = daysSinceContact(lastContactDate);
    if (d === Infinity) return t("ac_lm");
    if (d <= 0) return t("ac_0");
    if (d === 1) return t("ac_1");
    if (d === 2) return t("ac_2");
    return t(d <= 10 ? "ac_few" : "ac_many", { n: d });
}
// هل تجاوز حد التواصل بناءً على درجة القرب؟
// ⛔ مُعرِّف لا نصّ — يُطابَق مع p.kinship ولا يُترجَم.
const SELF_KINSHIP = "نفسي";
// ⛔ مُعرِّفات لا نصوص — لا تُترجَم ولا تُقارَن بالمعروض
const EX_SPOUSE_KINSHIPS = ["الزوجة السابقة", "الزوج السابق"]; // ⛔ مُعرِّفات لا نصوص
function isExSpouseKinship(k) { return EX_SPOUSE_KINSHIPS.indexOf(k) !== -1; }
function isExSpousePerson(p) { return !!p && isExSpouseKinship(p.kinship); } // ⛔ مقارنة لا عرض
// الدرجة وحدها تسقط بقرار خالد: المناسبات — ميلاد ومرض وذكرى ودعاء —
// تبقى، فالمطلَّقة شخصٌ آخر بخلاف «نفسي» وقد تكون أمَّ الأبناء.
function hasNoProximity(k) { return k === SELF_KINSHIP || isExSpouseKinship(k); }
function hasNoProximityPerson(p) { return !!p && hasNoProximity(p.kinship); } // ⛔ مقارنة لا عرض
function isSelfPerson(p) {
    return !!p && p.kinship === SELF_KINSHIP;
}
function isContactOverdue(person) {
    // صاحب الشجرة لا يُذكَّر بالتواصل مع نفسه. البوّابة هنا لأنها المخنق
    // الذي تمرّ منه كل عدّادات التأخّر وشاراتها وبطاقة التذكير.
    if (isSelfPerson(person) || isExSpousePerson(person))
        return false;
    if (!person.alive || !person.proximity)
        return false;
    const limit = proximityContactDays[person.proximity] || 30;
    const days = daysSinceContact(person.lastContactDate);
    return days >= limit;
}
// احصل على كل الأشخاص الذين تأخر التواصل معهم
function getOverduePersons(groupPersons) {
    // الشخص الموجود في مجموعتين (نفسه ونسخته عند الأصهار) يُحتسب مرة واحدة —
    // نُبقي النسخة الأصلية ونُسقط الجسر المرتبط بها.
    const all = Object.values(groupPersons).flat();
    // نُسقط النسخة الجسر إن كان أصلها موجوداً فعلاً — الشرط السابق كان
    // يمرّر الاثنين معاً فيُحتسب الشخص مرتين في كل عدّاد يعتمد على هذه الدالة
    const allIds = new Set(all.map((p) => p.id));
    const unique = all.filter((p) => {
        const target = p.linkedTo && p.linkedTo.personId;
        return !target || !allIds.has(target);
    });
    return unique
        .filter(p => p.alive && isContactOverdue(p))
        .sort((a, b) => daysSinceContact(b.lastContactDate) - daysSinceContact(a.lastContactDate));
}
// احصل على الجداول المستحقة اليوم
function getDueSchedules(groupSchedules, groupPersons) {
    const allPersons = Object.values(groupPersons).flat();
    const now = Date.now();
    return Object.values(groupSchedules || {})
        .flat()
        .filter(s => s.dueTimestamp && s.dueTimestamp <= now + 24 * 60 * 60 * 1000)
        .map(s => ({
        ...s,
        person: allPersons.find(p => p.id === s.personId),
    }))
        .filter(s => { var _a; return (_a = s.person) === null || _a === void 0 ? void 0 : _a.alive; });
}

// ── أسماء القرابة بالإنجليزية ──
// قيم KINSHIP_OPTIONS تُخزَّن بالعربية في بيانات الشجرة ولا تُترجَم أبداً.
// هذه خريطة عرض فقط: kinshipLabel() تُستدعى عند الرسم لا عند الحفظ.
// الإنجليزية تفقد تمييزات العربية (ابن العم/العمة كلاهما Paternal Cousin)،
// فأُضيفت توضيحات بين قوسين حيث يلزم.
const KINSHIP_EN = {
    "\u0646\u0641\u0633\u064A": "Me",
    "\u0627\u0644\u0632\u0648\u062C \u0627\u0644\u0633\u0627\u0628\u0642": "Former husband",
    "\u0627\u0644\u0632\u0648\u062C\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629": "Former wife",
    "\u0627\u0644\u0648\u0627\u0644\u062F": "Father",
    "\u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother",
    "\u0627\u0644\u0627\u0628\u0646": "Son",
    "\u0627\u0644\u0628\u0646\u062A": "Daughter",
    "\u0627\u0644\u0623\u062E": "Brother",
    "\u0627\u0644\u0623\u062E\u062A": "Sister",
    "\u0627\u0644\u062C\u062F": "Grandfather (paternal)",
    "\u0627\u0644\u062C\u062F\u0629": "Grandmother (paternal)",
    "\u0627\u0644\u062C\u062F \u0644\u0623\u0645": "Grandfather (maternal)",
    "\u0627\u0644\u062C\u062F\u0629 \u0644\u0623\u0645": "Grandmother (maternal)",
    "\u0627\u0644\u0639\u0645": "Paternal Uncle",
    "\u0627\u0644\u0639\u0645\u0629": "Paternal Aunt",
    "\u0627\u0644\u062E\u0627\u0644": "Maternal Uncle",
    "\u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Aunt",
    "\u0627\u0628\u0646 \u0627\u0644\u0639\u0645": "Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u0639\u0645": "Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u0639\u0645\u0629": "Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u0639\u0645\u0629": "Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u062E\u0627\u0644": "Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u062E\u0627\u0644": "Maternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u0623\u062E": "Nephew (brother's son)",
    "\u0628\u0646\u062A \u0627\u0644\u0623\u062E": "Niece (brother's daughter)",
    "\u0627\u0628\u0646 \u0627\u0644\u0623\u062E\u062A": "Nephew (sister's son)",
    "\u0628\u0646\u062A \u0627\u0644\u0623\u062E\u062A": "Niece (sister's daughter)",
    "\u0632\u0648\u062C\u0629 \u0627\u0644\u0623\u062E": "Sister-in-law (brother's wife)",
    "\u0632\u0648\u062C \u0627\u0644\u0623\u062E\u062A": "Brother-in-law (sister's husband)",
    "\u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Uncle",
    "\u0639\u0645\u0629 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Aunt",
    "\u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Maternal Uncle",
    "\u062E\u0627\u0644\u0629 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Maternal Aunt",
    "\u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Paternal Uncle",
    "\u0639\u0645\u0629 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Paternal Aunt",
    "\u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Uncle",
    "\u062E\u0627\u0644\u0629 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Aunt",
    "\u0627\u0628\u0646 \u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Cousin (Female)",
    "\u0632\u0648\u062C\u0629 \u0627\u0644\u0627\u0628\u0646": "Daughter-in-law (son's wife)",
    "\u0632\u0648\u062C \u0627\u0644\u0628\u0646\u062A": "Son-in-law (daughter's husband)",
    "\u0627\u0644\u062D\u0641\u064A\u062F": "Grandson",
    "\u0627\u0644\u062D\u0641\u064A\u062F\u0629": "Granddaughter",
    "\u0627\u0644\u0632\u0648\u062C": "Husband",
    "\u0627\u0644\u0632\u0648\u062C\u0629": "Wife",
    "\u0623\u062E\u0631\u0649": "Other",
};
// ── «ما قرابتي بفلان؟» ───────────────────────────────────────────
// لا نبحث عن مسار حرّ في الرسم — يُخرج مسارات بلا معنى قرابيّ. نصعد من
// الطرفين إلى أصولهما ونأخذ أقرب جدّ مشترك: القرابة الدموية تُوصف تماماً
// بـ(صعود u · نزول d) وجنس من على الطريق.
function kinBuildIndex(persons, relations) {
    const parentsOf = {}, childrenOf = {}, spousesOf = {}, P = {};
    persons.forEach((p) => { P[p.id] = p; });
    relations.forEach((r) => {
        if (r.type === "parent") {
            (parentsOf[r.target] = parentsOf[r.target] || []).push(r.source);
            (childrenOf[r.source] = childrenOf[r.source] || []).push(r.target);
        }
        else if (r.type === "spouse" || r.type === "ex_spouse") {
            (spousesOf[r.source] = spousesOf[r.source] || []).push(r.target);
            (spousesOf[r.target] = spousesOf[r.target] || []).push(r.source);
        }
    });
    // أخوّة صريحة بلا والد مشترك: نصل الطرفين بوالد وهميّ لا يدخل البيانات،
    // وإلا ضاعت القرابة كلّها لمن سُجّل إخوةً فقط.
    relations.filter((r) => r.type === "sibling").forEach((r, i) => {
        const pa = parentsOf[r.source] || [], pb = parentsOf[r.target] || [];
        if (pa.some((x) => pb.includes(x)))
            return;
        const ghost = `__sib${i}`;
        (parentsOf[r.source] = parentsOf[r.source] || []).push(ghost);
        (parentsOf[r.target] = parentsOf[r.target] || []).push(ghost);
        (childrenOf[ghost] = childrenOf[ghost] || []).push(r.source, r.target);
    });
    return { P, parentsOf, childrenOf, spousesOf };
}
function kinAncestors(id, parentsOf, maxUp) {
    const out = new Map([[id, { d: 0, via: null }]]);
    let frontier = [[id, null]];
    for (let depth = 1; depth <= (maxUp || 8); depth++) {
        const next = [];
        for (const [cur, via] of frontier)
            for (const par of parentsOf[cur] || []) {
                if (out.has(par))
                    continue;
                const v = depth === 1 ? par : via;
                out.set(par, { d: depth, via: v });
                next.push([par, v]);
            }
        if (!next.length)
            break;
        frontier = next;
    }
    return out;
}
// أول نازل تحت الجدّ المشترك: هو الذي يفرّق «ابن أخيك» عن «ابن أختك»
function kinFirstDescender(from, to, childrenOf) {
    if (from === to)
        return null;
    const prev = new Map([[from, null]]);
    let frontier = [from];
    for (let depth = 1; depth <= 8; depth++) {
        const next = [];
        for (const cur of frontier)
            for (const kid of childrenOf[cur] || []) {
                if (prev.has(kid))
                    continue;
                prev.set(kid, cur);
                if (kid === to) {
                    let n = to, last = to;
                    while (n !== from) { last = n; n = prev.get(n); }
                    return last;
                }
                next.push(kid);
            }
        if (!next.length)
            break;
        frontier = next;
    }
    return null;
}
function kinBlood(aId, bId, idx) {
    const ancA = kinAncestors(aId, idx.parentsOf), ancB = kinAncestors(bId, idx.parentsOf);
    let best = null;
    ancA.forEach((ra, anc) => {
        const rb = ancB.get(anc);
        if (!rb)
            return;
        const score = ra.d + rb.d;
        if (!best || score < best.score || (score === best.score && ra.d < best.u))
            best = { anc, u: ra.d, d: rb.d, viaA: ra.via, score };
    });
    if (!best)
        return null;
    return { u: best.u, d: best.d, viaA: best.viaA, junction: kinFirstDescender(best.anc, bId, idx.childrenOf) };
}
// التاء المربوطة تُفتح عند لحاق ضمير: عمّة + ك ← عمّتك. قاعدة لا استثناء لها.
function kinSuffix(w, suf) {
    return (w.endsWith("\u0629") ? w.slice(0, -1) + "\u062A" : w) + suf;
}
function kinArabic(u, d, gB, viaFather, gJ) {
    const f = (g) => g === "female";
    const son = f(gB) ? "\u0628\u0646\u062A" : "\u0627\u0628\u0646";
    if (u === 0) {
        if (d === 0) return { self: 1 };
        if (d === 1) return { head: son };
        if (d === 2) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F" };
        if (d === 3) return { head: son, of: "\u062D\u0641\u064A\u062F" };
        return null;
    }
    if (d === 0) {
        if (u === 1) return { head: f(gB) ? "\u0648\u0627\u0644\u062F\u0629" : "\u0648\u0627\u0644\u062F" };
        if (u === 2) return { head: f(gB) ? "\u062C\u062F\u0651\u0629" : "\u062C\u062F\u0651", side: viaFather };
        if (u === 3) return { head: f(gB) ? "\u062C\u062F\u0651\u0629" : "\u062C\u062F\u0651", of: viaFather ? "\u0648\u0627\u0644\u062F" : "\u0648\u0627\u0644\u062F\u0629" };
        return null;
    }
    if (u === 1) {
        if (d === 1) return { head: f(gB) ? "\u0623\u062E\u062A" : "\u0623\u062E" };
        const sib = f(gJ) ? "\u0623\u062E\u062A" : "\u0623\u062E";
        if (d === 2) return { head: son, of: sib };
        if (d === 3) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F", of: sib };
        return null;
    }
    if (u === 2) {
        const unc = viaFather ? (f(gJ) ? "\u0639\u0645\u0651\u0629" : "\u0639\u0645\u0651") : (f(gJ) ? "\u062E\u0627\u0644\u0629" : "\u062E\u0627\u0644");
        if (d === 1) return { head: unc };
        if (d === 2) return { head: son, of: unc };
        if (d === 3) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F", of: unc };
        return null;
    }
    if (u === 3 && d >= 1 && d <= 2) {
        const inner = kinArabic(2, d, gB, viaFather, gJ);
        if (!inner)
            return null;
        const par = viaFather ? "\u0648\u0627\u0644\u062F" : "\u0648\u0627\u0644\u062F\u0629";
        return { head: inner.head, of: inner.of ? `${inner.of} ${par}` : par };
    }
    return null;
}
function kinEnglish(u, d, gB, viaFather, gJ) {
    const f = (g) => g === "female";
    const side = viaFather ? "paternal" : "maternal";
    if (u === 0) {
        if (d === 0) return "you";
        if (d === 1) return f(gB) ? "your daughter" : "your son";
        if (d === 2) return f(gB) ? "your granddaughter" : "your grandson";
        if (d === 3) return f(gB) ? "your great-granddaughter" : "your great-grandson";
        return null;
    }
    if (d === 0) {
        if (u === 1) return f(gB) ? "your mother" : "your father";
        if (u === 2) return `your ${side} ${f(gB) ? "grandmother" : "grandfather"}`;
        if (u === 3) return `your ${side} ${f(gB) ? "great-grandmother" : "great-grandfather"}`;
        return null;
    }
    if (u === 1) {
        if (d === 1) return f(gB) ? "your sister" : "your brother";
        if (d === 2) return f(gB) ? "your niece" : "your nephew";
        if (d === 3) return f(gB) ? "your grand-niece" : "your grand-nephew";
        return null;
    }
    if (u === 2) {
        if (d === 1) return `your ${side} ${f(gB) ? "aunt" : "uncle"}`;
        if (d === 2) return `your ${side} cousin`;
        if (d === 3) return `your ${side} cousin's ${f(gB) ? "daughter" : "son"}`;
        return null;
    }
    if (u === 3 && d >= 1 && d <= 2)
        return d === 1
            ? `your ${side} ${f(gB) ? "great-aunt" : "great-uncle"}`
            : `your parent's ${side} cousin`;
    return null;
}
/** يصف قرابة b بالنسبة إلى a، أو null إن تعذّر الوصف */
function describeKinship(aId, bId, persons, relations) {
    if (!aId || !bId)
        return null;
    const idx = kinBuildIndex(persons, relations);
    const P = idx.P;
    if (!P[aId] || !P[bId])
        return null;
    if (aId === bId)
        return isRTL() ? "\u0623\u0646\u062A" : "you";
    // الزوجية أولاً: أقرب من أي نسب وأكثر ما يُسأل عنه
    if ((idx.spousesOf[aId] || []).includes(bId))
        return t(P[bId].gender === "female" ? "kin_your_wife" : "kin_your_husband");
    // ⛔ جنسُ من نصفه هو جنس نهاية المسار لا جنس الهدف الأصلي: في مسار
    // المصاهرة نصف الزوج (العمّ) لا الزوجة، وإلا صار «عمّك» aunt.
    const say = (rel, whoId) => {
        if (!rel)
            return null;
        const viaFather = rel.viaA && P[rel.viaA] ? P[rel.viaA].gender !== "female" : true;
        const gJ = rel.junction && P[rel.junction] ? P[rel.junction].gender : null;
        const gWho = P[whoId] && P[whoId].gender;
        if (!isRTL())
            return kinEnglish(rel.u, rel.d, gWho, viaFather, gJ);
        const n = kinArabic(rel.u, rel.d, gWho, viaFather, gJ);
        if (!n)
            return null;
        if (n.self)
            return "\u0623\u0646\u062A";
        if (n.of)
            return `${n.head} ${kinSuffix(n.of, "\u0643")}`;
        const sd = n.side === undefined ? "" : (n.side ? " \u0644\u0623\u0628\u064A\u0643" : " \u0644\u0623\u0645\u0651\u0643");
        return `${kinSuffix(n.head, "\u0643")}${sd}`;
    };
    const direct = say(kinBlood(aId, bId, idx), bId);
    if (direct)
        return direct;
    // لا نسب مباشر: نجرّب المصاهرة — «زوجة عمّك» أقرب وصف صحيح
    for (const sp of idx.spousesOf[bId] || []) {
        const viaSpouse = say(kinBlood(aId, sp, idx), sp);
        if (viaSpouse)
            return t(P[bId].gender === "female" ? "kin_wife_of" : "kin_husband_of", { of: viaSpouse });
    }
    return null;
}
//@@sawa-part:2
