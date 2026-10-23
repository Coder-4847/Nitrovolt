import { Medal, medalRank } from '../core/Medals';
import { LEVELS } from './index';
import manifest from './levels.json';

/** Campaign difficulty tiers (five tracks each), plus the training tracks. */
export type Tier = 'training' | 0 | 1 | 2 | 3 | 4;

export interface TierDef {
  id: 0 | 1 | 2 | 3 | 4;
  name: string;
  /** Badge colour (CSS). */
  color: string;
  blurb: string;
}

export const TIERS: readonly TierDef[] = [
  { id: 0, name: 'White', color: '#f2f4f7', blurb: 'First laps: one car, clean lines.' },
  { id: 1, name: 'Green', color: '#3fd26f', blurb: 'Wall turns, loops and your first car switch.' },
  { id: 2, name: 'Blue', color: '#3d8bff', blurb: 'Mixed cars, ice, dirt and big air.' },
  { id: 3, name: 'Red', color: '#ff4a3d', blurb: 'Fast, technical and unforgiving.' },
  { id: 4, name: 'Black', color: '#2a2d33', blurb: 'Everything at once. Good luck.' },
];

/** Bronze (or better) on this many tracks of a tier opens the next tier. */
export const TIER_UNLOCK = 4;

export interface CampaignLevel {
  /** 1-based number inside its list (campaign 1..25, training 1..n). */
  number: number;
  tier: Tier;
  levelId: string;
  blurb: string;
}

interface ManifestEntry { id: string; tier: Tier; blurb: string }

/** Every built-in level in play order (written by scripts/make-levels.mts). */
const ENTRIES = (manifest as ManifestEntry[]).filter((e) => LEVELS.some((l) => l.id === e.id));

export const TRAINING: readonly CampaignLevel[] = ENTRIES.filter((e) => e.tier === 'training').map((e, i) => ({ number: i + 1, tier: e.tier, levelId: e.id, blurb: e.blurb }));
export const CAMPAIGN: readonly CampaignLevel[] = ENTRIES.filter((e) => e.tier !== 'training').map((e, i) => ({ number: i + 1, tier: e.tier, levelId: e.id, blurb: e.blurb }));

export const MEDAL_POINTS: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3, author: 4 };
/** Medal that counts a track as done for unlocking. */
export const UNLOCK_MEDAL: Medal = 'bronze';

export interface LevelState {
  entry: CampaignLevel;
  available: boolean;
  unlocked: boolean;
  medal: Medal;
  /** Why it is locked (shown on the card), or null. */
  lockReason: string | null;
}

export interface TierState {
  def: TierDef;
  unlocked: boolean;
  /** Tracks with at least bronze / tracks in the tier. */
  done: number;
  count: number;
  points: number;
  maxPoints: number;
}

export interface CampaignState {
  /** Campaign tracks then training tracks. */
  levels: LevelState[];
  tiers: TierState[];
  training: LevelState[];
  totalPoints: number;
  maxPoints: number;
}

export interface CampaignOptions {
  /** Treat everything as unlocked (accessibility option / dev). */
  unlockAll?: boolean;
  campaign?: readonly CampaignLevel[];
  training?: readonly CampaignLevel[];
}

/**
 * Unlocks: training is always open; the White tier is open; each further tier opens once TIER_UNLOCK tracks
 * of the tier before it have at least Bronze. Inside an open tier every track is playable.
 */
export function computeCampaign(medalOf: (levelId: string) => Medal, opts: CampaignOptions = {}): CampaignState {
  const campaign = opts.campaign ?? CAMPAIGN;
  const training = opts.training ?? TRAINING;
  const tiers: TierState[] = [];
  const levels: LevelState[] = [];
  let open = true;
  let total = 0, max = 0;
  for (const def of TIERS) {
    const inTier = campaign.filter((e) => e.tier === def.id);
    const medals = inTier.map((e) => medalOf(e.levelId));
    const done = medals.filter((m) => medalRank(m) >= medalRank(UNLOCK_MEDAL)).length;
    const points = medals.reduce((a, m) => a + MEDAL_POINTS[m], 0);
    const unlocked: boolean = !!opts.unlockAll || open;
    tiers.push({ def, unlocked, done, count: inTier.length, points, maxPoints: inTier.length * MEDAL_POINTS.author });
    inTier.forEach((e, i) => {
      const lock = unlocked ? null : `Finish ${TIER_UNLOCK} ${TIERS[def.id - 1]?.name ?? ''} tracks`;
      levels.push({ entry: e, available: true, unlocked, medal: medals[i]!, lockReason: lock });
    });
    total += points;
    max += inTier.length * MEDAL_POINTS.author;
    // the next tier opens with enough tracks done here (a short tier needs all of them)
    open = unlocked && done >= Math.min(TIER_UNLOCK, inTier.length);
  }
  const train = training.map((e): LevelState => ({ entry: e, available: true, unlocked: true, medal: medalOf(e.levelId), lockReason: null }));
  return { levels: [...levels, ...train], tiers, training: train, totalPoints: total, maxPoints: max };
}

/** The track after `levelId` in its own list (campaign or training), or null at the end. */
export function nextAvailable(levelId: string): CampaignLevel | null {
  for (const list of [CAMPAIGN, TRAINING]) {
    const i = list.findIndex((e) => e.levelId === levelId);
    if (i >= 0) return list[i + 1] ?? null;
  }
  return null;
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
