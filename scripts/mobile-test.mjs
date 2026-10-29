import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?debug=1&track=flat');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
await page.waitForTimeout(800);
const touchOn = await page.evaluate(() => document.getElementById('touch').classList.contains('on'));
console.log('touch UI visible:', touchOn, 'quality:', await page.evaluate(() => window.__nv.renderer.qualityLevel));
// press gas via touch (dispatch pointer events on the element)
const press = (sel) => page.evaluate((s) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); const o = { bubbles: true, pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: 'touch' }; el.dispatchEvent(new PointerEvent('pointerdown', o)); }, sel);
const release = (sel) => page.evaluate((s) => { const el = document.querySelector(s); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })); }, sel);
await press('#touch .gas'); await page.waitForTimeout(2500);
await press('#touch .steer.r'); await page.waitForTimeout(1200);
const st = await page.evaluate(() => { const v = window.__nv.simulation.vehicle; return `speed ${(v.speed*3.6).toFixed(0)} x ${v.position.x.toFixed(1)}`; });
console.log('after gas + right:', st);
await page.screenshot({ path: '/tmp/claude-0/shots/mobile.png' });
await release('#touch .gas'); await release('#touch .steer.r');
await press('#touch .rs'); await release('#touch .rs'); await page.waitForTimeout(500);
console.log('after restart button: tick', await page.evaluate(() => window.__nv.simulation.tick));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
