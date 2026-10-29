// Overview shots of the track from above / side. Usage: node scripts/overview.mjs <outPrefix>
import { chromium } from 'playwright-core';
const prefix = process.argv[2] ?? '/tmp/ov';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:5173/?debug=1&autodrive=1&level=${process.env.LEVEL ?? 'c01'}`);
await page.addStyleTag({ content: '.tuning,.debug,.hud,#vignette{display:none!important}' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
const views = JSON.parse(process.argv[3] ?? '[]');
for (const [name, pos, target, fov] of views) {
  await page.evaluate(([p, t, f]) => window.__nv.view(p, t, f), [pos, target, fov]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${prefix}_${name}.png` });
}
await browser.close();
