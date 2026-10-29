import { describe, expect, it } from 'vitest';
import { makeFrame } from '../src/core/InputFrame';
import { InputRecorder } from '../src/core/InputRecorder';
import { GhostData, GhostPlayer, GhostRecorder, SNAPSHOT_INTERVAL, levelFingerprint, physicsFingerprint } from '../src/core/Ghost';
import { authorGhost } from '../src/core/GhostStore';
import { LEVELS, getLevel } from '../src/data';
import { SAMPLE } from './sample';
import { carParams, getCar } from '../src/data/cars';
import { RenderPose } from '../src/physics/Vehicle';
import { Simulation } from '../src/physics/Simulation';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson } from '../src/tracks/TrackSchema';
import { Quaternion, Vector3 } from 'three';

interface Recorded {
  data: GhostData;
  finalHash: number[];
  /** true position at every snapshot tick, for fallback accuracy checks */
  path: Vector3[];
}

/** Drive a level with the bot while recording it exactly as the game does. */
async function record(lv: TrackJson, jitter = false): Promise<Recorded> {
  const track = buildTrack(lv);
  const def = getCar(lv.car);
  const sim = await Simulation.create(track, carParams(def.id), false, undefined, def.behavior);
  const bot = new PathBot(track.centerline, track.centerSurface, (lv.laps ?? 1) > 1, sim.vehicle.params, track.centerFrame);
  applyBotHints(bot, lv.bot);
  const rec = new GhostRecorder();
  rec.start(sim);
  const path: Vector3[] = [sim.vehicle.position.clone()];
  for (let i = 0; i < 20000 && sim.run.state !== 'finished'; i++) {
    let f = bot.drive(sim.vehicle);
    if (jitter && i === 300) f = { ...f, respawn: true }; // a respawn must replay too
    rec.push(f);
    sim.step(f);
    rec.afterStep(sim);
    if (sim.run.tick % SNAPSHOT_INTERVAL === 0) path.push(sim.vehicle.position.clone());
  }
  expect(sim.run.state).toBe('finished');
  const data = rec.finish(sim, { trackId: lv.id, carId: def.id, levelHash: levelFingerprint(lv.blocks, lv.car, lv.laps ?? 1) });
  return { data, finalHash: sim.vehicle.stateHash(), path };
}

async function player(lv: TrackJson, data: GhostData, tweak?: (p: ReturnType<typeof carParams>) => void): Promise<GhostPlayer> {
  const track = buildTrack(lv);
  const def = getCar(lv.car);
  const params = carParams(def.id);
  tweak?.(params);
  const p = await GhostPlayer.create(track, params, def.behavior, data, levelFingerprint(lv.blocks, lv.car, lv.laps ?? 1));
  p.reset();
  p.go();
  return p;
}

const pose = (): RenderPose => ({ position: new Vector3(), quaternion: new Quaternion(), springLen: [0, 0, 0, 0], steer: [0, 0, 0, 0], spin: [0, 0, 0, 0] });

describe('ghost determinism', () => {
  it('a ghost re-simulates its recorded run EXACTLY (state, snapshots, finish time)', async () => {
    const lv = getLevel('c01')!;
    const r = await record(lv);
    const p = await player(lv, r.data);
    expect(p.mode).toBe('exact');
    let worst = 0;
    for (let i = 0; i < r.data.ticks; i++) {
      p.step();
      worst = Math.max(worst, p.snapshotError());
    }
    expect(worst).toBeLessThan(1e-3); // float32 snapshot rounding only
    expect(p.vehicle.stateHash()).toEqual(r.finalHash); // bit-identical
    expect(p.mode).toBe('exact');
  });

  it('replays a run that included a respawn and a jump', async () => {
    const lv = getLevel('c01')!;
    const r = await record(lv, true);
    const p = await player(lv, r.data);
    for (let i = 0; i < r.data.ticks; i++) p.step();
    expect(p.vehicle.stateHash()).toEqual(r.finalHash);
  });

  it('is exact for every car (behaviours included)', async () => {
    for (const id of ['c05', 'c02', 'c03']) {
      const lv = getLevel(id)!;
      const r = await record(lv);
      const p = await player(lv, r.data);
      for (let i = 0; i < r.data.ticks; i++) p.step();
      expect(p.vehicle.stateHash(), id).toEqual(r.finalHash);
    }
  });

  it('survives a save/load round trip of its serialised form', async () => {
    const lv = getLevel('c21')!; // a loop and a car gate
    const r = await record(lv);
    const copy = JSON.parse(JSON.stringify(r.data)) as GhostData;
    const p = await player(lv, copy);
    for (let i = 0; i < copy.ticks; i++) p.step();
    expect(p.vehicle.stateHash()).toEqual(r.finalHash);
  });

  it('is exact through car gates (the run switches car twice)', async () => {
    const lv = getLevel('c05')!; // stadium, rally, desert
    const r = await record(lv);
    const p = await player(lv, r.data);
    expect(p.mode).toBe('exact');
    const cars = new Set<string>();
    for (let i = 0; i < r.data.ticks; i++) {
      p.step();
      cars.add(p.carAt(i));
    }
    expect(cars.size).toBeGreaterThanOrEqual(3);
    expect(p.vehicle.stateHash()).toEqual(r.finalHash);
  });

  it('falls back to following the snapshots when the physics no longer matches', async () => {
    const lv = getLevel('c01')!;
    const r = await record(lv);
    const p = await player(lv, r.data, (params) => (params.mass *= 1.1)); // tuned car: fingerprint differs
    expect(p.mode).toBe('snapshot');
    const out = pose();
    // step to 40% of the run and check the drawn ghost is near where the real run was then
    const target = Math.floor(r.data.ticks * 0.4 / SNAPSHOT_INTERVAL) * SNAPSHOT_INTERVAL;
    for (let i = 0; i < target; i++) p.step();
    p.pose(1, out);
    expect(out.position.distanceTo(r.path[target / SNAPSHOT_INTERVAL]!)).toBeLessThan(1.0);
  });

  it('detects fingerprints correctly', () => {
    const a = carParams('volt');
    const b = carParams('volt');
    expect(physicsFingerprint(a)).toBe(physicsFingerprint(b));
    b.springK += 1;
    expect(physicsFingerprint(a)).not.toBe(physicsFingerprint(b));
    const lv = getLevel('c01')!;
    expect(levelFingerprint(lv.blocks, lv.car, 1)).not.toBe(levelFingerprint(lv.blocks.slice(1), lv.car, 1));
  });
});

describe('bundled author ghosts', () => {
  it('every level has a current author ghost (time = target, fingerprints match)', async () => {
    for (const lv of LEVELS) {
      const g = await authorGhost(lv.id);
      expect(g, `${lv.id}: missing author ghost; run \`npm run campaign\``).not.toBeNull();
      expect(g!.time, lv.id).toBe(lv.target);
      expect(g!.levelHash, `${lv.id}: level changed since its ghost was recorded`).toBe(levelFingerprint(lv.blocks, lv.car, lv.laps ?? 1));
      expect(g!.physicsHash, `${lv.id}: physics changed since its ghost was recorded`).toBe(physicsFingerprint(carParams(getCar(lv.car).id)));
    }
  });
  for (const lv of SAMPLE) {
    it(`${lv.id}: loads, is current, replays exactly to the author time`, async () => {
      const g = await authorGhost(lv.id);
      expect(g, 'missing author ghost; run `npm run levels`').not.toBeNull();
      expect(g!.time).toBe(lv.target);
      const p = await player(lv, g!);
      expect(p.mode, 'ghost is stale: physics or level changed; run `npm run levels`').toBe('exact');
      for (let i = 0; i < g!.ticks; i++) p.step();
      expect(p.vehicle.position.y).toBeGreaterThan(-100);
      expect(p.mode).toBe('exact');
    });
  }
});

describe('input codec v2', () => {
  it('round-trips arbitrary streams including big steering jumps and respawns', () => {
    let seed = 7;
    const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const rec = new InputRecorder();
    const frames: ReturnType<typeof makeFrame>[] = [];
    for (let i = 0; i < 4000; i++) {
      const hold: boolean = rnd() < 0.7 && frames.length > 0;
      const f: ReturnType<typeof makeFrame> = hold ? frames[frames.length - 1]! : makeFrame(rnd() < 0.2 ? rnd() * 2 - 1 : Math.sin(i / 50), rnd(), rnd() < 0.5 ? 0 : rnd(), rnd() < 0.01);
      frames.push(f);
      rec.push(f);
    }
    expect(InputRecorder.fromBytes(rec.toBytes()).toFrames()).toEqual(frames);
  });

  it('keeps a smooth analog run small', () => {
    const rec = new InputRecorder();
    for (let i = 0; i < 6000; i++) rec.push(makeFrame(Math.sin(i / 90), 1, 0));
    expect(rec.toBytes().byteLength).toBeLessThan(6000 * 3.2);
  });
});
