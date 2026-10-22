import { beforeAll, describe, expect, it } from 'vitest';
import { InputFrame, makeFrame } from '../src/core/InputFrame';
import { InputRecorder } from '../src/core/InputRecorder';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';
import { buildGreyboxTrack } from '../src/tracks/GreyboxTrack';
import { PathBot } from '../src/tracks/PathBot';
import { TrackData } from '../src/tracks/TrackTypes';

/** A busy input script: launch, weave, brake, handbrake-style brake+steer, reverse. */
function script(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / 100;
    const steer = Math.abs(t % 6) < 3 ? Math.sin(t * 2.3) : -Math.sin(t * 1.1) * 0.8;
    const accel = t % 9 < 6.5 ? 1 : 0;
    const brake = t % 9 >= 6.5 && t % 9 < 7.2 ? 1 : t % 9 >= 8.2 ? 0.8 : 0;
    out.push(makeFrame(steer, accel, brake, i === 777));
  }
  return out;
}

async function run(track: TrackData, frames: InputFrame[], sim?: Simulation): Promise<{ sim: Simulation; hash: number[] }> {
  const s = sim ?? (await Simulation.create(track, cloneParams(VOLT)));
  s.restart();
  for (const f of frames) s.step(f);
  return { sim: s, hash: s.vehicle.stateHash() };
}

describe('physics determinism', () => {
  let pad: TrackData;
  beforeAll(() => {
    pad = buildFlatPad(1500, 1500);
  });

  it('identical inputs give bit-identical state in two fresh worlds', async () => {
    const frames = script(2500);
    const a = await run(pad, frames);
    const b = await run(pad, frames);
    expect(a.hash).toEqual(b.hash);
  });

  it('restart in the SAME world reproduces the run exactly', async () => {
    const frames = script(2500);
    const first = await run(pad, frames);
    const again = await run(pad, frames, first.sim);
    expect(again.hash).toEqual(first.hash);
  });

  it('a recorded + decoded input stream replays to the identical state (ghost equality)', async () => {
    const frames = script(2500);
    const live = await run(pad, frames);
    const rec = new InputRecorder();
    for (const f of frames) rec.push(f);
    const replay = await run(pad, InputRecorder.fromBytes(rec.toBytes()).toFrames());
    expect(replay.hash).toEqual(live.hash);
  });

  it('different inputs actually give different states (the test is not vacuous)', async () => {
    const a = await run(pad, script(1500));
    const b = await run(pad, script(1500).map((f) => ({ ...f, steer: -f.steer })));
    expect(a.hash).not.toEqual(b.hash);
  });
});

describe('vehicle sanity', () => {
  it('settles on all four wheels at a sane ride height', async () => {
    const sim = await Simulation.create(buildFlatPad(300, 300), cloneParams(VOLT));
    for (let i = 0; i < 200; i++) sim.step(makeFrame(0, 0, 0));
    const v = sim.vehicle;
    expect(v.wheelsOnGround).toBe(4);
    expect(v.position.y).toBeGreaterThan(0.45);
    expect(v.position.y).toBeLessThan(0.75);
    expect(v.speed).toBeLessThan(0.05);
  });

  it('accelerates 0-100 km/h in a sensible time, tops out below the limiter', async () => {
    const sim = await Simulation.create(buildFlatPad(1500, 600), cloneParams(VOLT));
    let t100 = 0;
    for (let i = 0; i < 1500; i++) {
      sim.step(makeFrame(0, 1, 0));
      if (!t100 && sim.vehicle.speed * 3.6 >= 100) t100 = sim.time;
    }
    expect(t100).toBeGreaterThan(1.8);
    expect(t100).toBeLessThan(3.8);
    expect(sim.vehicle.speed).toBeLessThan(VOLT.topSpeed + 2);
  });

  it('brakes to a stop and then reverses', async () => {
    const sim = await Simulation.create(buildFlatPad(1500, 600), cloneParams(VOLT));
    for (let i = 0; i < 400; i++) sim.step(makeFrame(0, 1, 0));
    for (let i = 0; i < 600; i++) sim.step(makeFrame(0, 0, 1));
    expect(sim.vehicle.forwardSpeed).toBeLessThan(-3);
  });

  it('does not creep on a flat surface when idle', async () => {
    const sim = await Simulation.create(buildFlatPad(300, 300), cloneParams(VOLT));
    for (let i = 0; i < 600; i++) sim.step(makeFrame(0, 0, 0));
    expect(sim.vehicle.speed).toBeLessThan(0.05);
  });
});

describe('grey-box track', () => {
  it('the path bot completes the whole course without a respawn', async () => {
    const track = buildGreyboxTrack();
    const sim = await Simulation.create(track, cloneParams(VOLT));
    const bot = new PathBot(track.centerline, track.centerSurface);
    let ticks = 0;
    while (!bot.finished && ticks < 9000) {
      sim.step(bot.drive(sim.vehicle));
      ticks++;
    }
    expect(bot.finished).toBe(true);
    expect(sim.respawnCount).toBe(0);
  });
});
