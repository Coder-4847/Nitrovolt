import { carParams } from '../../src/data/cars';
import { Simulation } from '../../src/physics/Simulation';
import { RAPIER } from '../../src/physics/RapierWorld';
import { PathBot, applyBotHints } from '../../src/tracks/PathBot';
import { buildLevel } from '../levels/build';
import { LEVEL_DEFS } from '../levels/index';
import { Vector3 } from 'three';
const def = LEVEL_DEFS.find((d) => d.id === 'lab')!;
const { track } = buildLevel(def);
const sim = await Simulation.create(track, carParams('volt'), false, undefined, undefined, 'volt');
const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params);
applyBotHints(bot, { maxSpeed: 75, lateralBudget: 45 });
const v = sim.vehicle;
for (let i = 0; i < 1400; i++) {
  sim.step(bot.drive(v));
  if (sim.time > 9.7 && sim.time < 9.95 && i % 4 === 0) {
    const out: string[] = [];
    for (let k = 0; k < 4; k++) {
      const m = v.mountLocal[k]!.clone().applyQuaternion(v.quaternion).add(v.position);
      const ray = new RAPIER.Ray({ x: m.x, y: m.y, z: m.z }, { x: -v.up.x, y: -v.up.y, z: -v.up.z });
      const hits: string[] = [];
      sim.world.world.intersectionsWithRay(ray, 5, true, (h) => { hits.push(`${h.timeOfImpact.toFixed(2)}@n(${h.normal.x.toFixed(2)},${h.normal.y.toFixed(2)},${h.normal.z.toFixed(2)})${sim.world.infoOf(h.collider.handle).surface}`); return true; }, undefined, undefined, undefined, (sim.vehicle as unknown as { body: unknown }).body as never);
      out.push(`w${k}:[${hits.join(' ')}]`);
    }
    console.log(`t=${sim.time.toFixed(2)} up=${v.up.toArray().map((n) => n.toFixed(2))} pos=${v.position.toArray().map((n) => n.toFixed(1))} ${out.join(' ')}`);
  }
}
// the road's cross-section at the car's position: nearest centerline frame
const c = track.centerline; let best = 0, bd = 1e9;
const p = new Vector3(140.5, 12.1, -182.4);
c.forEach((q, i) => { const d = q.distanceTo(p); if (d < bd) { bd = d; best = i; } });
console.log('nearest sample', best, c[best]!.toArray().map((n) => n.toFixed(1)), 'u', track.centerFrame[best]!.u.toArray().map((n) => n.toFixed(2)), 'dist', bd.toFixed(1));
