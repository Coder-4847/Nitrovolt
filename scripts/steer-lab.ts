import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

async function main(): Promise<void> {
  const sim = await Simulation.create(buildFlatPad(), cloneParams(VOLT));
  const v = sim.vehicle;
  for (const target of [15, 30, 50, 75]) {
    sim.restart();
    for (let i = 0; i < 4000 && v.speed < target; i++) sim.step(makeFrame(0, 1, 0));
    const cruise = (): number => Math.max(0, Math.min(1, (target - v.speed) * 0.5 + 0.2));
    console.log(`--- speed ${target} m/s: steer step 0.5 (ramped over 0.1s) for 1.0s, then release for 1.5 s`);
    let line = '';
    for (let i = 0; i < 250; i++) {
      const ramp = Math.min(1, i / 10);
      const st = i < 100 ? 0.5 * ramp : 0;
      sim.step(makeFrame(st, cruise(), 0));
      if (i % 12 === 0) line += `${(i / 100).toFixed(2)}s yaw=${v.angvel.y.toFixed(2)} slip=${(v.bodySlip * 57.3).toFixed(1)}° | `;
    }
    console.log(line);
    console.log(`final yaw ${v.angvel.y.toFixed(2)} slip ${(v.bodySlip * 57.3).toFixed(1)}° speed ${v.speed.toFixed(1)}`);
  }
}
main();
