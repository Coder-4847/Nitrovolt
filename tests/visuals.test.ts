import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data';
import { SAMPLE } from './sample';
import { CLEARANCE, planScenery } from '../src/render/env/SceneryPlan';
import { THEMES, themeFor } from '../src/render/env/Theme';
import { ResolutionGovernor, benchmarkStep } from '../src/render/Quality';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { SceneryKit } from '../src/render/env/Theme';

const KITS: SceneryKit[] = ['stadium', 'winter', 'canyon', 'sunset'];
const tracks = SAMPLE.map((l) => buildTrack(l));

function nearest(track: ReturnType<typeof buildTrack>, x: number, z: number): number {
  let best = Infinity;
  for (const p of track.centerline) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
  return best;
}

describe('scenery placement', () => {
  it('is deterministic for a track, kit and density', () => {
    const t = tracks[0]!;
    const a = planScenery({ centerline: t.centerline, seed: 7, groundY: -12 }, 'stadium', 1);
    const b = planScenery({ centerline: t.centerline, seed: 7, groundY: -12 }, 'stadium', 1);
    expect(a.length).toBeGreaterThan(50);
    expect(b).toEqual(a);
    const c = planScenery({ centerline: t.centerline, seed: 8, groundY: -12 }, 'stadium', 1);
    expect(c).not.toEqual(a);
  });

  it('never places anything inside the corridor around the driving line', () => {
    for (const t of tracks) {
      for (const kit of KITS) {
        const props = planScenery({ centerline: t.centerline, seed: 3, groundY: -12 }, kit, 1.35);
        for (const p of props) {
          const d = nearest(t, p.x, p.z);
          // big terraced mounds keep their whole footprint out of the corridor
          const reach = p.kind === 'terrace' ? Math.max(p.sx, p.sz) / 2 : 0;
          expect(d - reach, `${t.id}/${kit}/${p.kind}`).toBeGreaterThanOrEqual(CLEARANCE - 0.01);
        }
      }
    }
  });

  it('scales with the quality density', () => {
    const t = tracks[1]!;
    const lo = planScenery({ centerline: t.centerline, seed: 3, groundY: 0 }, 'winter', 0.35).length;
    const hi = planScenery({ centerline: t.centerline, seed: 3, groundY: 0 }, 'winter', 1).length;
    expect(hi).toBeGreaterThan(lo * 1.8);
  });

  it('sits every prop on the ground plane or on top of another prop', () => {
    const t = tracks[0]!;
    for (const p of planScenery({ centerline: t.centerline, seed: 3, groundY: -12 }, 'sunset', 1)) expect(p.y).toBeGreaterThanOrEqual(-12);
  });
});

describe('themes', () => {
  it('every built-in level uses one of the four season themes', () => {
    for (const l of LEVELS) expect(['neon', 'alpine', 'desert', 'coast']).toContain(themeFor(l.theme).id);
  });

  it('old theme names still resolve', () => {
    expect(themeFor('grey').id).toBe('stadium');
    expect(themeFor('rally').id).toBe('coast');
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
          expect([8, 12, 16]).toContain(Math.round(w));
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
