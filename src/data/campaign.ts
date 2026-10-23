import { Medal, medalRank } from '../core/Medals';
import { LEVELS } from './index';
import placement from './campaign.json';

export const SEASON_COUNT = 4;
export const LEVELS_PER_SEASON = 25;

export interface SeasonDef {
  id: number;
  name: string;
  theme: string;
  blurb: string;
  /** Fraction of the medal points available in earlier seasons that must be earned to open this one. */
  gate: number;
}

export const SEASONS: readonly SeasonDef[] = [
  { id: 0, name: 'Neon City Night', theme: 'neon', blurb: 'Beginner friendly. Learn the Volt.', gate: 0 },
  { id: 1, name: 'Alpine Snow', theme: 'alpine', blurb: 'New mechanics. Ice and altitude.', gate: 0.25 },
  { id: 2, name: 'Desert Canyon', theme: 'desert', blurb: 'Fast, big jumps, wide sand.', gate: 0.5 },
  { id: 3, name: 'Coast & Industry', theme: 'coast', blurb: 'Expert tracks and creative gimmicks.', gate: 0.75 },
];

export interface CampaignLevel {
  /** 1-based global number (1..100). */
  number: number;
  season: number;
  /** 0-based slot inside the season. */
  slot: number;
  /** Level id, or null for a slot whose level has not been built yet. */
  levelId: string | null;
}

/** Where every built-in level sits in the 4 x 25 campaign (written by `npm run campaign`). */
const PLACED = placement as Array<[season: number, slot: number, id: string]>;

export function buildCampaign(placed: ReadonlyArray<[number, number, string]> = PLACED): CampaignLevel[] {
  const known = new Set(LEVELS.map((l) => l.id));
  const out: CampaignLevel[] = [];
  for (let s = 0; s < SEASON_COUNT; s++) {
    for (let k = 0; k < LEVELS_PER_SEASON; k++) {
      const hit = placed.find((p) => p[0] === s && p[1] === k);
      out.push({ number: s * LEVELS_PER_SEASON + k + 1, season: s, slot: k, levelId: hit && known.has(hit[2]) ? hit[2] : null });
    }
  }
  return out;
}

export const CAMPAIGN: readonly CampaignLevel[] = buildCampaign();

export const MEDAL_POINTS: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3, author: 4 };
/** Medal needed on a level to unlock the next one in its season. */
export const UNLOCK_MEDAL: Medal = 'bronze';

export interface LevelState {
  entry: CampaignLevel;
  available: boolean;
  unlocked: boolean;
  medal: Medal;
  /** Why it is locked (shown on the card), or null. */
  lockReason: string | null;
}

export interface SeasonState {
  def: SeasonDef;
  unlocked: boolean;
  /** Points earned inside this season / the most it can give with the levels that exist. */
  points: number;
  maxPoints: number;
  /** Points from earlier seasons needed to open it, and how many the player has. */
  required: number;
  have: number;
}

export interface CampaignState {
  levels: LevelState[];
  seasons: SeasonState[];
  totalPoints: number;
  maxPoints: number;
}

export interface CampaignOptions {
  /** Treat everything as unlocked (accessibility option / dev). */
  unlockAll?: boolean;
  levels?: readonly CampaignLevel[];
  names?: (levelId: string) => string;
}

/**
 * Progressive unlocks: a level opens when the previous level of its season has at least Bronze; a season
 * opens when enough medal points were earned in the seasons before it (a fraction of what exists).
 */
export function computeCampaign(medalOf: (levelId: string) => Medal, opts: CampaignOptions = {}): CampaignState {
  const entries = opts.levels ?? CAMPAIGN;
  const nameOf = opts.names ?? ((id: string) => id);
  const seasons: SeasonState[] = [];
  const levels: LevelState[] = [];
  let earlierPoints = 0;
  let earlierMax = 0;

  for (const def of SEASONS) {
    const inSeason = entries.filter((e) => e.season === def.id);
    const medals = inSeason.map((e) => (e.levelId ? medalOf(e.levelId) : 'none'));
    const points = medals.reduce((a, m) => a + MEDAL_POINTS[m], 0);
    const maxPoints = inSeason.filter((e) => e.levelId).length * MEDAL_POINTS.author;

    const required = def.gate === 0 ? 0 : Math.ceil(def.gate * earlierMax);
    const unlocked = !!opts.unlockAll || def.gate === 0 || (earlierMax > 0 && earlierPoints >= required);
    seasons.push({ def, unlocked, points, maxPoints, required, have: earlierPoints });

    let prev: CampaignLevel | undefined;
    for (const [i, e] of inSeason.entries()) {
      const available = e.levelId !== null;
      let lock: string | null = null;
      if (!available) lock = 'Coming soon';
      else if (!opts.unlockAll) {
        if (!unlocked) lock = `Season locked`;
        else if (prev && medalRank(medals[inSeason.indexOf(prev)]!) < medalRank(UNLOCK_MEDAL)) lock = `Earn Bronze on ${nameOf(prev.levelId!)}`;
      }
      levels.push({ entry: e, available, unlocked: available && lock === null, medal: medals[i]!, lockReason: lock });
      if (available) prev = e;
    }
    earlierPoints += points;
    earlierMax += maxPoints;
  }
  return { levels, seasons, totalPoints: earlierPoints, maxPoints: earlierMax };
}

/** The campaign entry after `levelId` that is available (for "Next level"), or null. */
export function nextAvailable(levelId: string, entries: readonly CampaignLevel[] = CAMPAIGN): CampaignLevel | null {
  const i = entries.findIndex((e) => e.levelId === levelId);
  if (i < 0) return null;
  for (let k = i + 1; k < entries.length; k++) if (entries[k]!.levelId) return entries[k]!;
  return null;
}
