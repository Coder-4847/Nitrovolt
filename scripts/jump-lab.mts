// Dev: where cars land off each ramp at a given approach speed (sizes the gaps in the hand-made levels). Usage: npx tsx scripts/jump-lab.ts
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { makeFrame } from '../src/core/InputFrame';

for (const car of ['volt', 'dune', 'frost', 'gravel']) {
  for (const ramp of ['kicker', 'jumpRamp', 'jumpRampLong', 'jumpRampBig']) {
    const line: string[] = [];
    for (const v0 of [20, 30, 40, 50, 60, 75]) {
      const items = [{ type: 'start' }, ...Array(12).fill({ type: 'straight4' }), { type: ramp }, { type: 'straight4', gap: 20, dy: -4 }];
      const { blocks } = layoutChain(items);
      const json = { id: 'j', name: 'j', car, theme: 'neon', seed: 1, laps: 1, blocks };
      const track = buildTrack(json);
      const def = getCar(car);
      const sim = await Simulation.create(track, carParams(def.id), false, undefined, def.behavior);
      // hold speed v0 with a simple controller, then coast over the ramp; measure the flight
      let lip: { x: number; y: number; z: number } | null = null;
      let d1 = 0, d2 = 0, d3 = 0, air = 0;
      // the car's height at rest on the run-up: the landing's top edge is at that road level
      let rest = Infinity;
      for (let t = 0; t < 8000; t++) {
        const v = sim.vehicle;
        if (t === 150) rest = v.position.y;
        const err = v0 - v.speed;
        sim.step(makeFrame(0, lip ? 0 : err > 0 ? Math.min(1, err * 0.5) : 0, !lip && err < -1 ? 0.3 : 0));
        if (v.wheelsOnGround === 0) air++;
        else air = 0;
        if (!lip && air === 3) lip = { x: v.position.x, y: v.position.y, z: v.position.z };
        if (lip) {
          const h = Math.hypot(v.position.x - lip.x, v.position.z - lip.z);
          if (!d1 && v.position.y < rest) d1 = h;
          if (!d2 && v.position.y < rest - 8) d2 = h;
          if (d2 && v.position.y < rest - 16) { d3 = h; break; }
        }
      }
      line.push(`${v0}:${d1.toFixed(0)}/${d2.toFixed(0)}/${d3.toFixed(0)}`);
    }
    console.log(car.padEnd(7), ramp.padEnd(13), line.join('  '), '  (m flown until back at run-up level / 8 m / 16 m below it)');
  }
}
