// Screenshots of levels in the race view while the bot drives. Usage: node scripts/level-shots.mjs <outPrefix> <id:sec,sec> [<id:sec,sec> ...]
// (needs the dev server on :5173; the software renderer is slow, so the waits are long)
import { chromium } from 'playwright-core';
const prefix = process.argv[2];
const jobs = process.argv.slice(3).map((a) => { const [id, secs] = a.split(':'); return { id, secs: secs.split(',').map(Number) }; });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
for (const { id, secs } of jobs) {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
  await page.addInitScript(() => { try { localStorage.setItem('nitrovolt.settings.v1', JSON.stringify({ ghosts: 'both', countdown: 'instant' })); } catch { /* ignore */ } });
  page.on('pageerror', (e) => errs.push(`${id}: ${e.message}`));
  await page.goto(`http://127.0.0.1:5173/?level=${id}&debug=1&autodrive=1&quality=${process.env.Q ?? 'low'}`);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 90000 });
  await page.waitForFunction(() => window.__nv?.race, null, { timeout: 90000 });
  if (!process.env.DEBUGUI) await page.addStyleTag({ content: '.tuning, .debug { display: none !important; }' });
  let at = 0;
  for (const s of secs) {
    await page.evaluate((d) => window.__nv.fastForward(d), s - at);
    at = s;
    await page.waitForTimeout(Number(process.env.WAIT ?? 6000));
    await page.screenshot({ path: `${prefix}_${id}_${s}.png` });
  }
  await page.close();
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
