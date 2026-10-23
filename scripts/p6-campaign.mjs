// Phase 6 check: the campaign map shows all four full seasons (25 thumbnails each). Needs the dev server.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?quality=low');
await page.waitForSelector('.main-menu', { timeout: 60000 });
// unlock everything so every card shows its level
await page.evaluate(() => { localStorage.setItem('nitrovolt.settings.v1', JSON.stringify({ unlockAll: true })); });
await page.reload();
await page.waitForSelector('.main-menu', { timeout: 60000 });
await page.getByRole('button', { name: 'Campaign' }).click();
for (let s = 0; s < 4; s++) {
  await page.locator('.tab').nth(s).click();
  await page.waitForTimeout(4500);
  const n = await page.locator('.card:not(.empty)').count();
  const thumbs = await page.locator('.card img[src^="data:"]').count();
  console.log(`season ${s + 1}: ${n} level cards, ${thumbs} thumbnails`);
  await page.screenshot({ path: `/tmp/claude-0/shots/p6_season${s + 1}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
