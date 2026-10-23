import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?debug=1&track=flat');
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
const st = () => page.evaluate(() => { const g = window.__nv; const v = g.simulation.vehicle; return { t: +g.simulation.time.toFixed(2), speed: +(v.speed * 3.6).toFixed(0), x: +v.position.x.toFixed(1), z: +v.position.z.toFixed(1), steer: +v.steerAngle.toFixed(2), tick: g.simulation.tick, respawns: g.simulation.respawnCount, mode: g.renderer.rig.mode }; });
const log = async (label) => console.log(label.padEnd(28), JSON.stringify(await st()));

await log('start');
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await log('W held 3s');
await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await log('+D held 1.5s (x should move)');
await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
await page.keyboard.press('Backspace'); await page.waitForTimeout(500); await log('Backspace (respawn)');
await page.keyboard.press('Enter'); await page.waitForTimeout(400); await log('Enter (restart)');
await page.keyboard.press('KeyC'); await page.waitForTimeout(300); await log('C (camera)');
await page.keyboard.press('KeyC'); await page.waitForTimeout(300); await log('C (camera)');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
console.log('menu open:', await page.evaluate(() => !!document.querySelector('.screen.pause')));
await page.screenshot({ path: '/tmp/claude-0/shots/menu.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('menu open after Esc:', await page.evaluate(() => !!document.querySelector('.screen.pause')));
// mouse steering
await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
await page.mouse.move(800, 300);
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await log('mouse steer right + W');
await page.keyboard.up('KeyW');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
