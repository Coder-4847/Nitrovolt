// Phase 7 end-to-end: build a track in the editor with the UI, validate it with the bot, test drive,
// return to the editor, share it and open the link in a fresh browser. Needs the dev server.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '/tmp/claude-0/shots/p7';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('useProgram')) errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const ok = (c, msg) => console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`);
const shot = async (n, w = 400) => { await page.waitForTimeout(w); await page.screenshot({ path: `${out}_${n}.png` }); };

await page.goto('http://127.0.0.1:5173/?debug=1&quality=medium');
await page.waitForSelector('.screen.top', { timeout: 60000 }); if (await page.locator('.landing').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await page.waitForSelector('.main-menu');
await page.addStyleTag({ content: '.tuning,.debug{display:none!important}' });
await page.getByRole('button', { name: 'Track editor' }).click();
await page.waitForSelector('.my-levels');
await page.getByRole('button', { name: 'New track' }).click();
await page.waitForSelector('.editor-ui', { timeout: 15000 });
await shot('01_new', 800);
ok(await page.evaluate(() => window.__nv.editor?.model.json.blocks.length) === 1, 'new track has a start block');

// build with the palette + Space (chain mode moves the cursor to each exit)
const pick = async (tab, title) => {
  await page.locator('.ed-tabs .tab', { hasText: tab }).click();
  await page.locator(`.ed-block[title="${title}"]`).click();
};
const plan = [['Road', 'Straight 2'], ['Road', 'Straight 2'], ['Curves', 'Curve 2 right'], ['Road', 'Straight 2'], ['Start / CP', 'Checkpoint'], ['Road', 'Straight 4'],
  ['Curves', 'Curve 3 left'], ['Slopes & jumps', 'Slope up 1'], ['Road', 'Straight 2'], ['Slopes & jumps', 'Slope down 1'], ['Road', 'Straight 2'], ['Start / CP', 'Finish'], ['Road', 'Straight 1']];
for (const [tab, title] of plan) {
  await pick(tab, title);
  await page.mouse.move(1200, 760); // over the side panel: the chained cursor stays put
  await page.keyboard.press('Space');
}
await shot('02_built', 900);
const st = await page.evaluate(() => ({ n: window.__nv.editor.model.json.blocks.length, status: document.querySelector('.ed-status').textContent }));
ok(st.n === plan.length + 1, `placed ${st.n - 1} blocks with the palette`);
ok(st.status.includes('Drivable'), `checks say drivable (${st.status.slice(0, 80)})`);

// undo / redo
await page.keyboard.press('Control+z');
const afterUndo = await page.evaluate(() => window.__nv.editor.model.json.blocks.length);
await page.keyboard.press('Control+y');
const afterRedo = await page.evaluate(() => window.__nv.editor.model.json.blocks.length);
ok(afterUndo === st.n - 1 && afterRedo === st.n, 'undo / redo');

// a mouse click places at the hovered cell
await page.locator('.ed-tabs .tab', { hasText: 'Scenery' }).click();
await page.locator('.ed-block[title="Pylon"]').click();
const box = await page.locator('canvas').boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.62);
await page.waitForTimeout(300);
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__nv.editor.model.json.blocks.some((b) => b.type === 'pylon')), 'mouse click places a block');
await shot('03_pylon', 500);

// rename via the side panel
await page.locator('.ed-meta input[type=text]').fill('Test Ring');
await page.locator('.ed-meta input[type=text]').press('Enter');
await page.locator('canvas').click({ position: { x: 5, y: 5 }, button: 'right' });

// validate with the bot
await page.getByRole('button', { name: 'Validate (bot)' }).click();
await page.waitForFunction(() => document.querySelector('.ed-status')?.textContent.includes('Author'), null, { timeout: 120000 });
const author = await page.evaluate(() => window.__nv.editor.model.json.medalTimes.author);
ok(author > 0, `bot validated, author ${author} ms`);
await shot('04_validated', 500);

// test drive and back
await page.keyboard.press('KeyG');
await page.waitForFunction(() => window.__nv?.race, null, { timeout: 20000 });
ok(await page.evaluate(() => window.__nv.mode) === 'race', 'G starts a test drive');
await page.waitForTimeout(2200);
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
await shot('05_testdrive', 300);
await page.keyboard.press('Escape');
await page.waitForSelector('.pause');
await shot('06_testpause', 300);
await page.getByRole('button', { name: 'Back to the editor' }).click();
await page.waitForSelector('.editor-ui');
ok(await page.evaluate(() => window.__nv.editor.model.json.name) === 'Test Ring', 'back in the editor with the same track');

// share
await page.keyboard.press('Escape');
await page.waitForSelector('.screen.pause');
await shot('07_menu', 300);
await page.getByRole('button', { name: 'Share link' }).click();
await page.waitForSelector('.share-box');
const link = await page.locator('.share-box input').inputValue();
ok(link.includes('#track=z'), `share link (${link.length} chars)`);
await shot('08_share', 300);
await page.getByRole('button', { name: 'Close' }).click();
await page.getByRole('button', { name: 'Exit to My tracks' }).click();
await page.waitForSelector('.ml-card');
await shot('09_mytracks', 1200);
ok((await page.locator('.ml-card').first().textContent()).includes('Author'), 'My tracks shows the validated track');

// open the link in a brand-new browser profile
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push(`[pageerror 2] ${e.message}`));
await p2.goto(link.replace('?', '?').replace('#', '?debug=1&quality=low#'));
await p2.waitForFunction(() => window.__nv?.race, null, { timeout: 60000 });
const name2 = await p2.evaluate(() => window.__nv.race.track.name);
ok(name2 === 'Test Ring', `shared link opens the track in a fresh browser (${name2})`);
await p2.waitForTimeout(1500);
await p2.screenshot({ path: `${out}_10_shared.png` });

console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
