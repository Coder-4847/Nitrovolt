import { readFileSync } from 'node:fs';
// Release smoke test against a production build served from a sub-path, like GitHub Pages:
//   BASE_PATH=/Nitrovolt/ npm run build && BASE_PATH=/Nitrovolt/ npx vite preview --port 4173 --host 127.0.0.1 &
//   node scripts/deploy-test.mjs
// Checks: the menu loads, the manifest and icons resolve, the service worker takes control, a race starts,
// then everything again with the network switched off (installable + offline).
import { chromium } from 'playwright-core';

const base = process.env.URL ?? 'http://127.0.0.1:4173/Nitrovolt/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('useProgram')) errors.push(m.text().slice(0, 200)); });
const ok = (c, msg) => console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`);

const t0 = Date.now();
await page.goto(base);
await page.waitForSelector('.screen.top', { timeout: 60000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
ok(true, `menu shown after ${((Date.now() - t0) / 1000).toFixed(1)} s (software GL)`);
const manifest = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]').href;
  const m = await (await fetch(href)).json();
  const icons = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, href))).status));
  return { name: m.name, icons };
});
ok(manifest.name === 'NITROVOLT' && manifest.icons.every((s) => s === 200), `manifest + ${manifest.icons.length} icons resolve under the sub-path`);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 30000 });
await page.evaluate(() => navigator.serviceWorker.ready);
// wait for precache to finish (install), then reload so the worker controls the page
await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('nitrovolt-')), null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.reload();
await page.waitForSelector('.screen.top', { timeout: 60000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
const cached = await page.evaluate(async () => {
  const c = await caches.open((await caches.keys()).find((k) => k.startsWith('nitrovolt-')));
  const keys = (await c.keys()).map((r) => r.url);
  return { n: keys.length, art: keys.filter((u) => u.includes('/art/')).length };
});
ok(controlled && cached.art >= 9, `service worker controls the page (${cached.n} files precached, ${cached.art} menu pictures)`);

await page.locator('.mm-list .mm-item').nth(1).click(); // Continue
await page.waitForFunction(() => document.querySelector('.hud')?.style.display !== 'none' && document.querySelector('.hud-time'), null, { timeout: 60000 });
await page.waitForTimeout(2500);
ok(true, 'a race starts online (physics WASM loaded from its own file)');

// offline
await ctx.setOffline(true);
await page.goto(base);
await page.waitForSelector('.screen.top', { timeout: 60000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
ok(true, 'menu loads with the network off');
await page.locator('.mm-list .mm-item').nth(1).click(); // Continue
await page.waitForTimeout(6000);
const racing = await page.evaluate(() => getComputedStyle(document.querySelector('.hud')).display !== 'none');
ok(racing, 'a race starts offline');
await page.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/p8_offline_race.png` });
// determinism in the production build: the bot reproduces the author time recorded by the dev pipeline
await ctx.setOffline(false);
const p3 = await ctx.newPage();
await p3.goto(`${base}?debug=1&autodrive=1&level=c18&quality=low`);
await p3.waitForFunction(() => window.__nv?.race, null, { timeout: 60000 });
const res = await p3.evaluate(async () => {
  const g = window.__nv;
  for (let i = 0; i < 90 && g.simulation.run.state !== 'finished'; i++) g.fastForward(1);
  return { time: g.simulation.run.finishTime };
});
const author = JSON.parse(readFileSync(new URL('../src/data/levels/c18.json', import.meta.url), 'utf8')).target;
ok(res.time === author, `production physics is bit-identical: bot finishes c18 (two cars) in ${res.time} ms (author ${author})`);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
