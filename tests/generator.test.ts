import { describe, expect, it } from 'vitest';
import { LEVELS, getLevel } from '../src/data';
import { CAMPAIGN } from '../src/data/campaign';
import { BLOCK_TYPE_SET } from '../src/tracks/BlockLibrary';
import { layoutChain } from '../src/tracks/ChainLayout';
import { HANDMADE, MEDAL_FACTORS, TIME_WINDOW, slotProfile } from '../src/tracks/CampaignPlan';
import { Occupancy, blockCells } from '../src/tracks/Footprint';
import { flight, generateCircuit, generateLevel } from '../src/tracks/LevelGenerator';
import { validateTrackJson } from '../src/tracks/TrackSchema';

const CORNER = /^(curve|bank|chicane)/;

/** Re-check a layout against the generator's own rules. */
function selfOverlaps(blocks: ReturnType<typeof layoutChain>['blocks'], closed: boolean): boolean {
  const occ = new Occupancy(2.6, 1e9);
  let clash = false;
  blocks.forEach((b, i) => {
    let cells = blockCells(b);
    if (closed && i === blocks.length - 1) cells = cells.filter((c) => !blockCells(blocks[0]!).some((d) => d.x === c.x && d.z === c.z));
    if (occ.conflicts(cells, i)) clash = true;
    occ.add(cells, i);
  });
  return clash;
}

describe('level generator', () => {
  it('is deterministic for a profile and seed', () => {
    const p = slotProfile(1, 6);
    const a = generateLevel(p, 1234);
    const b = generateLevel(p, 1234);
    expect(a).not.toBeNull();
    expect(b!.blocks).toEqual(a!.blocks);
  });

  it('produces valid, non-overlapping layouts that follow the design rules, in every season', () => {
    let made = 0;
    for (let s = 0; s < 4; s++) {
      for (const k of [2, 11, 22]) {
        const p = slotProfile(s, k);
        for (let seed = 1; seed < 40 && made < s * 9 + (k === 2 ? 3 : k === 11 ? 6 : 9); seed++) {
          const g = p.lap ? generateCircuit(p, seed * 101) : generateLevel(p, seed * 101);
          if (!g) continue;
          made++;
          const json = { id: 'g', name: 'g', car: p.car, theme: p.theme, seed, laps: p.laps, blocks: g.blocks, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 } };
          expect(validateTrackJson(json, BLOCK_TYPE_SET)).toEqual([]);
          expect(() => layoutChain(g.items)).not.toThrow();
          expect(selfOverlaps(g.blocks, p.lap), `${p.id}/${seed}`).toBe(false);
          // boost pads are never followed by a corner before at least three straight cells
          g.blocks.forEach((b, i) => {
            if (b.surface !== 'turbo' && b.surface !== 'turbo2') return;
            const next = g.blocks.slice(i + 1, i + 3);
            expect(next.some((n) => CORNER.test(n.type)), `${p.id}/${seed}: corner right after a pad at ${i}`).toBe(false);
          });
          // every landing is followed by straight road
          g.blocks.forEach((b, i) => {
            if (!b.type.startsWith('landing')) return;
            expect(g.blocks[i + 1]?.type.startsWith('straight'), `${p.id}/${seed}: no run-out after landing ${i}`).toBe(true);
          });
        }
      }
    }
    expect(made).toBeGreaterThanOrEqual(30);
  });

  it('lap circuits close exactly on their lap line', () => {
    const p = slotProfile(3, 15);
    expect(p.lap).toBe(true);
    const g = generateCircuit(p, 77)!;
    const { next } = layoutChain(g.items);
    expect([next.gridPos[0], next.gridPos[1], next.gridPos[2], next.rot].map((n) => n + 0)).toEqual([0, 0, 0, 0]);
  });

  it('sizes jumps from measured flight distances', () => {
    expect(flight('volt', 'kicker', 25)).toBeCloseTo(0.8, 5);
    expect(flight('dune', 'jumpRamp', 40)).toBeGreaterThan(flight('volt', 'jumpRamp', 40));
    expect(flight('volt', 'jumpRamp', 45)).toBeGreaterThan(flight('volt', 'jumpRamp', 40));
  });
});

describe('the 100-level campaign', () => {
  it('fills all 100 slots with distinct, valid levels', () => {
    const ids = CAMPAIGN.map((c) => c.levelId);
    expect(ids.every((x) => x !== null)).toBe(true);
    expect(new Set(ids).size).toBe(100);
    expect(LEVELS.length).toBeGreaterThanOrEqual(100);
    for (const id of Object.keys(HANDMADE)) {
      const [s, k] = HANDMADE[id]!;
      expect(CAMPAIGN[s * 25 + k]!.levelId).toBe(id);
    }
    for (const c of CAMPAIGN) expect(validateTrackJson(getLevel(c.levelId)!, BLOCK_TYPE_SET), c.levelId!).toEqual([]);
  });

  it('has unique names and the right car / theme per season', () => {
    const names = CAMPAIGN.map((c) => getLevel(c.levelId)!.name);
    expect(new Set(names).size).toBe(100);
    const themes = ['neon', 'alpine', 'desert', 'coast'];
    for (const c of CAMPAIGN) expect(getLevel(c.levelId)!.theme, c.levelId!).toBe(themes[c.season]);
    expect(CAMPAIGN.filter((c) => c.season === 0).every((c) => getLevel(c.levelId)!.car === 'volt')).toBe(true);
    const cars = new Set(CAMPAIGN.filter((c) => c.season === 3).map((c) => getLevel(c.levelId)!.car));
    expect(cars.size).toBeGreaterThanOrEqual(3);
  });

  it('derives medal times from the author (bot) time with the season margins, inside the time window', () => {
    for (const c of CAMPAIGN) {
      const lv = getLevel(c.levelId)!;
      const m = lv.medalTimes;
      const [g, s, b] = MEDAL_FACTORS[c.season]!;
      expect(m.author).toBeGreaterThan(0);
      expect(m.gold).toBe(Math.round(m.author * g));
      expect(m.silver).toBe(Math.round(m.author * s));
      expect(m.bronze).toBe(Math.round(m.author * b));
      if (!(lv.id in HANDMADE)) {
        const [lo, hi] = TIME_WINDOW[c.season]!;
        expect(m.author / 1000, lv.id).toBeGreaterThanOrEqual(lo);
        expect(m.author / 1000, lv.id).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('gets harder: later seasons are longer on average', () => {
    const avg = (s: number): number => {
      const ls = CAMPAIGN.filter((c) => c.season === s).map((c) => getLevel(c.levelId)!.medalTimes.author);
      return ls.reduce((a, b) => a + b, 0) / ls.length;
    };
    expect(avg(3)).toBeGreaterThan(avg(0));
  });
});
