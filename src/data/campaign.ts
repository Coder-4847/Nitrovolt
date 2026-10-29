import { LEVELS } from './index';
import manifest from './levels.json';

/** The five worlds of the campaign, five tracks each. Everything is open from the start: the game is about the time. */
export interface WorldDef {
  /** Theme id the levels use (forest, sunset, snow, desert, night). */
  id: string;
  name: string;
  /** Accent colour (CSS). */
  color: string;
  blurb: string;
}

export const WORLDS: readonly WorldDef[] = [
  { id: 'forest', name: 'Summer', color: '#ffd23a', blurb: 'Sunny valleys, lakeside roads and a run down to the beach.' },
  { id: 'sunset', name: 'Autumn', color: '#ff7a2f', blurb: 'Red woods, farm tracks and misty gorges.' },
  { id: 'snow', name: 'Winter', color: '#8fd8ff', blurb: 'Fresh powder, frozen lakes and glacier canyons.' },
  { id: 'desert', name: 'Desert', color: '#f0a040', blurb: 'Dunes, canyons and big jumps over the mesas.' },
  { id: 'night', name: 'Night', color: '#8a7dff', blurb: 'Neon streets: loops, wall rides and skyline stunts.' },
];

export const worldOf = (theme: string): WorldDef => WORLDS.find((w) => w.id === theme) ?? WORLDS[0]!;

export interface CampaignLevel {
  /** 1-based position in the campaign (1..25). */
  number: number;
  /** Theme id of the world it belongs to. */
  world: string;
  levelId: string;
  blurb: string;
}

interface ManifestEntry { id: string; world: string; blurb: string }

/** Every built-in level in play order (written by scripts/make-levels.mts). */
export const CAMPAIGN: readonly CampaignLevel[] = (manifest as ManifestEntry[])
  .filter((e) => LEVELS.some((l) => l.id === e.id))
  .map((e, i) => ({ number: i + 1, world: e.world, levelId: e.id, blurb: e.blurb }));

/** How long a track takes, from the target time (ms): a sprint, a standard track or a marathon. */
export function lengthClass(targetMs: number): 'Sprint' | 'Standard' | 'Marathon' {
  return targetMs < 50000 ? 'Sprint' : targetMs < 82000 ? 'Standard' : 'Marathon';
}

/** The track after `levelId`, or null at the end of the campaign. */
export function nextLevel(levelId: string): CampaignLevel | null {
  const i = CAMPAIGN.findIndex((e) => e.levelId === levelId);
  return i >= 0 ? CAMPAIGN[i + 1] ?? null : null;
}

/** Day number (UTC) for a date: changes at midnight UTC so everyone gets the same track of the day. */
export const dayNumber = (d: Date = new Date()): number => Math.floor(d.getTime() / 86400000);

/** Today's featured track: a different campaign track every day, cycling through all of them in a shuffled order. */
export function trackOfTheDay(day = dayNumber()): CampaignLevel | null {
  const n = CAMPAIGN.length;
  if (!n) return null;
  const cycle = Math.floor(day / n);
  // a fresh shuffle each cycle (seeded by the cycle number)
  const order = CAMPAIGN.map((_, i) => i);
  let s = (cycle * 2654435761) >>> 0 || 1;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return CAMPAIGN[order[day % n]!]!;
}
