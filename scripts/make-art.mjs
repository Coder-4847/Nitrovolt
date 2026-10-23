// Renders the menu art into public/art: an in-race postcard per environment (chase camera, no HUD) and a
// transparent picture of each car. Needs the dev server (npm run dev). Usage: node scripts/make-art.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'public/art';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const POSTCARDS = [['forest', 'c01', 14], ['snow', 'c11', 14], ['desert', 'c03', 16], ['sunset', 'c04', 14], ['night', 'c06', 17.4]];
for (const [env, level, t] of POSTCARDS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:5173/?debug=1&autodrive=1&level=${level}&quality=high`);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 90000 });
  await page.addStyleTag({ content: '.hud,.debug,#touch,.tuning,.menu-toast,.hud-hints,.fps-counter,#vignette{display:none!important}' });
  await page.evaluate((tt) => window.__nv.fastForward(tt - window.__nv.simulation.time), t);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${env}.jpg`, type: 'jpeg', quality: 82 });
  console.log('postcard', env);
  await page.close();
}
for (const car of ['volt', 'gravel', 'frost', 'dune']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:5173/dev/car-solo.html?car=${car}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
  await page.locator('canvas').screenshot({ path: `${OUT}/car-${car}.png`, omitBackground: true });
  console.log('car', car);
  await page.close();
}
await browser.close();
