import { describe, expect, it } from 'vitest';
import { makeFrame } from '../src/core/InputFrame';
import { CARS, CAR_IDS, CarId, carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { SURFACES, SurfaceId } from '../src/physics/Surface';
import { ChainItem, layoutChain } from '../src/tracks/ChainLayout';
import { buildFlatPad } from '../src/tracks/TestTracks';
import { buildTrack } from '../src/tracks/TrackGenerator';

const G = 19.6;

async function pad(car: CarId, surface: SurfaceId, behavior = true): Promise<Simulation> {
  const def = getCar(car);
  return Simulation.create(buildFlatPad(1600, 1600, surface), carParams(car), 0, G, behavior ? def.behavior : undefined);
}

async function zeroTo100(car: CarId, surface: SurfaceId): Promise<number> {
  const s = await pad(car, surface);
  for (let i = 0; i < 1500; i++) {
    s.step(makeFrame(0, 1, 0));
    if (s.vehicle.speed * 3.6 >= 100) return s.time;
  }
  return Infinity;
}

async function brakeDistance(car: CarId, surface: SurfaceId): Promise<number> {
  const s = await pad(car, surface);
  for (let i = 0; i < 3000 && s.vehicle.speed < 25; i++) s.step(makeFrame(0, 1, 0));
  const z0 = s.vehicle.position.z;
  for (let i = 0; i < 1500 && s.vehicle.speed > 1; i++) s.step(makeFrame(0, 0, 1));
  return z0 - s.vehicle.position.z;
}

/**
 * Peak centripetal acceleration (g') over a gentle ramp-up of steering at a held speed: speed x turn rate of
 * the velocity vector, smoothed over 0.2 s. (Yaw rate alone is fooled by a car that spins while sliding straight.)
 */
async function cornering(car: CarId, surface: SurfaceId, speed: number): Promise<number> {
  const s = await pad(car, surface);
  const v = s.vehicle;
  for (let i = 0; i < 3000 && v.speed < speed; i++) s.step(makeFrame(0, 1, 0));
  let peak = 0;
  const heading: number[] = [];
  for (let i = 0; i < 500; i++) {
    s.step(makeFrame(Math.min(0.55, i / 300), Math.max(0, Math.min(1, (speed - v.speed) * 0.4)), 0));
    heading.push(Math.atan2(v.linvel.x, v.linvel.z));
    if (heading.length > 20) {
      let d = heading[heading.length - 1]! - heading[heading.length - 21]!;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      peak = Math.max(peak, (v.speed * Math.abs(d)) / 0.2 / G);
    }
  }
  return peak;
}

async function jumpAirTime(car: CarId, surface: SurfaceId): Promise<number> {
  const def = getCar(car);
  const items: ChainItem[] = [{ type: 'start', surface }, { type: 'straight4', surface }, { type: 'straight4', surface }, { type: 'jumpRamp', surface }, { type: 'landingXL', gap: 1, dy: -1 }, { type: 'straight4' }, { type: 'straight4' }, { type: 'finish' }];
  const track = buildTrack({ id: 'j', name: 'j', car, theme: 'g', seed: 1, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 }, blocks: layoutChain(items).blocks });
  const s = await Simulation.create(track, carParams(car), 0, G, def.behavior);
  let best = 0;
  for (let i = 0; i < 2500 && s.respawnCount === 0; i++) {
    s.step(makeFrame(0, 1, 0));
    best = Math.max(best, s.vehicle.airTime);
  }
  return best;
}

describe('car roster', () => {
  it('has four cars with distinct parameter sets', () => {
    expect(CAR_IDS).toHaveLength(4);
    const sig = CAR_IDS.map((id) => JSON.stringify(CARS[id].params));
    expect(new Set(sig).size).toBe(4);
    for (const id of CAR_IDS) {
      const p = CARS[id].params;
      expect(p.name.toLowerCase()).toBe(id);
      expect(p.surfaceGrip.tarmac).toBeGreaterThan(0);
    }
  });

  it('falls back to Volt for unknown ids and clones parameters', () => {
    expect(getCar('nope').id).toBe('volt');
    const a = carParams('gravel');
    a.mass = 1;
    expect(carParams('gravel').mass).not.toBe(1);
  });

  it('every car has its own engine voice, camera and livery', () => {
    expect(new Set(CAR_IDS.map((i) => CARS[i].voice.base)).size).toBe(4);
    expect(new Set(CAR_IDS.map((i) => CARS[i].camera.distance)).size).toBeGreaterThan(2);
    expect(new Set(CAR_IDS.map((i) => CARS[i].livery.primary)).size).toBe(4);
  });
});

describe('per-surface tyre model', () => {
  it('loose surfaces peak later and keep more grip in a slide than ice', () => {
    expect(SURFACES.dirt.peakSlip).toBeGreaterThan(SURFACES.tarmac.peakSlip);
    expect(SURFACES.ice.slideKeep).toBeLessThan(SURFACES.dirt.slideKeep);
    expect(SURFACES.sand.loose && SURFACES.snow.loose && SURFACES.dirt.loose && SURFACES.grass.loose).toBe(true);
    expect(SURFACES.tarmac.loose || SURFACES.ice.loose).toBe(false);
  });
});

describe('cars feel different (blind-test measurables)', () => {
  it('Volt is the tarmac benchmark: it corners harder than the three off-roaders', async () => {
    const [volt, gravel, frost, dune] = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => cornering(c, 'tarmac', 30)));
    expect(volt).toBeGreaterThan(gravel * 1.3);
    expect(volt).toBeGreaterThan(frost * 1.5);
    expect(volt).toBeGreaterThan(dune * 1.3);
  });

  it('on dirt the rally car beats the stadium car, and gains grip over its own tarmac figure', async () => {
    const [gDirt, gTarmac, vDirt, vTarmac] = [await cornering('gravel', 'dirt', 30), await cornering('gravel', 'tarmac', 30), await cornering('volt', 'dirt', 30), await cornering('volt', 'tarmac', 30)];
    expect(gDirt).toBeGreaterThan(vDirt * 1.15);
    expect(gDirt / gTarmac).toBeGreaterThan(vDirt / vTarmac + 0.3);
    expect(gDirt).toBeGreaterThan(gTarmac);
  });

  it('on snow and ice the studded Frost has the most lateral grip; on sand the Dune does', async () => {
    const snow = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => cornering(c, 'snow', 28)));
    expect(snow[2]).toBe(Math.max(...snow));
    const ice = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => cornering(c, 'ice', 20)));
    expect(ice[2]).toBe(Math.max(...ice));
    const sand = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => cornering(c, 'sand', 28)));
    expect(sand[3]).toBe(Math.max(...sand));
  });

  it('Frost studs bite on ice: it stops and accelerates better there than the others', async () => {
    const stops = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => brakeDistance(c, 'ice')));
    expect(stops[2]).toBeLessThan(Math.min(stops[0]!, stops[1]!, stops[3]!) * 0.9);
    const frost = await zeroTo100('frost', 'ice');
    const volt = await zeroTo100('volt', 'ice');
    expect(frost).toBeLessThan(volt * 0.8);
  });

  it('Frost is the heaviest, Dune the lightest, and Dune is the quickest on sand', async () => {
    const mass = CAR_IDS.map((i) => CARS[i].params.mass);
    expect(CARS.frost.params.mass).toBe(Math.max(...mass));
    expect(CARS.dune.params.mass).toBe(Math.min(...mass));
    const t = await Promise.all((['volt', 'gravel', 'frost', 'dune'] as const).map((c) => zeroTo100(c, 'sand')));
    expect(t[3]).toBe(Math.min(...t));
  });

  it('Dune flies noticeably longer off the same ramp (floaty arcs + spring launch)', async () => {
    const volt = await jumpAirTime('volt', 'tarmac');
    const dune = await jumpAirTime('dune', 'tarmac');
    expect(dune).toBeGreaterThan(volt * 1.15); // ~22 % longer off the shallow ramps
  });

  it('Gravel behaviour starts a power slide that the same car without it does not have', async () => {
    const run = async (behavior: boolean): Promise<number> => {
      const s = await pad('gravel', 'dirt', behavior);
      const v = s.vehicle;
      for (let i = 0; i < 4000 && v.speed < 24; i++) s.step(makeFrame(0, 1, 0));
      let slip = 0;
      for (let i = 0; i < 160; i++) {
        s.step(makeFrame(Math.min(0.7, i / 10), 1, 0));
        if (i > 80) slip = Math.max(slip, Math.abs(v.bodySlip));
      }
      return slip;
    };
    expect(await run(true)).toBeGreaterThan((await run(false)) + 0.05);
  });

  it('every car is stable: a moderate steering step on its home surface does not spin it', async () => {
    const home: Record<CarId, [SurfaceId, number]> = { volt: ['tarmac', 40], gravel: ['dirt', 24], frost: ['snow', 20], dune: ['sand', 28] };
    for (const id of CAR_IDS) {
      const [surface, speed] = home[id];
      const s = await pad(id, surface);
      const v = s.vehicle;
      for (let i = 0; i < 4000 && v.speed < speed; i++) s.step(makeFrame(0, 1, 0));
      let maxSlip = 0;
      for (let i = 0; i < 200; i++) {
        s.step(makeFrame(0.4 * Math.min(1, i / 8), Math.max(0, Math.min(1, (speed - v.speed) * 0.4)), 0));
        maxSlip = Math.max(maxSlip, Math.abs(v.bodySlip));
      }
      expect(maxSlip, id).toBeLessThan(0.7);
      expect(v.forwardSpeed, id).toBeGreaterThan(0);
    }
  });

  it('simulation stays bit-deterministic for every car (behaviours included)', async () => {
    for (const id of CAR_IDS) {
      const run = async (): Promise<number[]> => {
        const s = await pad(id, 'dirt');
        for (let i = 0; i < 1200; i++) s.step(makeFrame(Math.sin(i / 30) * 0.6, i % 400 < 330 ? 1 : 0, i % 400 >= 380 ? 1 : 0));
        return s.vehicle.stateHash();
      };
      expect(await run(), id).toEqual(await run());
    }
  });
});
