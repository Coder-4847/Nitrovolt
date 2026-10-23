// Phase 4 end-to-end: menus, campaign, race, finish + medal, replay, ghost. Needs `npx vite --port 5173 --host 127.0.0.1`.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '/tmp/p4';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const shot = async (name, wait = 500) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}_${name}.png` }); };
const ok = (c, msg) => console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`);

await page.goto('http://127.0.0.1:5173/?debug=1');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
ok(await page.locator('.landing').count() === 1, 'landing page shown first');
await page.keyboard.press('Escape');
await shot('01_menu', 1000);
ok(await page.locator('.main-menu').count() === 1, 'main menu shown');

await page.locator('.mm-item.primary').click();
await shot('02_play', 1000);
ok(await page.locator('.play-tile').count() === 4, 'play hub shows 4 tiles');
await page.locator('.play-tile.big').click();
await shot('03_campaign', 1500);
ok(await page.locator('.tier-row').count() === 5, '5 tier rows');
ok(await page.locator('.tile').count() === 25, '25 campaign tiles');
ok(await page.locator('.tile.locked').count() === 20, 'only the White tier is open');

// start the first track via its tile
await page.locator('.tile:not(.locked)').first().click();
await page.waitForFunction(() => window.__nv?.race, null, { timeout: 15000 });
await shot('04_countdown', 400);
const phase1 = await page.evaluate(() => window.__nv.race.phase);
ok(phase1 === 'grid', `countdown phase right after start (${phase1})`);
await page.waitForFunction(() => window.__nv.race.phase === 'running', null, { timeout: 90000 }); // software GL runs at ~1 fps
await shot('05_running', 600);
ok(true, 'countdown completed -> running');

// pause menu
await page.keyboard.press('Escape');
await shot('06_pause', 400);
ok(await page.locator('.pause').count() === 1, 'pause screen opens on Esc');
await page.keyboard.press('Escape');
await page.waitForSelector('.pause', { state: 'detached', timeout: 20000 }).catch(() => {});
ok(await page.locator('.pause').count() === 0, 'Esc again resumes');

// settings screen
await page.waitForTimeout(4000); // let a few (software-GL) frames pass so the key is not merged with the last one
await page.keyboard.press('Escape');
await page.waitForSelector('.pause', { timeout: 20000 });
await page.locator('.pause').getByRole('button', { name: 'Settings' }).click();
await shot('07_settings', 400);
await page.getByRole('button', { name: 'Accessibility' }).click();
await shot('08_access', 300);
await page.getByRole('button', { name: 'Data' }).click();
await shot('09_data', 300);
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// bot run for finish / medal / replay / ghost
await page.goto('http://127.0.0.1:5173/?debug=1&level=c01&autodrive=1');
await page.waitForFunction(() => window.__nv?.race, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.removeItem('nitrovolt.records.v1'); });
await page.evaluate(() => window.__nv.fastForward(90));
await shot('10_finish', 1800);
const fin = await page.evaluate(() => ({ phase: window.__nv.race.phase, time: window.__nv.simulation.run.finishTime, last: !!window.__nv.race.lastRun }));
ok(fin.phase === 'finished' && fin.time > 0, `finished in ${fin.time} ms`);
ok(fin.last, 'run recorded for replay');
ok(await page.locator('.hud-finish .medal').count() >= 1, 'medal badge on finish panel');

await page.keyboard.press('KeyV');
await page.waitForFunction(() => document.querySelector('.replay-bar'), null, { timeout: 15000 });
await shot('11_replay', 2200);
await page.keyboard.press('KeyV'); await page.keyboard.press('KeyV'); await page.keyboard.press('KeyV');
await shot('12_replay_orbit', 800);
await page.keyboard.press('KeyV');
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
await shot('13_replay_free', 500);
// scrub
await page.evaluate(() => { const s = document.querySelector('.rp-scrub'); s.value = String(Math.floor(Number(s.max) * 0.5)); s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
await shot('14_replay_mid', 1500);
await page.keyboard.press('Escape');
await page.waitForSelector('.replay-bar', { state: 'detached', timeout: 20000 }).catch(() => {});
ok(await page.locator('.replay-bar').count() === 0, 'Esc exits the replay back to the finish screen');
ok(await page.locator('.hud-finish.show').count() === 1, 'finish panel is back');

// retry -> ghost visible
await page.keyboard.press('Enter');
await page.waitForTimeout(2200);
const ghosts = await page.evaluate(() => window.__nv.race.ghostCount);
ok(ghosts >= 1, `ghost loaded after a PB (${ghosts})`);
await page.evaluate(() => window.__nv.fastForward(12));
await shot('15_ghost_race', 800);


// menu keyboard navigation + leaderboard + export/import
await page.goto('http://127.0.0.1:5173/?debug=1');
await page.waitForSelector('.screen.top', { timeout: 30000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
const first = await page.evaluate(() => document.activeElement?.textContent);
await page.keyboard.press('ArrowDown');
const focused = await page.evaluate(() => document.activeElement?.textContent);
ok(first?.startsWith('Play') && focused?.startsWith('Continue'), `menu starts on Play, ArrowDown moves to Continue (${focused})`);
await page.keyboard.press('ArrowUp');
await page.keyboard.press('Enter');
await page.waitForSelector('.screen.play');
await page.keyboard.press('Enter');
await page.waitForSelector('.level-select');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForSelector('.screen.top', { timeout: 30000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
ok(true, 'Enter opens Play then Campaign, Esc returns');
const medalsAfter = await page.locator('.mm-medals span').allTextContents();
ok(medalsAfter.some((t) => /[1-9]/.test(t)), `main menu shows earned medals (${medalsAfter.join('|').replace(/\s+/g, ' ')})`);
await page.locator('.mm-item', { hasText: 'Records' }).click();
await shot('16_leaderboard', 800);
ok(await page.locator('table.lb tbody tr').count() >= 1, 'leaderboard lists the PB');
await page.keyboard.press('Escape');
await page.locator('.mm-item.primary').click();
await page.locator('.play-tile').nth(1).click();
await shot('17_training', 1500);
ok(await page.locator('.tile').count() >= 6 && await page.locator('.tile.locked').count() === 0, 'training tracks all open');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.locator('.mm-item', { hasText: 'Settings' }).click();
await page.getByRole('button', { name: 'Data' }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export save file' }).click()]);
const path = await dl.path();
const fs = await import('node:fs');
const save = JSON.parse(fs.readFileSync(path, 'utf8'));
ok(save.format === 'nitrovolt-save' && save.ghosts.length >= 1 && Object.keys(save.storage).some((k) => k.includes('records')), `export has records + ${save.ghosts.length} ghost(s)`);
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('input[type=file]', path);
await page.waitForFunction(() => performance.now() > 0 && true);
await page.waitForTimeout(1500);
await page.waitForSelector('.screen.top', { timeout: 20000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
const recs = await page.evaluate(() => localStorage.getItem('nitrovolt.records.v1'));
ok(!!recs && recs.includes('c01'), 'import restored the records after reload');

console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
