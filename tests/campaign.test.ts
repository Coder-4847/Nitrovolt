import { describe, expect, it } from 'vitest';
import { Medal } from '../src/core/Medals';
import { CAMPAIGN, CampaignLevel, MEDAL_POINTS, TIERS, TIER_UNLOCK, TRAINING, computeCampaign, nextAvailable, trackOfTheDay } from '../src/data/campaign';
import { LEVELS } from '../src/data';

const medals = (m: Record<string, Medal>) => (id: string): Medal => m[id] ?? 'none';

/** A synthetic five-per-tier campaign, to prove the rules independently of the shipped tracks. */
const FULL: CampaignLevel[] = TIERS.flatMap((t) => Array.from({ length: 5 }, (_, k) => ({ number: t.id * 5 + k + 1, tier: t.id, levelId: `L${t.id}${k}`, blurb: '' })));

describe('campaign structure', () => {
  it('is 25 tracks in 5 tiers of 5, numbered 1..25, plus training', () => {
    expect(CAMPAIGN).toHaveLength(25);
    expect(CAMPAIGN[0]!.number).toBe(1);
    expect(CAMPAIGN[24]!.number).toBe(25);
    for (const t of TIERS) expect(CAMPAIGN.filter((c) => c.tier === t.id)).toHaveLength(5);
    expect(TRAINING.length).toBeGreaterThanOrEqual(6);
    expect(TRAINING.every((c) => c.tier === 'training')).toBe(true);
  });

  it('places every built-in level exactly once', () => {
    const placed = [...CAMPAIGN, ...TRAINING].map((c) => c.levelId);
    expect(new Set(placed).size).toBe(placed.length);
    for (const l of LEVELS) expect(placed).toContain(l.id);
    expect(placed).toHaveLength(LEVELS.length);
  });

  it('every track has a blurb', () => {
    for (const c of [...CAMPAIGN, ...TRAINING]) expect(c.blurb.length, c.levelId).toBeGreaterThan(10);
  });
});

describe('tier unlocks', () => {
  it('starts with the White tier and all of training open', () => {
    const st = computeCampaign(medals({}), { campaign: FULL });
    expect(st.tiers.map((t) => t.unlocked)).toEqual([true, false, false, false, false]);
    expect(st.levels.filter((l) => l.entry.tier === 0).every((l) => l.unlocked)).toBe(true);
    expect(st.levels.find((l) => l.entry.tier === 1)!.lockReason).toContain('White');
    expect(st.training.every((l) => l.unlocked)).toBe(true);
  });

  it(`opens the next tier with Bronze on ${TIER_UNLOCK} tracks, not fewer`, () => {
    const three: Record<string, Medal> = { L00: 'bronze', L01: 'gold', L02: 'author' };
    expect(computeCampaign(medals(three), { campaign: FULL }).tiers[1]!.unlocked).toBe(false);
    const four = { ...three, L03: 'silver' as Medal };
    const st = computeCampaign(medals(four), { campaign: FULL });
    expect(st.tiers[1]!.unlocked).toBe(true);
    expect(st.tiers[2]!.unlocked).toBe(false);
    expect(st.tiers[0]!.done).toBe(4);
  });

  it('never skips a tier, whatever the medals further on', () => {
    const st = computeCampaign(medals({ L20: 'author', L21: 'author', L22: 'author', L23: 'author' }), { campaign: FULL });
    expect(st.tiers[2]!.unlocked).toBe(false);
    expect(st.tiers[3]!.unlocked).toBe(false);
  });

  it('can unlock everything for accessibility', () => {
    const st = computeCampaign(medals({}), { unlockAll: true });
    expect(st.levels.every((l) => l.unlocked && !l.lockReason)).toBe(true);
  });

  it('counts points per medal', () => {
    const st = computeCampaign(medals({ L00: 'bronze', L01: 'silver', L02: 'gold', L03: 'author' }), { campaign: FULL });
    expect(st.totalPoints).toBe(1 + 2 + 3 + 4);
    expect(st.tiers[0]!.points).toBe(10);
    expect(st.maxPoints).toBe(25 * MEDAL_POINTS.author);
  });

  it('finds the next track for "Next" inside its own list', () => {
    expect(nextAvailable(CAMPAIGN[0]!.levelId)!.levelId).toBe(CAMPAIGN[1]!.levelId);
    expect(nextAvailable(CAMPAIGN[4]!.levelId)!.levelId).toBe(CAMPAIGN[5]!.levelId); // into the next tier
    expect(nextAvailable(CAMPAIGN[24]!.levelId)).toBeNull();
    expect(nextAvailable(TRAINING[0]!.levelId)!.levelId).toBe(TRAINING[1]!.levelId);
    expect(nextAvailable('nope')).toBeNull();
  });
});

describe('track of the day', () => {
  it('is a campaign track, stable for a day, and visits every track once per cycle', () => {
    const n = CAMPAIGN.length;
    expect(trackOfTheDay(20000)).toBe(trackOfTheDay(20000));
    const start = Math.ceil(20000 / n) * n;
    const seen = new Set(Array.from({ length: n }, (_, i) => trackOfTheDay(start + i)!.levelId));
    expect(seen.size).toBe(n);
    for (const id of seen) expect(CAMPAIGN.some((c) => c.levelId === id)).toBe(true);
  });
});
