import { describe, expect, it } from 'vitest';
import { CAMPAIGN, WORLDS, lengthClass, nextLevel, trackOfTheDay, worldOf } from '../src/data/campaign';
import { LEVELS, getLevel } from '../src/data';

/** Cars a level is driven with, in order (start car, then every gate). */
function carsOf(id: string): string[] {
  const lv = getLevel(id)!;
  const out = [lv.car];
  for (const b of lv.blocks) if (b.type.startsWith('gate')) out.push(b.type.slice(4).toLowerCase());
  return out.filter((c, i) => i === 0 || c !== out[i - 1]);
}

describe('campaign structure', () => {
  it('is 25 tracks in 5 worlds of 5, numbered 1..25', () => {
    expect(CAMPAIGN).toHaveLength(25);
    expect(CAMPAIGN[0]!.number).toBe(1);
    expect(CAMPAIGN[24]!.number).toBe(25);
    expect(WORLDS).toHaveLength(5);
    for (const w of WORLDS) expect(CAMPAIGN.filter((c) => c.world === w.id), w.name).toHaveLength(5);
  });

  it('places every built-in level exactly once, in its own world', () => {
    const placed = CAMPAIGN.map((c) => c.levelId);
    expect(new Set(placed).size).toBe(placed.length);
    for (const l of LEVELS) expect(placed).toContain(l.id);
    expect(placed).toHaveLength(LEVELS.length);
    for (const c of CAMPAIGN) expect(getLevel(c.levelId)!.theme, c.levelId).toBe(c.world);
  });

  it('every track has a blurb and a target time', () => {
    for (const c of CAMPAIGN) {
      expect(c.blurb.length, c.levelId).toBeGreaterThan(10);
      expect(getLevel(c.levelId)!.target ?? 0, c.levelId).toBeGreaterThan(0);
    }
  });

  it('has no unlock gates: nothing but the clock', () => {
    expect(Object.keys(CAMPAIGN[0]!).sort()).toEqual(['blurb', 'levelId', 'number', 'world']);
  });

  it('runs five sprints, fifteen standard tracks and five marathons', () => {
    const times = CAMPAIGN.map((c) => getLevel(c.levelId)!.target! / 1000);
    // the bot's run is the target; a first-time player is a little slower, so the bands sit on the fast side
    const sprint = times.filter((t) => t >= 30 && t <= 45);
    const standard = times.filter((t) => t >= 60 && t <= 78);
    const marathon = times.filter((t) => t >= 90 && t <= 120);
    expect(sprint).toHaveLength(5);
    expect(standard).toHaveLength(15);
    expect(marathon).toHaveLength(5);
    expect(CAMPAIGN.filter((c) => lengthClass(getLevel(c.levelId)!.target!) === 'Sprint')).toHaveLength(5);
    // each world runs a sprint, three standards and a marathon
    for (const w of WORLDS) {
      const cls = CAMPAIGN.filter((c) => c.world === w.id).map((c) => lengthClass(getLevel(c.levelId)!.target!)).sort();
      expect(cls, w.name).toEqual(['Marathon', 'Sprint', 'Standard', 'Standard', 'Standard']);
    }
  });

  it('every track switches car at least once; five are three-car tracks; some switch and switch back', () => {
    const cars = CAMPAIGN.map((c) => carsOf(c.levelId));
    for (const [i, c] of cars.entries()) expect(c.length, CAMPAIGN[i]!.levelId).toBeGreaterThanOrEqual(2);
    const distinct = cars.map((c) => new Set(c).size);
    expect(distinct.filter((n) => n >= 3).length).toBeGreaterThanOrEqual(5);
    expect(distinct.filter((n) => n >= 4).length).toBeGreaterThanOrEqual(1);
    const back = cars.filter((c) => c.length >= 3 && c[0] === c[c.length - 1]);
    expect(back.length).toBeGreaterThanOrEqual(5);
  });
});

describe('navigation', () => {
  it('finds the next track for "Next", across worlds, and none after the last', () => {
    expect(nextLevel(CAMPAIGN[0]!.levelId)!.levelId).toBe(CAMPAIGN[1]!.levelId);
    expect(nextLevel(CAMPAIGN[4]!.levelId)!.levelId).toBe(CAMPAIGN[5]!.levelId);
    expect(nextLevel(CAMPAIGN[24]!.levelId)).toBeNull();
    expect(nextLevel('nope')).toBeNull();
  });

  it('knows the world of a theme', () => {
    expect(worldOf('snow').name).toBe('Winter');
    expect(worldOf('sunset').name).toBe('Autumn');
    expect(worldOf('forest').name).toBe('Summer');
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
