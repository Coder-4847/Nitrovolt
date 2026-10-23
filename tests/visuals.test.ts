import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data';
import { SAMPLE } from './sample';
import { CLEARANCE, planScenery, roadDistance } from '../src/render/env/SceneryPlan';
import { THEMES, themeFor } from '../src/render/env/Theme';
import { ResolutionGovernor, benchmarkStep } from '../src/render/Quality';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { terrainHeight } from '../src/tracks/Terrain';
import { SceneryKit } from '../src/render/env/Theme';

const KITS: SceneryKit[] = ['forest', 'snow', 'desert', 'sunset', 'night'];
const tracks = SAMPLE.map((l) => buildTrack(l));

describe('scenery placement', () => {
  it('is deterministic for a track, kit, density and seed', () => {
    const t = tracks[0]!.terrain!;
    const a = planScenery(t, 'forest', 1, 7);
    const b = planScenery(t, 'forest', 1, 7);
    expect(a.length).toBeGreaterThan(200);
    expect(b).toEqual(a);
    expect(planScenery(t, 'forest', 1, 8)).not.toEqual(a);
  });

  it('keeps every prop its clearance away from the road', () => {
    for (const tr of tracks) {
      for (const kit of KITS) {
        for (const p of planScenery(tr.terrain!, kit, 1.35, 3)) {
          expect(roadDistance(tr.terrain!, p.x, p.z), `${tr.id}/${kit}/${p.kind}`).toBeGreaterThanOrEqual(CLEARANCE[p.kind] - 0.01);
        }
      }
    }
  });

  it('scales with the quality density', () => {
    const t = tracks[1]!.terrain!;
    const lo = planScenery(t, 'snow', 0.35, 3).length;
    const hi = planScenery(t, 'snow', 1, 3).length;
    expect(hi).toBeGreaterThan(lo * 1.8);
  });

  it('stands every prop on the terrain', () => {
    const t = tracks[0]!.terrain!;
    for (const p of planScenery(t, 'sunset', 1, 3)) {
      if (p.kind === 'mesa' || p.kind === 'mountain') continue; // far backdrop, sunk into the horizon
      expect(Math.abs(p.y - terrainHeight(t, p.x, p.z)), p.kind).toBeLessThan(1.5);
    }
  });
});

describe('themes', () => {
  it('every built-in level uses one of the five environments', () => {
    for (const l of LEVELS) expect(['forest', 'snow', 'desert', 'sunset', 'night']).toContain(themeFor(l.theme).id);
  });

  it('old theme names still resolve', () => {
    expect(themeFor('grey').id).toBe('stadium');
    expect(themeFor('alpine').id).toBe('snow');
    expect(themeFor('canyon').id).toBe('desert');
    expect(themeFor(undefined)).toBe(THEMES.stadium);
  });
});

describe('road markings data', () => {
  it('the driving surface carries a lateral coordinate; colliders are untouched', () => {
    const t = tracks[0]!;
    const road = t.meshes.filter((m) => m.kind === 'road' && !m.effect);
    let top = 0;
    for (const m of road) {
      expect(m.lateral!.length).toBe((m.positions.length / 3) * 2);
      for (let i = 0; i < m.lateral!.length; i += 2) {
        const lat = m.lateral![i]!, w = m.lateral![i + 1]!;
        if (lat >= 0) {
          top++;
          expect(lat).toBeLessThanOrEqual(w + 1e-4);
          expect([16, 24, 32]).toContain(Math.round(w));
        }
      }
    }
    expect(top).toBeGreaterThan(100);
  });
});

describe('quality governor', () => {
  const frames = (ms: number, n = 120): number[] => Array.from({ length: n }, (_, i) => ms + (i % 5) * 0.3);

  it('steps down on slow frames, up once with lots of headroom', () => {
    expect(benchmarkStep(frames(40), 'high', false)).toBe('medium');
    expect(benchmarkStep(frames(40), 'low', false)).toBe('low');
    expect(benchmarkStep(frames(6), 'medium', false)).toBe('high');
    expect(benchmarkStep(frames(6), 'ultra', false)).toBe('ultra');
    expect(benchmarkStep(frames(14), 'high', false)).toBe('high');
    expect(benchmarkStep(frames(6, 5), 'medium', false)).toBe('medium');
    expect(benchmarkStep(frames(6), 'medium', true)).toBe('medium'); // phones never auto-climb past medium
  });

  it('dynamic resolution drops under load and recovers, within bounds', () => {
    const g = new ResolutionGovernor();
    for (let i = 0; i < 2000; i++) g.update(0.05); // 20 fps
    expect(g.scale).toBeCloseTo(0.55, 5);
    for (let i = 0; i < 4000; i++) g.update(0.008); // 125 fps
    expect(g.scale).toBe(1);
    g.enabled = false;
    g.scale = 0.7;
    expect(g.update(0.05)).toBe(true);
    expect(g.scale).toBe(1);
  });
});
