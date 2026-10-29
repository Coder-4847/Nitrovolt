// Compare the four cars: npx tsx scripts/car-lab.ts [car...]
import { makeFrame } from '../src/core/InputFrame';
import { CAR_IDS, CarId, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { SurfaceId } from '../src/physics/Surface';
import { cloneParams } from '../src/physics/VehicleParams';
import { ChainItem, layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { buildFlatPad } from '../src/tracks/TestTracks';

const G = 19.6;
const SURFACES: SurfaceId[] = ['tarmac', 'dirt', 'snow', 'ice', 'sand'];

async function sim(car: CarId, surface: SurfaceId): Promise<Simulation> {
  const def = getCar(car);
  return Simulation.create(buildFlatPad(1600, 1600, surface), cloneParams(def.params), 0, G, def.behavior);
}
const hold = (target: number, v: number): number => Math.max(0, Math.min(1, (target - v) * 0.4));

async function accel(car: CarId, surface: SurfaceId): Promise<string> {
  const s = await sim(car, surface);
  let t100 = NaN;
  for (let i = 0; i < 1500; i++) {
    s.step(makeFrame(0, 1, 0));
    if (Number.isNaN(t100) && s.vehicle.speed * 3.6 >= 100) t100 = s.time;
  }
  return `${Number.isNaN(t100) ? ' n/a' : t100.toFixed(1).padStart(4)}s/${Math.round(s.vehicle.speed * 3.6)}`;
}

async function brake(car: CarId, surface: SurfaceId): Promise<string> {
  const s = await sim(car, surface);
  for (let i = 0; i < 3000 && s.vehicle.speed < 25; i++) s.step(makeFrame(0, 1, 0));
  const z0 = s.vehicle.position.z;
  let ticks = 0;
  while (s.vehicle.speed > 1 && ticks < 1500) { s.step(makeFrame(0, 0, 1)); ticks++; }
  return `${(z0 - s.vehicle.position.z).toFixed(0).padStart(3)}m`;
}

async function lateral(car: CarId, surface: SurfaceId, speed: number): Promise<string> {
  const s = await sim(car, surface);
  const v = s.vehicle;
  for (let i = 0; i < 3000 && v.speed < speed; i++) s.step(makeFrame(0, 1, 0));
  let sum = 0, n = 0, maxSlip = 0;
  for (let i = 0; i < 400; i++) {
    s.step(makeFrame(1, hold(speed, v.speed), 0));
    if (i > 200) { sum += v.speed * Math.abs(v.angvel.y); n++; maxSlip = Math.max(maxSlip, Math.abs(v.bodySlip)); }
  }
  return `${(sum / n / G).toFixed(2)}g/${(maxSlip * 57.3).toFixed(0)}deg`;
}

async function jump(car: CarId, surface: SurfaceId): Promise<string> {
  const def = getCar(car);
  const items: ChainItem[] = [{ type: 'start', surface }, { type: 'straight4', surface }, { type: 'straight4', surface }, { type: 'jumpRamp', surface }, { type: 'straight4' }, { type: 'straight4' }, { type: 'straight4' }, { type: 'finish' }];
  const track = buildTrack({ id: 'j', name: 'j', car, theme: 'g', seed: 1, blocks: layoutChain(items).blocks });
  const s = await Simulation.create(track, cloneParams(def.params), 0, G, def.behavior);
  let maxAir = 0, y0 = 0, apex = 0, entry = 0;
  for (let i = 0; i < 2500 && s.respawnCount === 0; i++) {
    s.step(makeFrame(0, 1, 0));
    const v = s.vehicle;
    if (v.airTicks > 0 || v.airTime > 0) { if (v.airTime > maxAir) { maxAir = v.airTime; entry = entry || v.speed; } apex = Math.max(apex, v.position.y - y0); }
    else if (v.position.z < -150) y0 = v.position.y;
  }
  return `air ${maxAir.toFixed(2)}s apex ${apex.toFixed(1)}m`;
}

const cars = (process.argv.slice(2).length ? process.argv.slice(2) : CAR_IDS) as CarId[];
console.log('0-100 km/h time / speed after 15 s');
for (const c of cars) console.log(c.padEnd(7), SURFACES.map(async () => '').length && (await Promise.all(SURFACES.map((s) => accel(c, s)))).map((x, i) => `${SURFACES[i]}: ${x}`).join('  '));
console.log('\nbrake distance from 25 m/s');
for (const c of cars) console.log(c.padEnd(7), (await Promise.all(SURFACES.map((s) => brake(c, s)))).map((x, i) => `${SURFACES[i]}: ${x}`).join('  '));
for (const spd of [15, 30]) {
  console.log(`\nsteady turn at ${spd} m/s, full lock: lateral g' / max body slip`);
  for (const c of cars) console.log(c.padEnd(7), (await Promise.all(SURFACES.map((s) => lateral(c, s, spd)))).map((x, i) => `${SURFACES[i]}: ${x}`).join('  '));
}
console.log('\njump off the standard ramp, full throttle');
for (const c of cars) console.log(c.padEnd(7), 'tarmac', await jump(c, 'tarmac'), '|', 'sand', await jump(c, 'sand'));
