import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

async function main(): Promise<void> {
  const sim = await Simulation.create(buildFlatPad(), cloneParams(VOLT));
  const v = sim.vehicle;
  for (let i = 0; i < 4000 && v.speed < 35; i++) sim.step(makeFrame(0, 1, 0));
  for (let i = 0; i < 200; i++) {
    sim.step(makeFrame(1, v.speed < 35 ? 1 : 0.3, 0));
    if (i % 10 === 0) {
      const w = v.wheels;
      console.log(`i=${i} spd=${v.speed.toFixed(1)} yaw=${v.angvel.y.toFixed(2)} slip=${v.bodySlip.toFixed(2)} steer=${v.steerAngle.toFixed(2)} | FL a=${w[0]!.slipAngle.toFixed(2)} use=${w[0]!.gripUse.toFixed(2)} | RL a=${w[2]!.slipAngle.toFixed(2)} use=${w[2]!.gripUse.toFixed(2)} fy=${Math.round(w[2]!.forceLat)} fx=${Math.round(w[2]!.forceLong)} load=${Math.round(w[2]!.load)}/${Math.round(w[0]!.load)}`);
    }
  }
}
main();
