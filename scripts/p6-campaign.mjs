// Campaign screen check: five world rows of five tiles, each with a thumbnail. Needs the dev server.
import { chromium } from 'playwright-core';
const out = process.env.OUT ?? '/tmp/p6';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?quality=low');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await page.locator('.mm-item.primary').click();
for (const [i, name] of [[0, 'campaign']]) {
  await page.locator('.play-tile').nth(i).click();
  await page.waitForTimeout(8000);
  const n = await page.locator('.tile').count();
  const thumbs = await page.locator('.tile img[src^="data:"], .tile img[src^="blob:"]').count();
  console.log(`${name}: ${n} tiles, ${thumbs} thumbnails, ${await page.locator('.tier-row').count()} world rows`);
  await page.screenshot({ path: `${out}_${name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
