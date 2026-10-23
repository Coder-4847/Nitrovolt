// Screenshot of the dev car viewer. Usage: node scripts/car-shots.mjs <out.png> [car]
import { chromium } from 'playwright-core';
const [, , out = '/tmp/cars.png', car = 'all'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: car === 'all' ? 1200 : 300 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(`http://127.0.0.1:5173/dev/cars.html?car=${car}`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
await page.screenshot({ path: out });
await browser.close();
