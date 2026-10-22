import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

async function main(): Promise<void> {
  const sim = await Simulation.create(buildFlatPad(300, 300), cloneParams(VOLT));
  const v = sim.vehicle;
  for (let i = 0; i < 600; i++) {
    sim.step(makeFrame(0, 0, 0));
    if (i % 50 === 0) console.log(`t=${sim.time.toFixed(2)} linvel=${v.linvel.toArray().map((n) => n.toFixed(3))} angvel=${v.angvel.toArray().map((n) => n.toFixed(3))} y=${v.position.y.toFixed(4)} fx=${v.wheels.map((w) => Math.round(w.forceLong))} fy=${v.wheels.map((w) => Math.round(w.forceLat))}`);
  }
}
main();
