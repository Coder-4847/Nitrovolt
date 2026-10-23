import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?debug=1&level=dune01');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
await page.addStyleTag({ content: '.tuning,.debug{display:none!important}' });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Garage' }).click();
await page.waitForTimeout(500);
const before = await page.evaluate(() => window.__nv.renderer.car.root.children.length);
// Dune is the 4th car in the garage list: its paint row is the 7th swatch group
await page.locator('.set-body .swatches').nth(6).locator('.sw').nth(5).click(); // blue
await page.waitForTimeout(300);
const stored = await page.evaluate(() => localStorage.getItem('nitrovolt.livery.dune'));
console.log('stored livery:', stored);
await page.screenshot({ path: '/tmp/claude-0/shots/menu_car.png' });
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// reload: livery must persist
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
console.log('persisted:', await page.evaluate(() => localStorage.getItem('nitrovolt.livery.dune')));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
