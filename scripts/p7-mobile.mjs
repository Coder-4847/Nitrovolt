// Phase 7: the editor on a phone-sized touch screen (tap to move the cursor, tap again to place).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/?debug=1&quality=low');
await page.waitForSelector('.main-menu', { timeout: 60000 });
await page.addStyleTag({ content: '.tuning,.debug{display:none!important}' });
await page.getByRole('button', { name: 'Track editor' }).tap();
await page.getByRole('button', { name: 'New track' }).tap();
await page.waitForSelector('.editor-ui');
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/claude-0/shots/p7m_1.png' });
// place by tapping the chained cursor cell twice is not needed: the cursor is at the exit, one tap there places
await page.locator('.ed-block[title="Straight 2"]').tap();
const before = await page.evaluate(() => window.__nv.editor.model.json.blocks.length);
// tap the Panels toggle to fold, then tap the centre of the screen twice
await page.locator('.ed-fold').tap();
await page.touchscreen.tap(422, 250);
await page.waitForTimeout(300);
await page.touchscreen.tap(422, 250);
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__nv.editor.model.json.blocks.length);
console.log(after > before ? 'PASS' : 'FAIL', `double tap places a block (${before} -> ${after})`);
await page.screenshot({ path: '/tmp/claude-0/shots/p7m_2.png' });
console.log(errs.join('\n') || 'no page errors');
await browser.close();
