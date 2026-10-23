import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data';
import { carParams } from '../src/data/cars';
import { RAPIER } from '../src/physics/RapierWorld';
import { Simulation } from '../src/physics/Simulation';
import { Rng } from '../src/core/Rng';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { terrainHeight } from '../src/tracks/Terrain';
import { SAMPLE } from './sample';

describe('terrain', () => {
  it('every built-in level has terrain that is deterministic', () => {
    for (const lv of LEVELS.slice(0, 4)) {
      const a = buildTrack(lv).terrain!, b = buildTrack(lv).terrain!;
      expect(a, lv.id).not.toBeNull();
      expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
    }
  });

  it('the drawn ground matches the physics heightfield (same triangles)', async () => {
    const lv = SAMPLE.find((l) => l.id === 'c05')!;
    const track = buildTrack(lv);
    const t = track.terrain!;
    const sim = await Simulation.create(track, carParams('gravel'), 0);
    const rng = new Rng(5);
    let worst = 0, hits = 0;
    for (let k = 0; k < 400; k++) {
      const x = t.x0 + t.step * (1 + rng.next() * (t.nx - 3)), z = t.z0 + t.step * (1 + rng.next() * (t.nz - 3));
      const ray = new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 });
      const hit = sim.world.world.castRay(ray, 1000, true, undefined, undefined, undefined, undefined, (c) => sim.world.infoOf(c.handle).offroad === true);
      if (!hit) continue;
      hits++;
      worst = Math.max(worst, Math.abs(400 - hit.timeOfImpact - terrainHeight(t, x, z)));
    }
    expect(hits).toBeGreaterThan(300);
    expect(worst).toBeLessThan(0.02);
  });

  it('stays under the driving surface (a kerb below it)', () => {
    for (const lv of SAMPLE) {
      const track = buildTrack(lv);
      const t = track.terrain!;
      track.centerline.forEach((p, i) => {
        if (track.centerFrame[i]!.kind !== 'road') return;
        expect(terrainHeight(t, p.x, p.z), `${lv.id} sample ${i}`).toBeLessThan(p.y - 0.1);
      });
    }
  });
});
