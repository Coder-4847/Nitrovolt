import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { makeFrame } from '../src/core/InputFrame';
import { medalFor } from '../src/core/Medals';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { PathBot } from '../src/tracks/PathBot';
import { layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson } from '../src/tracks/TrackSchema';
import { ChainItem } from '../src/tracks/ChainLayout';
import { LEVELS } from '../src/data';

const medals = { author: 0, gold: 0, silver: 0, bronze: 0 };
function level(items: ChainItem[], laps = 1): TrackJson {
  return { id: 't', name: 't', car: 'volt', theme: 'grey', seed: 1, laps, medalTimes: medals, blocks: layoutChain(items).blocks };
}
async function sim(items: ChainItem[], countdown = 0, laps = 1): Promise<Simulation> {
  return Simulation.create(buildTrack(level(items, laps)), cloneParams(VOLT), countdown);
}
const full = makeFrame(0, 1, 0);

describe('medals', () => {
  const m = { author: 20000, gold: 21600, silver: 24000, bronze: 29000 };
  it('awards the best medal reached', () => {
    expect(medalFor(19999, m)).toBe('author');
    expect(medalFor(20000, m)).toBe('author');
    expect(medalFor(20001, m)).toBe('gold');
    expect(medalFor(23000, m)).toBe('silver');
    expect(medalFor(28999, m)).toBe('bronze');
    expect(medalFor(29001, m)).toBe('none');
  });
  it('never awards unset thresholds', () => {
    expect(medalFor(1, { author: 0, gold: 0, silver: 0, bronze: 0 })).toBe('none');
  });
});

describe('run logic', () => {
  it('holds the car during the countdown, then GO starts the clock at 0', async () => {
    const s = await sim([{ type: 'start' }, { type: 'straight4' }, { type: 'finish' }], 1.2);
    for (let i = 0; i < 100; i++) s.step(full); // 1.0 s of full throttle during countdown
    expect(s.run.state).toBe('countdown');
    expect(s.vehicle.speed).toBeLessThan(0.2);
    expect(s.run.timeMs).toBe(0);
    for (let i = 0; i < 25; i++) s.step(full);
    expect(s.run.state).toBe('running');
    for (let i = 0; i < 100; i++) s.step(full);
    expect(s.vehicle.speed).toBeGreaterThan(5);
    expect(s.run.timeMs).toBeGreaterThan(900);
  });

  it('instant countdown starts running immediately', async () => {
    const s = await sim([{ type: 'start' }, { type: 'finish' }], 0);
    expect(s.run.state).toBe('running');
  });

  it('finishes after the checkpoints, with a millisecond time and interpolated splits', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight4' }, { type: 'checkpoint' }, { type: 'straight4' }, { type: 'finish' }, { type: 'straight2' }];
    const s = await sim(items);
    for (let i = 0; i < 2500 && s.run.state !== 'finished'; i++) s.step(full);
    expect(s.run.state).toBe('finished');
    expect(s.run.splits).toHaveLength(2);
    const [cp, fin] = s.run.splits as [number, number];
    expect(fin).toBe(s.run.finishTime);
    expect(cp).toBeLessThan(fin);
    // sub-tick interpolation: times are not all multiples of the 10 ms tick
    expect(Number.isInteger(cp)).toBe(true);
    expect([cp, fin].some((t) => t % 10 !== 0)).toBe(true);
  });

  it('refuses a finish while a checkpoint is uncollected (anti-cheat)', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight2' }, { type: 'checkpoint' }, { type: 'straight4' }, { type: 'finish' }, { type: 'straight2' }];
    const s = await sim(items);
    // lift the checkpoint line out of reach so the car drives the whole course without collecting it
    s.track.triggers.find((t) => t.kind === 'checkpoint')!.position.y += 500;
    for (let i = 0; i < 3500 && s.run.state === 'running'; i++) s.step(full);
    expect(s.run.nextCp).toBe(0);
    expect(s.run.state).toBe('running');
    expect(s.run.finishTime).toBeNull();
  });

  it('does not count crossing a checkpoint backwards', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight2' }, { type: 'checkpoint' }, { type: 'straight4' }, { type: 'finish' }, { type: 'straight2' }];
    const s = await sim(items);
    const cp = s.track.triggers.find((t) => t.kind === 'checkpoint')!;
    // start 20 m beyond the line, rolling back toward it at 30 m/s, facing the way we came
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
    const q = cp.quaternion.clone().multiply(turn);
    const pos = new Vector3(0, 0.75, -20).applyQuaternion(cp.quaternion).add(cp.position);
    const vel = new Vector3(0, 0, 30).applyQuaternion(cp.quaternion); // toward +Z = behind the line
    s.vehicle.reset(pos, q, vel);
    for (let i = 0; i < 200; i++) s.step(makeFrame(0, 0, 0));
    expect(s.vehicle.position.clone().sub(cp.position).applyQuaternion(cp.quaternion.clone().invert()).z).toBeGreaterThan(0); // it did pass backwards
    expect(s.run.nextCp).toBe(0);
  });

  it('respawns at the last collected checkpoint, with zero speed and the clock running', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight2' }, { type: 'checkpoint' }, { type: 'straight4' }, { type: 'finish' }, { type: 'straight2' }];
    const s = await sim(items);
    for (let i = 0; i < 1500 && s.run.nextCp < 1; i++) s.step(full);
    expect(s.run.nextCp).toBe(1);
    const t0 = s.run.timeMs;
    for (let i = 0; i < 50; i++) s.step(full);
    s.step({ ...full, respawn: true });
    expect(s.respawnCount).toBe(1);
    expect(s.vehicle.speed).toBeLessThan(2);
    const cp = s.track.triggers.find((t) => t.kind === 'checkpoint')!;
    expect(s.vehicle.position.distanceTo(cp.position)).toBeLessThan(3);
    expect(s.run.timeMs).toBeGreaterThan(t0);
  });

  it('restart is instant and resets everything', async () => {
    const items: ChainItem[] = [{ type: 'start' }, { type: 'straight2' }, { type: 'checkpoint' }, { type: 'straight4' }, { type: 'finish' }];
    const s = await sim(items, 1.2);
    for (let i = 0; i < 400; i++) s.step(full);
    s.restart();
    expect(s.run.state).toBe('countdown');
    expect(s.run.nextCp).toBe(0);
    expect(s.run.splits).toHaveLength(0);
    expect(s.vehicle.speed).toBeLessThan(0.1);
    expect(s.respawnCount).toBe(0);
  });

  it('counts laps on a closed circuit and finishes on the last one', async () => {
    const lv = LEVELS.find((l) => l.id === 'circuit01')!;
    const track = buildTrack(lv);
    const s = await Simulation.create(track, cloneParams(VOLT), 0);
    const bot = new PathBot(track.centerline, track.centerSurface, true);
    for (let i = 0; i < 9000 && s.run.state !== 'finished'; i++) s.step(bot.drive(s.vehicle));
    expect(s.run.state).toBe('finished');
    // 2 laps x (2 checkpoints + 1 line)
    expect(s.run.splits).toHaveLength(6);
    expect(s.run.splits).toEqual([...s.run.splits].sort((a, b) => a - b));
  });
});

describe('built-in levels', () => {
  for (const lv of LEVELS) {
    it(`${lv.id} is finishable by the path bot with no respawns`, async () => {
      const track = buildTrack(lv);
      const s = await Simulation.create(track, cloneParams(VOLT), 0);
      const bot = new PathBot(track.centerline, track.centerSurface, (lv.laps ?? 1) > 1);
      bot.maxSpeed = 75;
      for (let i = 0; i < 20000 && s.run.state !== 'finished'; i++) s.step(bot.drive(s.vehicle));
      expect(s.run.state).toBe('finished');
      expect(s.respawnCount).toBe(0);
      expect(lv.medalTimes.author).toBeGreaterThan(0);
    });
  }
});
