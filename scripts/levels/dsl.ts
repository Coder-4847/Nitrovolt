// Small authoring language for the hand-made levels: a level is a list of chain items (blocks in driving
// order); helpers below keep the definitions short and readable.
import { SurfaceSpec } from '../../src/physics/Surface';
import { ChainItem, ChainStart } from '../../src/tracks/ChainLayout';
import { BotHints, Variant } from '../../src/tracks/TrackSchema';
import { WallSide } from '../../src/tracks/TrackBuilder';

export interface LevelDef {
  id: string;
  name: string;
  /** Environment (the world the level belongs to): forest (summer), sunset (autumn), snow (winter), desert, night. */
  theme: string;
  /** Car at the start (gates switch it on the way). */
  car: string;
  laps?: number;
  items: ChainItem[];
  start?: ChainStart;
  /** Validation-bot style for this level. */
  hints?: BotHints;
  /** Shown on the level card. */
  blurb: string;
}

/** Options shared by the block helpers. */
export interface Opt {
  s?: SurfaceSpec;
  w?: WallSide;
  v?: Variant;
  gap?: number;
  dy?: number;
}

const mk = (type: string, o: Opt = {}): ChainItem => {
  const it: ChainItem = { type };
  if (o.s && o.s !== 'tarmac') it.surface = o.s;
  if (o.w) it.walls = o.w;
  if (o.v && o.v !== 'std') it.variant = o.v;
  if (o.gap) it.gap = o.gap;
  if (o.dy) it.dy = o.dy;
  return it;
};

/** Any block by id. */
export const B = mk;

/** Straight of n cells (32 m each) built from the fewest blocks, all with the same options. */
export function road(n: number, o: Opt = {}): ChainItem[] {
  const out: ChainItem[] = [];
  let left = n;
  for (const [id, size] of [['straight4', 4], ['straight2', 2], ['straight1', 1]] as const) {
    while (left >= size) {
      out.push(mk(id, o));
      left -= size;
    }
  }
  return out;
}

/** Turbo pad followed by `run` cells of straight to use it on. */
export const turbo = (run: number, o: Opt = {}, kind: 'turbo' | 'turbo2' | 'reactor' = 'turbo'): ChainItem[] => [mk('straight1', { ...o, s: kind }), ...road(run, o)];

/**
 * A jump over a ravine: ramp, gap and an extra-long landing one level below the gap (the car comes down on
 * its upper slope across a wide band of speeds; see scripts/jump-lab.mts for the flight table).
 */
export function jump(ramp: 'kicker' | 'jumpRamp' | 'jumpRampLong' | 'jumpRampBig' = 'jumpRamp', gap = 1, o: Opt = {}, landing: 'landingXL' | 'landingLong' = 'landingXL'): ChainItem[] {
  return [mk(ramp, o), mk(landing, { ...o, gap, dy: -1 })];
}

export const start = (o: Opt = {}): ChainItem => mk('start', o);
export const finish = (o: Opt = {}): ChainItem => mk('finish', o);
export const cp = (o: Opt = {}): ChainItem => mk('checkpoint', o);
export const lap = (o: Opt = {}): ChainItem => mk('lapFinish', o);
export const gate = (car: 'volt' | 'gravel' | 'frost' | 'dune', o: Opt = {}): ChainItem => mk(`gate${car[0]!.toUpperCase()}${car.slice(1)}`, o);
