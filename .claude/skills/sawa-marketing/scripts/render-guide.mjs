// iPhone install guide: marketing/guide/ios-install-{ar,en}.{jpg,mp4}
// Usage (from Sawa-app root): node .claude/skills/sawa-marketing/scripts/render-guide.mjs [--lang ar,en] [--no-video]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../../..'), mk = resolve(root, 'marketing');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const langs = arg('--lang', 'ar,en').split(','), fps = 30, DUR = 20, noVideo = process.argv.includes('--no-video');
const out = resolve(mk, 'guide'); mkdirSync(out, { recursive: true });
const src = f => pathToFileURL(resolve(mk, 'src', f)).href;

const CFG = {
  ar: { dir: 'rtl', lang: 'ar', brand: 'سوا', shot: src('ar-1.jpg'), logo: src('logo.png'), nums: ['١', '٢', '٣', '٤'],
    title: 'ثبّت سوا على آيفون', sub: 'أربع خطوات من Safari — أقلّ من دقيقة',
    steps: [['افتح موقع سوا في Safari', 'sawaaap.com — لا من Chrome ولا من واتساب'], ['اضغط زرّ المشاركة', 'أو «⋯» ثمّ «مشاركة»'],
      ['اختر «إضافة إلى الشاشة الرئيسية»', 'مرّر القائمة إلى الأسفل'], ['اضغط «إضافة»', 'واترك «فتح كتطبيق ويب» مفعّلاً']],
    rows: ['نسخ', 'إضافة إشارة مرجعية', 'إضافة إلى المفضّلة', 'إضافة إلى الشاشة الرئيسية', 'البحث في الصفحة'],
    cancel: 'إلغاء', add: 'إضافة', webapp: 'فتح كتطبيق ويب',
    endT: 'سوا على شاشتك الرئيسيّة 🎉', endS: 'افتحه دائماً من الشعار — فتصلك إشعارات الرسائل والمكالمات', cta: 'مجّاناً · sawaaap.com',
    foot: 'افتح سوا دائماً من <b>الشعار</b> لتصلك الإشعارات · مجّاناً · sawaaap.com' },
  en: { dir: 'ltr', lang: 'en', brand: 'Sawa', shot: src('en-1.jpg'), logo: src('logo.png'), nums: ['1', '2', '3', '4'],
    title: 'Install Sawa on iPhone', sub: 'Four steps in Safari — under a minute',
    steps: [['Open sawaaap.com in Safari', 'Not Chrome or an in-app browser'], ['Tap the Share button', 'or “⋯” then “Share”'],
      ['Choose “Add to Home Screen”', 'Scroll down the list'], ['Tap “Add”', 'Keep “Open as Web App” on']],
    rows: ['Copy', 'Add Bookmark', 'Add to Favorites', 'Add to Home Screen', 'Find on Page'],
    cancel: 'Cancel', add: 'Add', webapp: 'Open as Web App',
    endT: 'Sawa is on your home screen 🎉', endS: 'Always open it from the icon to get message and call notifications', cta: 'Free · sawaaap.com',
    foot: 'Always open Sawa from <b>the icon</b> to get notifications · Free · sawaaap.com' },
};

const tmpl = resolve(mk, '.tmp-guide.html');
writeFileSync(tmpl, readFileSync(resolve(here, 'ios-guide.html'), 'utf8').replaceAll('FONTS/', pathToFileURL(resolve(root, 'fonts')).href + '/'));
const browser = await pw.chromium.launch();
const kb = f => Math.round(statSync(f).size / 1024) + ' KB';
for (const lang of langs) {
  const cfg = CFG[lang], name = 'ios-install-' + lang;
  let page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(tmpl).href);
  await page.evaluate(c => setup(c, 'still'), cfg);
  const jpg = resolve(out, name + '.jpg');
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 85 });
  await page.close();
  let line = `${name}: image ${kb(jpg)}`;
  if (!noVideo) {
    page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(tmpl).href);
    await page.evaluate(c => setup(c, ''), cfg);
    const fdir = resolve(mk, '.frames', name); rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
    for (let i = 0; i < DUR * fps; i++) {
      await page.evaluate(t => render(t), i / fps);
      await page.screenshot({ path: resolve(fdir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    }
    const mp4 = resolve(out, name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(fdir, '%04d.jpg'),
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', mp4]);
    rmSync(fdir, { recursive: true, force: true });
    line += ` · video ${kb(mp4)}`;
    await page.close();
  }
  console.log(line);
}
await browser.close();
rmSync(tmpl, { force: true }); rmSync(resolve(mk, '.frames'), { recursive: true, force: true });
