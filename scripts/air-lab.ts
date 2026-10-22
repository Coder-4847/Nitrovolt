import { Quaternion, Vector3 } from 'three';
import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

async function main(): Promise<void> {
  const sim = await Simulation.create(buildFlatPad(), cloneParams(VOLT));
  const v = sim.vehicle;
  // launch at 40 m/s, 16 deg up, car pitched 16 deg nose-up, from 40 m height
  const ang = 16 * Math.PI / 180;
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), ang);
  v.reset(new Vector3(0, 40, 0), q, new Vector3(0, 40 * Math.sin(ang), -40 * Math.cos(ang)));
  for (let i = 0; i < 300; i++) {
    sim.step(makeFrame(0, 0, 0));
    if (i % 10 === 0) {
      const velPitch = Math.atan2(v.linvel.y, Math.hypot(v.linvel.x, v.linvel.z));
      console.log(`t=${sim.time.toFixed(2)} y=${v.position.y.toFixed(1)} carPitch=${Math.asin(v.fwd.y).toFixed(2)} velPitch=${velPitch.toFixed(2)} wx=${v.angvel.x.toFixed(2)}`);
    }
    if (v.wheelsOnGround > 0) break;
  }
}
main();
