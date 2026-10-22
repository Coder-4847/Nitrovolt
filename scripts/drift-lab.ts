// Character test: how each car behaves on its home surface and on tarmac. npx tsx scripts/drift-lab.ts
import { makeFrame } from '../src/core/InputFrame';
import { CAR_IDS, CarId, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { SurfaceId } from '../src/physics/Surface';
import { cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

const HOME: Record<CarId, { surface: SurfaceId; speed: number }> = {
  volt: { surface: 'tarmac', speed: 40 }, gravel: { surface: 'dirt', speed: 26 }, frost: { surface: 'snow', speed: 22 }, dune: { surface: 'sand', speed: 32 },
};

async function make(car: CarId, surface: SurfaceId): Promise<Simulation> {
  const def = getCar(car);
  return Simulation.create(buildFlatPad(2500, 1600, surface), cloneParams(def.params), 0, 19.6, def.behavior);
}

/** steer step, then hold: report peak yaw, slip after 1 s, whether it spun. */
async function stepSteer(car: CarId, surface: SurfaceId, speed: number, steer: number, throttleHold: boolean): Promise<string> {
  const s = await make(car, surface);
  const v = s.vehicle;
  for (let i = 0; i < 4000 && v.speed < speed; i++) s.step(makeFrame(0, 1, 0));
  let peakYaw = 0, slip1 = 0, maxSlip = 0, minSpeed = v.speed;
  const v0 = v.speed;
  for (let i = 0; i < 200; i++) {
    const thr = throttleHold ? 1 : Math.max(0, Math.min(1, (speed - v.speed) * 0.4));
    s.step(makeFrame(steer * Math.min(1, i / 8), thr, 0));
    peakYaw = Math.max(peakYaw, Math.abs(v.angvel.y));
    maxSlip = Math.max(maxSlip, Math.abs(v.bodySlip));
    minSpeed = Math.min(minSpeed, v.speed);
    if (i === 100) slip1 = Math.abs(v.bodySlip);
  }
  const spun = maxSlip > 1.0 || v.forwardSpeed < 0;
  return `yaw ${peakYaw.toFixed(2)} slip@1s ${(slip1 * 57.3).toFixed(0).padStart(2)}deg max ${(maxSlip * 57.3).toFixed(0).padStart(2)}deg speed ${(v.speed / v0 * 100).toFixed(0)}%${spun ? '  SPIN' : ''}`;
}

for (const c of CAR_IDS) {
  const h = HOME[c];
  console.log(`\n== ${c} (home: ${h.surface} @ ${h.speed} m/s)`);
  console.log('  steer 0.5, hold speed     home  ', await stepSteer(c, h.surface, h.speed, 0.5, false));
  console.log('  steer 0.5, hold speed     tarmac', await stepSteer(c, 'tarmac', h.speed, 0.5, false));
  console.log('  steer 0.8, FULL THROTTLE  home  ', await stepSteer(c, h.surface, h.speed, 0.8, true));
  console.log('  steer 0.8, FULL THROTTLE  tarmac', await stepSteer(c, 'tarmac', h.speed, 0.8, true));
}
