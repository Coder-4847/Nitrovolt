import { describe, expect, it } from 'vitest';
import { Medal } from '../src/core/Medals';
import { CAMPAIGN, LEVELS_PER_SEASON, MEDAL_POINTS, SEASON_COUNT, buildCampaign, computeCampaign, nextAvailable } from '../src/data/campaign';
import { LEVELS } from '../src/data';

/** A fully built 100-level campaign (as Phase 6 will deliver) to prove the rules at full size. */
const FULL = (() => {
  const placed: Array<[number, number, string]> = [];
  for (let s = 0; s < SEASON_COUNT; s++) for (let k = 0; k < LEVELS_PER_SEASON; k++) placed.push([s, k, `L${s * 25 + k}`]);
  return placed.map(([s, k, id]) => ({ number: s * 25 + k + 1, season: s, slot: k, levelId: id }));
})();

const medals = (m: Record<string, Medal>) => (id: string): Medal => m[id] ?? 'none';

describe('campaign structure', () => {
  it('is 4 seasons x 25 levels = 100 slots, numbered 1..100', () => {
    expect(CAMPAIGN).toHaveLength(100);
    expect(CAMPAIGN[0]!.number).toBe(1);
    expect(CAMPAIGN[99]!.number).toBe(100);
    expect(new Set(CAMPAIGN.map((c) => c.season)).size).toBe(4);
  });

  it('places every built-in level exactly once', () => {
    const placed = CAMPAIGN.filter((c) => c.levelId).map((c) => c.levelId);
    expect(new Set(placed).size).toBe(placed.length);
    for (const l of LEVELS) expect(placed).toContain(l.id);
  });

  it('ignores unknown level ids when building', () => {
    expect(buildCampaign([[0, 0, 'does-not-exist']]).filter((c) => c.levelId)).toHaveLength(0);
  });
});

describe('progressive unlocks', () => {
  it('starts with only the first level of season 1 open', () => {
    const st = computeCampaign(medals({}), { levels: FULL });
    const open = st.levels.filter((l) => l.unlocked);
    expect(open).toHaveLength(1);
    expect(open[0]!.entry.levelId).toBe('L0');
    expect(st.levels[1]!.lockReason).toContain('Earn Bronze');
  });

  it('opens the next level with Bronze, not with no medal', () => {
    expect(computeCampaign(medals({ L0: 'none' }), { levels: FULL }).levels[1]!.unlocked).toBe(false);
    for (const m of ['bronze', 'silver', 'gold', 'author'] as const) {
      expect(computeCampaign(medals({ L0: m }), { levels: FULL }).levels[1]!.unlocked, m).toBe(true);
    }
  });

  it('never opens a level that skips an unmedalled one', () => {
    const st = computeCampaign(medals({ L0: 'gold', L2: 'gold' }), { levels: FULL });
    expect(st.levels[2]!.unlocked).toBe(false);
  });

  it('gates later seasons by medal points earned before them', () => {
    // all bronze in season 1 = 25 points; gate for season 2 is 25 % of the 100 available
    const bronze1: Record<string, Medal> = {};
    for (let k = 0; k < 25; k++) bronze1[`L${k}`] = 'bronze';
    const st = computeCampaign(medals(bronze1), { levels: FULL });
    expect(st.seasons[1]!.required).toBe(25);
    expect(st.seasons[1]!.unlocked).toBe(true);
    expect(st.seasons[2]!.unlocked).toBe(false);
    const missing = { ...bronze1, L24: 'none' as Medal };
    expect(computeCampaign(medals(missing), { levels: FULL }).seasons[1]!.unlocked).toBe(false);
  });

  it('scales the gates to the levels that exist (placeholders add nothing)', () => {
    const st = computeCampaign(medals({}));
    expect(st.maxPoints).toBe(CAMPAIGN.filter((c) => c.levelId).length * MEDAL_POINTS.author);
    const s2 = st.seasons[1]!;
    expect(s2.required).toBeGreaterThan(0);
    expect(s2.required).toBeLessThanOrEqual(16); // four season-1 levels
    expect(s2.unlocked).toBe(false);
  });

  it('can unlock everything for accessibility, but placeholders stay unavailable', () => {
    const st = computeCampaign(medals({}), { unlockAll: true });
    for (const l of st.levels) expect(l.unlocked).toBe(l.available);
    expect(st.levels.some((l) => l.available)).toBe(true);
    expect(st.levels.find((l) => !l.available)!.lockReason).toBe('Coming soon');
  });

  it('counts points per medal tier', () => {
    const st = computeCampaign(medals({ L0: 'bronze', L1: 'silver', L2: 'gold', L3: 'author' }), { levels: FULL });
    expect(st.totalPoints).toBe(1 + 2 + 3 + 4);
    expect(st.seasons[0]!.points).toBe(10);
  });

  it('finds the next available level for "Next"', () => {
    expect(nextAvailable('sprint01')!.levelId).toBe('circuit01');
    expect(nextAvailable('stunt01')!.levelId).toBe('frost01'); // skips placeholders into the next season
    expect(nextAvailable('gravel01')).toBeNull();
    expect(nextAvailable('nope')).toBeNull();
  });
});
