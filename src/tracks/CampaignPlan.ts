import { CarId } from '../data/cars';
import { EffectId, SurfaceId } from '../physics/Surface';
import { GenProfile } from './LevelGenerator';

/** Hand-made levels and the campaign slot they keep ([season, slot]). */
export const HANDMADE: Record<string, [number, number]> = {
  sprint01: [0, 0],
  circuit01: [0, 4],
  boostlab: [0, 9],
  stunt01: [0, 19],
  frost01: [1, 0],
  dune01: [2, 0],
  gravel01: [3, 0],
};

/** Lap (closed circuit) slots per season. */
const LAP_SLOTS: number[][] = [[14], [7, 18], [10, 21], [6, 15, 23]];

/**
 * Gold / silver / bronze as multiples of the author (validation bot) time; margins tighten each season.
 * The author medal is the bot's own time, which its ghost proves is reachable.
 */
export const MEDAL_FACTORS: Array<[number, number, number]> = [
  [1.1, 1.25, 1.5],
  [1.08, 1.2, 1.42],
  [1.07, 1.17, 1.36],
  [1.06, 1.14, 1.3],
];

/** Accepted bot (author) time window in seconds per season: short punchy tracks, a bit longer later on. */
export const TIME_WINDOW: Array<[number, number]> = [[18, 50], [24, 70], [26, 80], [30, 95]];

export const levelId = (season: number, slot: number): string => `s${season + 1}-${String(slot + 1).padStart(2, '0')}`;

const THEME = ['neon', 'alpine', 'desert', 'coast'];

/** Car per slot: season 1 is all Volt, the others favour their specialist and mix in the rest. */
function carFor(season: number, slot: number): CarId {
  const pattern: CarId[][] = [
    ['volt'],
    ['frost', 'frost', 'volt', 'frost', 'frost', 'volt', 'frost'],
    ['dune', 'dune', 'gravel', 'dune', 'volt', 'dune', 'gravel'],
    ['gravel', 'volt', 'frost', 'gravel', 'dune', 'volt', 'gravel', 'volt'],
  ];
  const p = pattern[season]!;
  return p[slot % p.length]!;
}

const GROUND: Record<CarId, { main: SurfaceId; patches: SurfaceId[] }> = {
  volt: { main: 'tarmac', patches: ['tech', 'tarmac'] },
  frost: { main: 'snow', patches: ['ice', 'tarmac', 'snow'] },
  dune: { main: 'sand', patches: ['dirt', 'sand'] },
  gravel: { main: 'dirt', patches: ['grass', 'sand', 'tarmac'] },
};

/** The generation profile for a campaign slot. Difficulty rises through the campaign and through each season. */
export function slotProfile(season: number, slot: number): GenProfile & { lap: boolean; id: string } {
  const local = slot / 24;
  const difficulty = Math.min(1, season * 0.22 + local * 0.34);
  const car = carFor(season, slot);
  let { main, patches } = GROUND[car];
  // Volt in the snow season drives cleared roads with snowy / icy stretches
  if (car === 'volt' && season === 1) patches = ['snow', 'tarmac', 'ice'];
  if (car === 'volt' && season === 2) patches = ['dirt', 'tarmac'];
  if (season === 0 && local < 0.3) patches = [];
  const specials: EffectId[] = [];
  const add = (e: EffectId, from: number): void => {
    if (season * 25 + slot >= from) specials.push(e);
  };
  add('cruise', 10); add('fragile', 14); add('noBrake', 25); add('noSteer', 29); add('slowMo', 33);
  add('gravity', 52); add('reactor', 56); add('engineOff', 76);
  const sets: GenProfile['sets'] = [];
  if (car === 'volt') {
    if (season * 25 + slot >= 8) sets.push('halfpipe');
    if (season * 25 + slot >= 12) sets.push('wallRide');
    if (season * 25 + slot >= 16) sets.push('loop');
  }
  if (season * 25 + slot >= 20) sets.push('spiral');
  if (season >= 2) sets.push('platform');
  const lap = LAP_SLOTS[season]!.includes(slot);
  const cellsBase = [46, 56, 66, 74][season]!;
  const cells = Math.round(cellsBase + local * 20);
  const vmax = car === 'volt' ? 75 : car === 'dune' ? 62 : car === 'frost' ? 50 : 55;
  return {
    id: levelId(season, slot),
    season,
    slot,
    difficulty,
    car,
    theme: THEME[season]!,
    main,
    patches,
    specials,
    sets,
    jumpWeight: 0.35 + season * 0.2 + local * 0.3,
    cells,
    checkpoints: Math.min(6, 2 + Math.floor((cells - 30) / 14)),
    laps: lap ? (season >= 2 ? 3 : 2) : 1,
    variants: season === 2 ? [['wide', 2], ['std', 2]] : difficulty > 0.55 ? [['std', 4], ['narrow', 1.5], ['wide', 1]] : [['std', 4], ['wide', 1]],
    hairpins: difficulty > 0.3 && car !== 'frost',
    vmax,
    lap,
  };
}
