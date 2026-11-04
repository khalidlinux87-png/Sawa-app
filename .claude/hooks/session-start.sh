#!/bin/bash
# جلسات Claude Code السحابيّة: يثبّت أدوات الفحص في .claude/tools (ESLint · React وFirebase لاختبار الدخان).
# لا package.json في جذر المستودع عمداً — الموقع ثابتٌ تنشره Netlify/Cloudflare Pages كما هو.
# الفحص:   bash .claude/tools/lint.sh      الاختبار:   node .claude/tools/smoke.js
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
TOOLS=.claude/tools

# التثبيت فقط إن تغيّر أحد الملفّات التي تحدّد ما يُثبَّت منذ آخر تثبيتٍ ناجح
hashes=$TOOLS/node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  (cd "$TOOLS" && npm install --no-audit --no-fund --loglevel=error)
  sha256sum .claude/hooks/session-start.sh "$TOOLS/package.json" "$TOOLS/package-lock.json" > "$hashes" || rm -f "$hashes"
fi
