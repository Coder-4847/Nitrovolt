import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { BLOCK_TYPE_SET } from '../src/tracks/BlockLibrary';
import { PathBot } from '../src/tracks/PathBot';
import { layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson, validateTrackJson } from '../src/tracks/TrackSchema';

const checksum = (arr: Float32Array): number => {
  let h = 0;
  for (let i = 0; i < arr.length; i += 7) h = (h * 31 + Math.round(arr[i]! * 1000)) | 0;
  return h;
};

describe('track JSON', () => {
  it('every built-in level validates', () => {
    for (const lv of LEVELS) expect(validateTrackJson(lv, BLOCK_TYPE_SET), lv.id).toEqual([]);
  });

  it('serialises and reloads to identical geometry (single source of truth)', () => {
    for (const lv of LEVELS) {
      const again = JSON.parse(JSON.stringify(lv)) as TrackJson;
      const a = buildTrack(lv);
      const b = buildTrack(again);
      expect(b.meshes.length).toBe(a.meshes.length);
      for (let i = 0; i < a.meshes.length; i++) {
        expect(b.meshes[i]!.positions.length).toBe(a.meshes[i]!.positions.length);
        expect(checksum(b.meshes[i]!.positions)).toBe(checksum(a.meshes[i]!.positions));
      }
      expect(b.triggers.length).toBe(a.triggers.length);
      expect(b.start.position.toArray()).toEqual(a.start.position.toArray());
    }
  });

  it('flags broken levels', () => {
    const lv = JSON.parse(JSON.stringify(LEVELS[0])) as TrackJson;
    lv.blocks[1]!.type = 'nope';
    lv.blocks[2]!.gridPos = [1.5, 0, 0];
    lv.blocks[3]!.surface = 'lava' as never;
    lv.blocks = lv.blocks.filter((b) => b.type !== 'finish' && b.type !== 'lapFinish');
    const errs = validateTrackJson(lv, BLOCK_TYPE_SET).join(' | ');
    expect(errs).toContain('unknown type');
    expect(errs).toContain('gridPos');
    expect(errs).toContain('unknown surface');
    expect(errs).toContain('finish');
  });

  it('declares exactly one spawn and the expected gameplay lines', () => {
    const t = buildTrack(LEVELS.find((l) => l.id === 'c25')!);
    expect(t.triggers.filter((x) => x.kind === 'checkpoint')).toHaveLength(3);
    expect(t.triggers.filter((x) => x.kind === 'finish')).toHaveLength(1);
    expect(t.triggers.filter((x) => x.kind === 'checkpoint').map((x) => x.index)).toEqual([0, 1, 2]);
  });
});

describe('wall-ride block', () => {
  for (const speed of [30, 45, 60]) {
    it(`holds a steering car on the banked wall at ${speed} m/s`, async () => {
      const { blocks } = layoutChain([{ type: 'start' }, { type: 'straight4' }, { type: 'straight4' }, { type: 'wallRide4R' }, { type: 'straight2' }, { type: 'finish' }]);
      const track = buildTrack({ id: 'w', name: 'w', car: 'volt', theme: 'g', seed: 1, blocks, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 } });
      const sim = await Simulation.create(track, cloneParams(VOLT), 0);
      const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params, track.centerFrame);
      bot.maxSpeed = speed;
      for (let i = 0; i < 4000 && sim.run.state !== 'finished' && sim.respawnCount === 0; i++) sim.step(bot.drive(sim.vehicle));
      expect(sim.respawnCount).toBe(0);
      expect(sim.run.state).toBe('finished');
    });
  }
});
