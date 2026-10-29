// Headless smoke test + screenshots at given sim times (autodrive bot fast-forwards).
// Usage: node scripts/shoot.mjs "<query>" <outPrefix> <simSeconds...>   (env: NOTUNE=1 hides tuning panel, CAM=far|hood)
import { chromium } from 'playwright-core';

const [, , query = '?debug=1&autodrive=1', prefix = '/tmp/shot', ...times] = process.argv;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:5173/${query}`);
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => errors.push('boot never finished'));
if (process.env.NOTUNE) await page.addStyleTag({ content: '.tuning{display:none!important}' });
if (process.env.CAM) await page.evaluate((c) => { const r = window.__nv.renderer.rig; while (r.mode !== c) r.cycle(); }, process.env.CAM);
for (const t of times) {
  const target = parseFloat(t);
  const info = await page.evaluate((tt) => {
    const g = window.__nv; if (!g) return 'no __nv';
    const dt = tt - g.simulation.time;
    if (dt > 0) g.fastForward(dt);
    return 'ok';
  }, target);
  await page.waitForTimeout(Number(process.env.WAIT ?? 700));
  await page.screenshot({ path: `${prefix}_${t}.png` });
  const st = await page.evaluate(() => { const v = window.__nv.simulation.vehicle; return `t=${window.__nv.simulation.time.toFixed(1)} speed=${(v.speed*3.6).toFixed(0)}km/h pos=${v.position.toArray().map(n=>n.toFixed(0))} contacts=${v.wheelsOnGround} air=${v.airTime.toFixed(2)}`; });
  console.log(t, info, st);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
