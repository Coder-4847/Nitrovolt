import { carParams } from '../../src/data/cars';
import { makeFrame } from '../../src/core/InputFrame';
import { Simulation } from '../../src/physics/Simulation';
import { PathBot, applyBotHints } from '../../src/tracks/PathBot';
import { buildLevel } from '../levels/build';
import { LEVEL_DEFS } from '../levels/index';
const def = LEVEL_DEFS.find((d) => d.id === 'lab')!;
const { track } = buildLevel(def);
const S = 140 / 3.6;
const sim = await Simulation.create(track, carParams('volt'), false, undefined, undefined, 'volt');
const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params);
applyBotHints(bot, { maxSpeed: 85 });
const v = sim.vehicle;
const c = track.centerline, fr = track.centerFrame;
for (let i = 0; i < 1100; i++) {
  const f = bot.drive(v);
  const near = v.position.x > 90 && bot.progress < 0.135;
  const err = S - v.speed;
  sim.step(near ? makeFrame(f.steer, Math.max(0, Math.min(1, err * 0.6)), err < -2 ? 0.4 : 0) : f);
  if (v.position.x > 110 && i % 6 === 0 && sim.time < 10.2) {
    let best = 0, bd = 1e9;
    c.forEach((q, k) => { const d = q.distanceTo(v.position); if (d < bd) { bd = d; best = k; } });
    const n = fr[best]!.u;
    const ang = Math.acos(Math.min(1, v.up.dot(n))) * 57.3;
    const bank = Math.acos(n.y) * 57.3;
    // heading vs path tangent (horizontal)
    const t = c[Math.min(c.length - 1, best + 1)]!.clone().sub(c[Math.max(0, best - 1)]!).setY(0).normalize();
    const hv = v.linvel.clone().setY(0).normalize();
    const hdg = Math.atan2(hv.x * t.z - hv.z * t.x, hv.dot(t)) * 57.3;
    console.log(`t=${sim.time.toFixed(2)} bank ${bank.toFixed(0)} up-vs-normal ${ang.toFixed(1)} vel-vs-tangent ${hdg.toFixed(1)} wY=${v.angvel.y.toFixed(2)} wUp=${v.angvel.dot(v.up).toFixed(2)} wRight=${v.angvel.dot(v.right).toFixed(2)} wFwd=${v.angvel.dot(v.fwd).toFixed(2)} wheels=${v.wheelsOnGround} offCenter=${bd.toFixed(1)} h=${v.position.y.toFixed(1)}`);
  }
}
