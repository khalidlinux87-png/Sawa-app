// Sawa marketing renderer: campaign.json -> reels (MP4 1080x1920), covers (JPG), feed posts (JPG 1080x1350).
// Usage (from Sawa-app root):
//   node .claude/skills/sawa-marketing/scripts/render.mjs [--only 01-silat-rahim] [--lang ar,en] [--no-video] [--fps 30]
// Needs: playwright (preinstalled in the cloud session) and ffmpeg.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');            // Sawa-app/
const mk = resolve(root, 'marketing');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const only = arg('--only'), langs = arg('--lang', 'ar,en').split(','), fps = +arg('--fps', 30);
const noVideo = process.argv.includes('--no-video');
const DUR = 15;

const camp = JSON.parse(readFileSync(resolve(mk, 'campaign.json'), 'utf8'));
const html = readFileSync(resolve(here, 'template.html'), 'utf8')
  .replaceAll('FONTS/', pathToFileURL(resolve(root, 'fonts')).href + '/');
const tmpl = resolve(mk, '.tmp-template.html');
for (const d of ['reels', 'covers', 'posts']) mkdirSync(resolve(mk, d), { recursive: true });
writeFileSync(tmpl, html);

const browser = await chromium.launch();
const kb = f => Math.round(statSync(f).size / 1024) + ' KB';

for (const reel of camp.reels) {
  if (only && reel.id !== only) continue;
  for (const lang of langs) {
    const L = reel[lang]; if (!L) continue;
    const cfg = { ...camp.common[lang], ...L,
      hl: (lang === 'en' && reel.hl_en) || reel.hl,
      shot: pathToFileURL(resolve(mk, 'src', L.shot + '.jpg')).href,
      logo: pathToFileURL(resolve(mk, 'src', 'logo.png')).href };
    const name = `${reel.id}-${lang}`;

    // feed post 1080x1350
    let page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.goto(pathToFileURL(tmpl).href);
    await page.evaluate(c => setup(c, 'post').then(() => renderPost()), cfg);
    const post = resolve(mk, 'posts', name + '.jpg');
    await page.screenshot({ path: post, type: 'jpeg', quality: 85 });
    await page.close();

    // reel frames
    page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(tmpl).href);
    await page.evaluate(c => setup(c, ''), cfg);
    const cover = resolve(mk, 'covers', name + '.jpg');
    await page.evaluate(() => render(2.95));                       // the hook question, fully shown
    await page.screenshot({ path: cover, type: 'jpeg', quality: 85 });
    let line = `${name}: post ${kb(post)} · cover ${kb(cover)}`;
    if (!noVideo) {
      const fdir = resolve(mk, '.frames', name); rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
      for (let i = 0; i < DUR * fps; i++) {
        await page.evaluate(t => render(t), i / fps);
        await page.screenshot({ path: resolve(fdir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
      }
      const mp4 = resolve(mk, 'reels', name + '.mp4');
      // silent AAC track: some platforms reject video-only uploads; replace with music inside the app.
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(fdir, '%04d.jpg'),
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(fps),
        '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', mp4]);
      rmSync(fdir, { recursive: true, force: true });
      line += ` · reel ${kb(mp4)}`;
    }
    await page.close();
    console.log(line);
  }
}
await browser.close();
rmSync(tmpl, { force: true }); rmSync(resolve(mk, '.frames'), { recursive: true, force: true });
