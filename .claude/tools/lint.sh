#!/bin/bash
# فحص Sawa-app: (١) كلّ ملفّ JS يُحلَّل · (٢) أجزاء app.p1…p9 سليمة النهاية وتُكوِّن معاً JS صحيحاً
# (٣) ESLint بقواعد الصحّة على الحزمة المجمَّعة وملفّات sawa-*.js وsw.js. الأخطاء تُفشل الفحص، والتحذيرات تُعرض فقط.
# الاستعمال: bash .claude/tools/lint.sh            (كلّ شيء)
#           bash .claude/tools/lint.sh sawa-rtc.js (ملفّ واحد أو أكثر من جذر المستودع)
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$TOOLS/../.." && pwd)"
ESLINT="$TOOLS/node_modules/.bin/eslint"
[ -x "$ESLINT" ] || { echo "eslint غير مثبّت — شغّل: (cd .claude/tools && npm install)" >&2; exit 2; }
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT   # خارج node_modules (ESLint يتجاهلها)
cd "$ROOT"

files=("$@")
if [ ${#files[@]} -eq 0 ]; then files=(app.p1.js app.p2.js app.p3.js app.p4.js app.p5.js app.p6.js app.p7.js app.p8.js app.p9.js sawa-*.js sw.js); fi

fail=0
for f in "${files[@]}"; do node --check "$f" || { echo "✗ syntax: $f"; fail=1; }; done

targets=()
for f in "${files[@]}"; do
  case "$f" in
    app.p[1-9].js) want_bundle=1 ;;
    *) cp "$f" "$OUT/"; targets+=("$(basename "$f")") ;;
  esac
done
if [ "${want_bundle:-0}" = 1 ]; then
  # index.html يجمع الأجزاء بعد حذف علامة النهاية //@@sawa-part:N — نفعل مثله
  node -e '
    const fs = require("fs"); let out = "", bad = 0;
    for (let k = 1; k <= 9; k++) {
      const t = fs.readFileSync(`app.p${k}.js`, "utf8"), m = `//@@sawa-part:${k}\n`;
      if (!t.endsWith(m)) { console.error(`✗ app.p${k}.js: علامة النهاية مفقودة (ملفّ ناقص؟)`); bad = 1; continue; }
      out += t.slice(0, -m.length);
    }
    fs.writeFileSync(process.argv[1], out); process.exit(bad);' "$OUT/app-bundle.js" || fail=1
  node --check "$OUT/app-bundle.js" || { echo "✗ syntax: app.p1…p9 مجمَّعة"; fail=1; }
  targets+=("app-bundle.js")
fi

if [ ${#targets[@]} -gt 0 ]; then
  (cd "$OUT" && "$ESLINT" --no-config-lookup -c "$TOOLS/eslint.config.mjs" "${targets[@]}") || fail=1
fi
[ $fail = 0 ] && echo "✓ lint OK (${#files[@]} files)"
exit $fail
