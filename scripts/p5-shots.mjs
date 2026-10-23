// Phase 5 visual check: each theme from the chase camera and a close orbit of the car.
// Usage: node scripts/p5-shots.mjs [quality] (needs `npx vite --port 5173 --host 127.0.0.1`)
import { chromium } from 'playwright-core';

const quality = process.argv[2] ?? 'high';
const out = process.env.OUT ?? '/tmp/claude-0/shots/p5';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('useProgram')) errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const levels = (process.env.LEVELS ?? 'c01:9,c02:14,c03:12,c05:16').split(',');
for (const spec of levels) {
  const [id, t] = spec.split(':');
  await page.goto(`http://127.0.0.1:5173/?debug=1&autodrive=1&quality=${quality}&level=${id}`);
  await page.waitForFunction(() => window.__nv?.race, null, { timeout: 60000 });
  await page.addStyleTag({ content: '.tuning,.debug,.hud-hints{display:none!important}' });
  await page.evaluate((s) => window.__nv.fastForward(Number(s)), t);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}_${id}_chase.png` });
  // close look: a camera beside and above the car
  await page.evaluate(() => {
    const g = window.__nv; const v = g.simulation.vehicle; const p = v.position;
    const side = v.right.clone().multiplyScalar(5.5).add(v.fwd.clone().multiplyScalar(-3.5));
    g.view([p.x + side.x, p.y + 2.2, p.z + side.z], [p.x, p.y + 0.3, p.z], 45);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}_${id}_close.png` });
  const info = await page.evaluate(() => ({ q: window.__nv.renderer.qualityLevel, theme: window.__nv.renderer.themeDef.id, ...window.__nv.renderer.frameStats }));
  console.log(id, JSON.stringify(info));
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
