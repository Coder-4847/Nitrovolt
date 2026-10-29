import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const level = process.argv[2] ?? 'c01';
for (const n of [1, 2]) {
  await page.goto(`http://127.0.0.1:5173/?debug=1&autodrive=1&level=${level}`);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.addStyleTag({ content: '.tuning,.debug{display:none!important}' });
  if (n === 2) await page.evaluate(() => { window.__nv.simulation.vehicle.params.maxPower *= 0.9; window.__nv.simulation.vehicle.params.maxDriveForce *= 0.9; });
  await page.evaluate(() => {
    const g = window.__nv;
    for (let i = 0; i < 60 && g.simulation.run.state !== 'finished'; i++) g.fastForward(1);
  });
  await page.waitForTimeout(900);
  console.log(`run ${n}:`, await page.evaluate(() => { const r = window.__nv.simulation.run; return JSON.stringify({ state: r.state, time: r.finishTime, splits: r.splits }); }));
  await page.screenshot({ path: `/tmp/claude-0/shots/finish_${n}.png` });
}
console.log('records:', await page.evaluate(() => localStorage.getItem('nitrovolt.records.v2')));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
