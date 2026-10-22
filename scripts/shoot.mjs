// Headless smoke test + screenshots. Usage: node scripts/shoot.mjs "<query>" <outPrefix> <seconds...>
import { chromium } from 'playwright-core';

const [, , query = '?debug=1', prefix = '/tmp/shot', ...times] = process.argv;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:5173/${query}`);
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => errors.push('boot never finished'));
let last = 0;
for (const t of times.length ? times : ['1']) {
  const target = parseFloat(t);
  await page.waitForTimeout(Math.max(0, (target - last) * 1000));
  last = target;
  await page.screenshot({ path: `${prefix}_${t}.png` });
  const info = await page.evaluate(() => {
    const g = window.__nv; if (!g) return 'no __nv';
    const v = g.simulation.vehicle;
    return `t=${g.simulation.time.toFixed(1)} speed=${(v.speed*3.6).toFixed(0)}km/h pos=${v.position.toArray().map(n=>n.toFixed(0))} contacts=${v.wheelsOnGround} respawns=${g.simulation.respawnCount}`;
  });
  console.log(t, info);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
