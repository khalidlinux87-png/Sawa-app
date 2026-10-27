# سوا — ملفّ التسليم إلى جلسة جديدة (٢٦ أكتوبر ٢٠٢٦، بعد C150)

> **ابدأ الجلسة الجديدة هكذا:** ارفع الملفّ `sawa-handoff-2026-10-25.zip`، ثمّ الصق:
> «هذا تسليم مشروع سوا. اقرأ HANDOFF.md ثمّ BUILD.md (آخر الأقسام) وتابع من قائمة "المعلّق".»

---

## ١) قواعد العمل مع خالد

- **اللغة والأسلوب:** الردّ بالعربيّة، وباختصار. **نصوص التطبيق بالفصحى فقط** — لا عاميّة (C130). خالد يعمل من الهاتف في السودان.
- **بعد كلّ تسليم:** تعليمات الرفع مع **حجم كلّ ملفّ**.
- **ترتيب الرفع:** الـWorker أوّلاً، ثمّ قواعد Firestore، ثمّ ملفّات التطبيق، و`sw.js` **أخيراً** برقمٍ جديد.
- **التوثيق:** كلّ تغيير يُوثَّق في `BUILD.md` (قسم بالرقم التالي: **C170**).
- **الملفّات للهاتف:** ملفّات منفردة لا zip، لأنّ فكّ الضغط على هاتفه يفشل أحياناً. محرّر GitHub على الهاتف يفسد النصّ العربيّ في الملفّات غير JS (مثل ‎`.strings`)، فتُرسَل بترميز `\Uxxxx`.
- **صور المتجر:** بصيغة JPG خفيفة.
- **الأسرار — لا تُطلب ولا تُرسَل في المحادثة أبداً:**
  - مكانها أسرار Worker (نوع Secret) أو GitHub Secrets أو Firebase فقط.
  - التحقّق منها يكون بفحوص داخل سير العمل لا بطلب قيمها.
  - ممنوعات صريحة: ملفّ خدمة Firebase ‏(SA_JSON)، ومفاتيح TURN ‏(Metered/Cloudflare)، و`signing.keystore`، وملفّات ‎`.p8`، وأسرار ‎`WA_*`، وWeb client secret.
- **حسابات بلا تحقّق:** الأرقام غير الموثّقة لا تُستعمل للدخول ولا للبحث.

## ٢) المستودعات والخدمات

| ماذا | أين |
|---|---|
| الموقع (PWA) | GitHub **Sawa-app** ← Cloudflare Pages ← https://www.sawaaap.com |
| الخادم | Cloudflare Worker **sawa-deploy-test**، الملفّ `worker-3.js` ← https://sawa-deploy-test.khalidlinux87.workers.dev |
| Firebase | المشروع **sawa-test-9770f** (Auth: ضيف/بريد/Google/Apple · Firestore · RTDB · FCM) |
| أندرويد | **Sawa-android**: `sawa-native.zip` + `.github/workflows/build.yml` (البناء ⇒ APK + AAB، وRelease ‏`android-latest` ⇒ رابط التنزيل) |
| آيفون | **Sawa-iOS**: مشروع XcodeGen ‏(`project.yml`) + Swift + ثلاثة سير عمل |
| مالك GitHub | **khalidlinux87-png** |
| حساب Apple | Team ‏**QD9SY2YYKY** (Ether Services LTD — Mohammed suliman) · Bundle ‏`com.sawaaap.app` |
| مستند نشر Google Play | https://claude.ai/artifact/K3HPnB9qWwnnYYGKKzLWQw |
| مستند نشر App Store | https://claude.ai/artifact/LXxQJiwWx7GVbeaE4SafuU |

### أسماء الأسرار (القيم عند خالد فقط)

| المكان | الأسماء |
|---|---|
| Worker | `SA_JSON` · `ADMIN_EMAIL` · `METERED_*` · `CF_TURN_KEY_ID` / `CF_TURN_API_TOKEN` · `TURN_PROVIDER` / `TURN_EXTRA` · `CF_SFU_APP_ID` / `CF_SFU_APP_TOKEN` · `WA_*` · `POLL_SECRET` · `APNS_P8` (C151، اختياريّاً `APNS_KEY_ID`/`APNS_TEAM_ID`) |
| GitHub Sawa-android | `KEYSTORE_B64` · `KEYSTORE_PASSWORD` · `GOOGLE_SERVICES_JSON` |
| GitHub Sawa-iOS | `ASC_KEY_ID` (مفتاح API ‏«Github Sawa 3» = S2LNKJ8732) · `ASC_ISSUER_ID` · `ASC_KEY_P8` · `APPLE_TEAM_ID` · `GOOGLE_SERVICE_INFO_PLIST` (نصّ XML كما هو) |
| Firebase Cloud Messaging | مفتاح APNs **جديد** (Sandbox & Production) في خانتَي production وdevelopment. القديم SUDDM5WJ4Q كان للإنتاج فقط ⇒ «Invalid APNs credential» |

## ٣) النسخ الحاليّة

| المكوّن | النسخة |
|---|---|
| sw.js | **sawa-v365** |
| sawa-rtc | **c131** |
| Worker | **v84-metered** |
| أندرويد الأصليّ (`native/SAWA_BUILD`) | **c152** (versionCode = 1000 + رقم التشغيل، والاسم 2.0.N) |
| iOS | 1.0.0 · رقم البناء = 100 + رقم تشغيل TestFlight (آخر ما رُفع **106**) |

## ٤) بنية الكود

- **`sawa-app.js`:** دمج `app.p1.js`…`app.p9.js`. التطبيق يُرفع **أجزاءً** (app.pN.js).
  - التقسيم: `python3 split.py` (يقطع عند `//@@sawa-part:N`).
  - الدمج: `cat app.p1.js … app.p9.js > sawa-app.js`.
  - فحص الصياغة: `node chk.js <file>`.
- **`base/`:** آخر نسخة سُلِّمت، للمقارنة.
- **لحظات الأصدقاء (C133):** `sawa-chat` (moments.mount/compose) + worker moment.* + قواعد moments/ · اختبارها في `t/mom` (Firestore وخادم وهميّان).
- **`sawa-sync.js`:** الدخول (ضيف ⇒ ربط Google/Apple/بريد · `idpCredential` · `linkApple` · `nativeGoogle`)، والعائلات، ومنطق الجسور `NB()` (أندرويد `SawaNativeBridge`) و`IOSB()` (آيفون `SawaIOS`).
- **`sawa-chat.js`:** المحادثات والإشعارات (فروع أندرويد وiOS في pushState/pushToken/enablePush)، وأزرار الدخول (زرّ Apple على iOS)، والإبلاغ، وحذف الحساب.
- **`sawa-rtc.js`:** المكالمات والغرف:
  - **C131:** الصوتيّة الثنائيّة على WebView افتراضيّاً (كالنسخ الأولى)؛ الأصليّ ⚡ للمدير فقط (`sawa-eng = "nat"` بلمس سطر الشبكة).
  - **تقييم المكالمات (C131):** المدير والمختبِر (`?qa=1`) يقيّمون كلّ مكالمة ≥ ١٥ ث ⇒ `qa.rate` ⇒ تقرير «حسابي ← تقييمات المكالمات». **لا يُغيَّر إعداد صوتٍ إلّا بمقارنة A/B في التقرير.**
  - التوجيه الموحّد `RB()` لأندرويد وiOS (C127).
  - مشاركة الشاشة في الغرف (C120–C122b).
- **`worker-3.js`:**
  - `fcmSend` + `apnsOf()` (C123: تنبيه APNs مرئيّ، وcollapse-id للمكالمات).
  - الإقرارات `/ack` (HMAC).
  - إحصاءات المدير.
- **أندرويد** (`native/`): `MainActivity` · `NativeRtc` (C124: تكبير 1.4، ومخزن 50 حزمة، بلا تسريع) · `Notifier` · `CallService` · `values-ar/strings.xml` (C125).
- **iOS** (`ios/src/`):
  - `AppDelegate.swift`: FirebaseMessaging، وفتح الإشعار ⇒ ‎`?chat=` / `?call=` …، وفي المقدّمة ⇒ `__sawaNativePush`.
  - `WebViewController.swift`: ‏WKAppBoundDomains ليعمل sw.js.
  - `NativeBridge.swift`: ‏appleSignIn، وgoogleSignIn ‏(ASWebAuthenticationSession + PKCE)، والإشعارات، والمشاركة، و**CallAudio** (C127).
  - `PrivacyInfo.xcprivacy` · `ar.lproj` / `en.lproj`.
  - سير العمل `ios-testflight.yml` (C123d):
    - وظيفة verify على Ubuntu تفحص المفتاح.
    - ثمّ توقيع **يدويّ** عبر App Store Connect API: شهادة وملفّ توفير مؤقّتان يُحذفان بعد كلّ تشغيل.
    - ثمّ altool للرفع.
    - مدخل runner: ‏macos-26 أو macos-15.

## ٥) الاختبارات المحلّيّة (في `t/`)

- **`t/app`:** تطبيق محلّيّ (React مبنيّ في `react-umd.js`) مع:
  - `shot.mjs` (خادم + Playwright) · `seed.mjs` / `seed-en.mjs` (عائلة وهميّة).
  - `screens*.mjs` · `ios.mjs` (فحص زرّ Apple).
  - انسخ الملفّات المعدّلة إلى `t/app` قبل التشغيل.
- **`t/rtc`:** مكالمات بين إطارين بقاعدة وهميّة:
  - `run111` (أساسيّ) · `run112` · `run115` · `run119` · `run120` · `run121old` · `callshots(-en).mjs`.
  - انسخ `sawa-rtc.js` إلى `t/rtc` أوّلاً.
- **الخادم:** `t/ack.test.mjs`. ‏`t/worker.mjs` = ‏worker-3.js + سطر export.
- **Playwright:** في `/home/claude/.npm-global/lib/node_modules/playwright`. إن لم يوجد: `npm i -g playwright`، والمتصفّح Chromium مثبّت مسبقاً.
- **صور المتاجر:**
  - `play/make.mjs` (Google Play).
  - `play/make-ios2.mjs` (App Store) بالمتغيّرين `LANGS=ar,en SIZES=6.3,6.9,6.5`.
  - App Store الآن يطلب **1206×2622** (6.3 بوصة).

## ٦) المعلّق — ابدأ من هنا

**بانتظار الرفع أو التجربة من خالد:**
00000000000000000000. **C165:** Worker v84 · sawa-rtc · sw v361 ⇒ Metered أساسيّ و Cloudflare احتياط (TURN_PROVIDER = cloudflare للعكس) — قارِن في «تقييمات المكالمات».
0000000000000000000. **C164:** Worker v83 · sawa-chat c164 · app.p2/p5/p8 · sw v360 ⇒ قوائم المهامّ (تعديل/توجيه/حذف/سرّيّة) · صورة المرسل مرّةً لكلّ سلسلة · خيار صور الإشعارات.
000000000000000000. **C163:** sawa-rtc · sw v359 ⇒ درجة صورة رابعة + اقتراح إيقاف الكاميرا عند فقد > ٣٠٪ (الصوت بلا تغيير).
00000000000000000. **C162:** app.p2/p3/p8 · sw v358 ⇒ رجوع استكشف · موقعه في الشجرة · قرابات الأصهار.
0000000000000000. **C161:** sawa-chat (c161) · sw v357 ⇒ لاحقة ‎?v=‎ في index.html كانت تُبقي sawa-chat.js قديماً من مخزون المتصفّح.
000000000000000. **C160:** sawa-chat (CHAT_BUILD c160 — ارفعه مع كلّ تعديلٍ لـsawa-chat) · app.p2–p7 · sw v356 ⇒ أسهم القوائم · سطر «ملفّ المحادثات المحمَّل».
00000000000000. **C159:** Worker v82 · sawa-chat · app.p5 · sw v355 ⇒ صورة المجموعة (والعائلة) · EXPECT يراقب كلّ الملفّات منذ C155.
0000000000000. **C158:** app.p3 · sw v354 ⇒ التكبير بإصبعين في مكانهما.
000000000000. **C157:** app.p1/p3/p8 · sw v352 ⇒ القريب المُعاد في مكانه بالقائمة (ترتيب «القرابة») وبالأجيال، والوالد الآخر الناقص.
00000000000. **C156:** Worker v81 · sawa-sync · app.p3/p5/p8 · sw v351 ⇒ إعادة المحذوف إلى مكانه · تغيير الحساب المربوط · لا ربط بتشابه الأسماء (المشاهد يُربط بطلبٍ من محرّر أو دعوةٍ باسمه).
0000000000. **C155:** Worker v80 · sawa-chat · app.p2/p4/p5 · sw v350 ⇒ صورة المجموعة · صورة الطرف الآخر في المعلومات · الاتّجاه العربيّ (rowStart = flex-row؛ صفّ جديد يبدأ بالمفتاح ⇒ rowEnd).
000000000. **C154:** sawa-core · sawa-chat · app.p2/p4/p5/p8/p9 · sw v349 ⇒ تجربة «كبير/أكبر» في الإعدادات والمحادثات واللحظات.
00000000. **C153:** Worker v79 ⇒ نشر لحظة ⇒ يصل الأصدقاء «لحظة جديدة» باسم الناشر وصورته.
0000000. **C152:** Worker v78 · sawa-native.zip c152 ⇒ شعار سوا في شريط الحالة والإشعار، وصورة المرسِل في إشعارات الرسائل واللحظات.
000000. **C151 CallKit:** سرّ APNS_P8 · Worker v77 · sawa-chat/sawa-rtc/app.p2 · sw v348 · ملفّات iOS ثمّ TestFlight ⇒ «اختبار مكالمة الآيفون» ثمّ مكالمة حقيقيّة والهاتف مقفل.
00000. **C136:** Worker v73 · sawa-chat · sw v335 ⇒ تجربة تعديل التعليق، والتفاعلات العشرة على اللحظة والتعليق، والضغطة المطوّلة على التعليق.
0000. **C135 اللحظات (ردود · تفاعلات · @ · إشعارات):** Worker v72 · نشر firestore.rules (mnote) · sawa-chat + app.p3 · sw v334 · sawa-native.zip c135 · AppDelegate.swift ⇒ تجربة بين هاتفين: ردّ، إشارة، تفاعل مطوّل، فتح اللحظة من الإشعار.
000. **C133 لحظات الأصدقاء:** Worker v70 · نشر firestore.rules · sawa-chat + app.p3/p6/p8 · sw v331 ⇒ تجربة النشر بصور وفيديو والجمهور والتعليقات بين هاتفين.
00. **C131:** Worker v69 · sawa-rtc + app.p2 · sw v329 ⇒ جمع ١٥–٢٠ تقييماً ثمّ قراءة التقرير قبل أيّ تعديل صوت.
0. **C130** (BUILD.md، رُفع): sawa-chat + app.p1…p5 · sw v328 · sawa-native.zip c130 · NativeBridge.swift ⇒ تجربة صورة الحساب وفتح PDF.
1. **C129** (انظر BUILD.md، رُفع): Worker v68 · sawa-core + sawa-chat + app.p2…p8 · sw v327 · sawa-native.zip c129 · NativeBridge.swift ثمّ TestFlight. وsawa-rtc.js (C128) إن لم يُرفع.
2. **نسخ/تحديد الرسائل بالإنجليزيّة:** لم يُعَد إنتاجه محلّيّاً ⇒ ننتظر صورة/وصفاً من خالد (أيّ جهاز؟ أيّ خطوة؟).
3. **روابط سوا عند المشاركة (واتساب):** المعاينة تأتي من وسوم og في index.html (غير موجود في التسليم) ⇒ إن بقيت عربيّة فاطلب index.html.
4. **C128:** تجربة صوتيّة أندرويد⇄أندرويد بـ⚡.
5. ✓ **إشعارات iOS:** حُلّت (٢٦ أكتوبر) — كان مفتاح APNs مرفوعاً في خانة Development وحدها في Firebase؛ رُفع في Production أيضاً.
6. **C127 على الآيفون:** السمّاعة / المكبّر / حسّاس القرب.

**App Store (الصفحة الإنجليزيّة اكتملت):**

6. **الصفحة العربيّة:** الصور (`store/appstore/ar-6.3`) والنصوص.
7. **App Information:** الاسم «سوا» للعربيّة، وSawa للإنجليزيّة.
8. ✓ App Privacy و Age Rating (13+، Social Media = Yes) اكتملا · **Pricing:** مجّانيّ، كلّ الدول.
9. **حساب المراجعة:** بريد كامل وكلمة مرور. اسم المستخدم كان «Sawareview» وليس بريداً، فيجب تصحيحه.
10. **Contact Information** ونصّ **Notes** المصحّح:
    - حذف الحساب: تبويب «حسابي» ← أسفل الصفحة.
    - الإبلاغ والحظر: افتح محادثة ← اضغط اسم الطرف الآخر.
11. اختيار أحدث بناء (بعد C133) ← **Add for Review**.

**Google Play:**

12. الاختبار المغلق: ١٢ مختبِراً لمدّة ١٤ يوماً (حساب شخصيّ جديد) · صفحة إنجليزيّة.
13. إن رفضت Play إذن تحسين البطّاريّة فيُزال.

**مفتوح من قبل:**

14. مشاركة الشاشة لا تظهر عند خالد من مشارك على Chrome: ننتظر صورة «تشخيص الاتّصال» (C122b) لكلّ مشارك.
15. التحقّق من أنّ `www.sawaaap.com/sw.js` يعمل باسمه تماماً (C122).

**حدود معروفة في iOS:** لا شاشة رنين CallKit (المكالمة تصل إشعاراً) · لا إقرارات وصول ✓✓ والتطبيق مغلق · المكالمة تتوقّف عند الخروج من التطبيق.
