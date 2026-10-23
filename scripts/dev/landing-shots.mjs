// Screenshots of the landing page sections. Usage: node scripts/dev/landing-shots.mjs <outPrefix>
import { chromium } from 'playwright-core';
const prefix = process.argv[2] ?? '/tmp/landing';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:5173/');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
await page.waitForTimeout(2000);
const secs = await page.locator('.landing .ld-sec').count();
for (let i = 0; i < secs; i++) {
  await page.locator('.landing .ld-sec').nth(i).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${prefix}_sec${i}.png` });
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
