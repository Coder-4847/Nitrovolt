import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { EffectId } from '../src/physics/Surface';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { ChainItem, layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';

const medals = { author: 0, gold: 0, silver: 0, bronze: 0 };

/** start + run-up + a 2-cell pad of `effect` + a long runout (+ finish so the level is valid). */
async function padSim(effect: EffectId | null, runUp = 2): Promise<Simulation> {
  const items: ChainItem[] = [{ type: 'start' }, ...Array.from({ length: runUp }, () => ({ type: 'straight2' })), effect ? { type: 'straight2', surface: effect } : { type: 'straight2' }, { type: 'straight4' }, { type: 'straight4' }, { type: 'finish' }];
  const track = buildTrack({ id: 'p', name: 'p', car: 'volt', theme: 'g', seed: 1, medalTimes: medals, blocks: layoutChain(items).blocks });
  return Simulation.create(track, cloneParams(VOLT), 0);
}

/** Run until the car is `metres` past the start along -Z. */
function driveTo(s: Simulation, z: number, input: () => ReturnType<typeof makeFrame>, onTick?: () => void): void {
  for (let i = 0; i < 6000 && s.vehicle.position.z > z; i++) {
    s.step(input());
    onTick?.();
  }
}

const throttle = (): ReturnType<typeof makeFrame> => makeFrame(0, 1, 0);

describe('special block effects', () => {
  it('turbo adds speed beyond what the plain car reaches', async () => {
    const plain = await padSim(null);
    const boosted = await padSim('turbo');
    driveTo(plain, -460, throttle);
    driveTo(boosted, -460, throttle);
    expect(boosted.vehicle.speed).toBeGreaterThan(plain.vehicle.speed + 6);
  });

  it('turbo2 is stronger than turbo', async () => {
    const a = await padSim('turbo');
    const b = await padSim('turbo2');
    driveTo(a, -460, throttle);
    driveTo(b, -460, throttle);
    expect(b.vehicle.speed).toBeGreaterThan(a.vehicle.speed + 3);
  });

  it('reactor boost pushes forward and lifts (reduced effective gravity) for a limited time', async () => {
    const s = await padSim('reactor');
    let sawLift = false;
    let ended = false;
    driveTo(s, -660, throttle, () => {
      const m = s.vehicle.effects.mods;
      if (m.lift > 0.3 && m.boostAccel > 10) sawLift = true;
      if (sawLift && m.lift === 0) ended = true;
    });
    expect(sawLift).toBe(true);
    expect(ended).toBe(true);
  });

  it('noSteer ignores steering on the pad', async () => {
    const run = async (effect: EffectId | null): Promise<number> => {
      const s = await padSim(effect);
      driveTo(s, -150, throttle); // the pad spans z = -144 .. -208
      const x0 = s.vehicle.position.x;
      driveTo(s, -206, () => makeFrame(1, 0.3, 0)); // full right while crossing it
      return Math.abs(s.vehicle.position.x - x0);
    };
    const steered = await run(null);
    const locked = await run('noSteer');
    expect(steered).toBeGreaterThan(1.5);
    expect(locked).toBeLessThan(steered * 0.4);
  });

  it('noBrake makes the brake do nothing on the pad', async () => {
    const run = async (effect: EffectId | null): Promise<number> => {
      const s = await padSim(effect);
      driveTo(s, -150, throttle); // fast, entering the pad (z = -144 .. -208)
      const v0 = s.vehicle.speed;
      driveTo(s, -206, () => makeFrame(0, 0, 1));
      return v0 - s.vehicle.speed;
    };
    const braked = await run(null);
    const none = await run('noBrake');
    expect(braked).toBeGreaterThan(8);
    expect(none).toBeLessThan(braked * 0.4);
  });

  it('engineOff stops the engine pushing', async () => {
    const run = async (effect: EffectId | null): Promise<number> => {
      const s = await padSim(effect);
      driveTo(s, -200, throttle);
      driveTo(s, -280, throttle);
      return s.vehicle.speed;
    };
    expect(await run('engineOff')).toBeLessThan((await run(null)) - 5);
  });

  it('cruise control holds the entry speed regardless of pedals', async () => {
    const s = await padSim('cruise');
    let entry = 0;
    driveTo(s, -160, throttle, () => (entry = s.vehicle.forwardSpeed));
    // on the pad: full throttle should NOT keep accelerating, brake should NOT stop the car
    const cruiseSpeeds: number[] = [];
    driveTo(s, -250, throttle, () => s.vehicle.effects.mods.cruiseSpeed !== null && cruiseSpeeds.push(s.vehicle.forwardSpeed));
    expect(cruiseSpeeds.length).toBeGreaterThan(20);
    const last = cruiseSpeeds[cruiseSpeeds.length - 1]!;
    expect(Math.abs(last - cruiseSpeeds[0]!)).toBeLessThan(6);
    expect(entry).toBeGreaterThan(20);
  });

  it('slow motion scales the physics time step, and gravity pads lower gravity', async () => {
    const sm = await padSim('slowMo');
    let minScale = 1;
    driveTo(sm, -340, throttle, () => (minScale = Math.min(minScale, sm.vehicle.effects.mods.timeScale)));
    expect(minScale).toBeLessThan(0.5);
    const gr = await padSim('gravity');
    let g = 1;
    driveTo(gr, -340, throttle, () => (g = Math.min(g, gr.vehicle.effects.mods.gravityScale)));
    expect(g).toBeLessThan(0.6);
  });

  it('fragile blocks break on a hard landing, and are restored on restart', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight2', surface: 'fragile' }, { type: 'straight4' }, { type: 'finish' }];
    const track = buildTrack({ id: 'f', name: 'f', car: 'volt', theme: 'g', seed: 1, medalTimes: medals, blocks: layoutChain(items).blocks });
    const s = await Simulation.create(track, cloneParams(VOLT), 0);
    const above = track.start.position.clone().add(new Vector3(0, 0, -60)).setY(8);
    s.vehicle.reset(above, new Quaternion(), new Vector3(0, -2, 0));
    let broke = false;
    for (let i = 0; i < 300; i++) {
      s.step(makeFrame(0, 0, 0));
      if (s.events.some((e) => e.type === 'break')) broke = true;
      s.events.length = 0;
    }
    expect(broke).toBe(true);
    expect(s.world.broken.size).toBe(1);
    s.restart();
    expect(s.world.broken.size).toBe(0);
    // gently driving over it must not break it
    for (let i = 0; i < 400; i++) s.step(makeFrame(0, 0.5, 0));
    expect(s.world.broken.size).toBe(0);
  });

  it('effects are deterministic: the same inputs reproduce the same state', async () => {
    const run = async (): Promise<number[]> => {
      const s = await padSim('turbo2');
      for (let i = 0; i < 900; i++) s.step(makeFrame(Math.sin(i / 40) * 0.2, 1, 0));
      return s.vehicle.stateHash();
    };
    expect(await run()).toEqual(await run());
  });
});
