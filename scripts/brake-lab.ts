// Brake-tap stability: full throttle + steer, then a short brake tap (keyboard S / trigger). npx tsx scripts/brake-lab.ts
import { makeFrame } from '../src/core/InputFrame';
import { CAR_IDS, CarId, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { SurfaceId } from '../src/physics/Surface';
import { cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

const HOME: Record<CarId, SurfaceId> = { volt: 'tarmac', gravel: 'dirt', frost: 'snow', dune: 'sand' };

async function tap(car: CarId, surface: SurfaceId, speed: number, steer: number, tapTicks: number, brake = 1): Promise<string> {
  const def = getCar(car);
  const s = await Simulation.create(buildFlatPad(2500, 1600, surface), cloneParams(def.params), 0, 19.6, def.behavior);
  const v = s.vehicle;
  for (let i = 0; i < 6000 && v.speed < speed; i++) s.step(makeFrame(0, 1, 0));
  for (let i = 0; i < 60; i++) s.step(makeFrame(steer * Math.min(1, i / 10), 1, 0)); // settle into the corner
  const slip0 = Math.abs(v.bodySlip);
  let maxSlip = 0;
  const v0 = v.speed;
  for (let i = 0; i < 250; i++) {
    s.step(makeFrame(steer, 1, i < tapTicks ? brake : 0));
    maxSlip = Math.max(maxSlip, Math.abs(v.bodySlip));
  }
  const spun = maxSlip > 0.9 || v.forwardSpeed < 0;
  return `slip before ${(slip0 * 57.3).toFixed(0).padStart(2)} max ${(maxSlip * 57.3).toFixed(0).padStart(3)} deg, end speed ${(v.speed / v0 * 100).toFixed(0)}%${spun ? '  SPIN' : ''}`;
}

for (const c of CAR_IDS) {
  console.log(`== ${c}`);
  for (const sp of [30, 55]) for (const st of [0.3, 0.7]) for (const t of [8, 20, 60]) {
    console.log(`  ${HOME[c].padEnd(6)} ${sp} m/s steer ${st} tap ${t * 10}ms:`, await tap(c, HOME[c], sp, st, t), '| tarmac:', await tap(c, 'tarmac', sp, st, t));
  }
}
