// عائلة تجريبيّة لاختبار C203 (المتصفّح فقط — لا تلمس الخادم):
//   علي ⇐ محمد (أبي) وصالح (عمّي) · محمد ⇐ خالد (أنا) وأخي عمر · صالح ⇐ سعيد (ابن عمّي) ⇐ هدى (بنت ابن العمّ)
//   خالد متزوّج من هدى (بنت ابن عمّه — زواجٌ جائز عابرٌ للأجيال): لا تُرسم بجانبه، وإلّا جلست في صفّ أبيها سعيد
//   أهل الزوجة الأخرى سلمى: والدها حسن، أخوها ياسر، جدّها لأمّها عثمان
//   أمّ خالد: زينب — لها ابن من زواجٍ سابق (أبوه طارق، غير مسجَّل زواجه) وهي اليوم زوجة محمد
const P = (id, name, gender, kinship, extra) => Object.assign({ id, local_name: name, gender, kinship: kinship || "أخرى", proximity: "A*", alive: true, favorite: false, locations: [], lastContactDate: null, addedAt: Date.now(), contacts: null, notes: "", linkedTo: null }, extra || {});
const R = (id, s, t, type) => ({ id, groupId: "g-1", source: s, target: t, type });
module.exports = {
  persons: [
    P("p-ali", "علي", "male"), P("p-sal2", "صالح", "male"), P("p-moh", "محمد", "male", "الوالد"), P("p-zay", "زينب", "female", "الوالدة"), P("p-tar", "طارق", "male"), P("p-half", "فارس", "male"),
    P("p-kha", "خالد", "male", "نفسي"), P("p-omr", "عمر", "male", "العم"), P("p-sae", "سعيد", "male"), P("p-hud", "هدى", "female"),
    P("p-sal", "سلمى", "female", "الزوجة"), P("p-has", "حسن", "male"), P("p-hm", "مريم", "female"), P("p-yas", "ياسر", "male"), P("p-uth", "عثمان", "male"),
    P("p-son", "أحمد", "male", "الابن"),
  ],
  relations: [
    R("r1", "p-moh", "p-kha", "parent"), R("r2", "p-zay", "p-kha", "parent"), R("r3", "p-moh", "p-omr", "parent"),
    R("r4", "p-moh", "p-zay", "spouse"),
    R("r5", "p-zay", "p-half", "parent"), R("r6", "p-tar", "p-half", "parent"),         // زواج زينب وطارق غير مسجَّل
    R("r0", "p-ali", "p-moh", "parent"), R("r0b", "p-ali", "p-sal2", "parent"), R("r7", "p-sal2", "p-sae", "parent"), R("r8", "p-sae", "p-hud", "parent"),
    R("r9", "p-kha", "p-hud", "spouse"),                                                  // عابرٌ للأجيال
    R("r10", "p-kha", "p-sal", "spouse"), R("r11", "p-has", "p-sal", "parent"), R("r12", "p-hm", "p-sal", "parent"),
    R("r13", "p-has", "p-yas", "parent"), R("r14", "p-uth", "p-hm", "parent"),
    R("r15", "p-kha", "p-son", "parent"), R("r16", "p-sal", "p-son", "parent"),
  ],
};
