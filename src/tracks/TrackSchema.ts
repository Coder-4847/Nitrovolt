import { SurfaceSpec, isEffect, isSurface } from '../physics/Surface';
import { WallSide } from './TrackBuilder';

/** Grid: horizontal block and vertical level sizes in metres. Block centres sit on multiples of CELL. */
export const CELL = 32;
export const LEVEL_H = 8;

export type Variant = 'std' | 'wide' | 'narrow';
/** Drivable road width per variant (m): a normal road is about ten car widths. */
export const VARIANT_WIDTH: Record<Variant, number> = { std: 24, wide: 32, narrow: 16 };

export interface BlockJson {
  type: string;
  /** Anchor cell (x, level, z). The block enters through the south edge of this cell when rot = 0. */
  gridPos: [number, number, number];
  /** Quarter turns counter-clockwise (seen from above); 0 = heading north (-Z). */
  rot: 0 | 1 | 2 | 3;
  variant?: Variant;
  /** Plain surface or special effect painted on the road; default tarmac. */
  surface?: SurfaceSpec;
  walls?: WallSide;
}

export interface MedalTimes {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/** The single source of truth for a level: loaded by the game, written by the editor. */
export interface TrackJson {
  id: string;
  name: string;
  car: string;
  theme: string;
  seed: number;
  laps?: number;
  blocks: BlockJson[];
  /** Medal thresholds in ms (0 = not yet set). */
  medalTimes: MedalTimes;
  /** Optional data-URL thumbnail. */
  thumbnail?: string;
  /** How the validation bot should drive this level (it tunes itself per car and surface). */
  bot?: BotHints;
}

export interface BotHints {
  maxSpeed?: number;
  lookTime?: number;
  steerSlew?: number;
  lateralBudget?: number;
}

const WALLS: WallSide[] = ['none', 'left', 'right', 'both'];

/** Structural validation; returns human-readable problems (empty = ok). Block types are checked by the caller's library. */
export function validateTrackJson(j: TrackJson, knownTypes: ReadonlySet<string>): string[] {
  const errs: string[] = [];
  if (!j.id) errs.push('missing id');
  if (!j.name) errs.push('missing name');
  if (!Array.isArray(j.blocks) || j.blocks.length === 0) errs.push('no blocks');
  (j.blocks ?? []).forEach((b, i) => {
    const tag = `block ${i} (${b.type})`;
    if (!knownTypes.has(b.type)) errs.push(`${tag}: unknown type`);
    if (!Array.isArray(b.gridPos) || b.gridPos.length !== 3 || b.gridPos.some((n) => !Number.isInteger(n))) errs.push(`${tag}: gridPos must be 3 integers`);
    if (![0, 1, 2, 3].includes(b.rot)) errs.push(`${tag}: rot must be 0..3`);
    if (b.variant && !(b.variant in VARIANT_WIDTH)) errs.push(`${tag}: bad variant`);
    if (b.surface && !isSurface(b.surface) && !isEffect(b.surface)) errs.push(`${tag}: unknown surface ${b.surface}`);
    if (b.walls && !WALLS.includes(b.walls)) errs.push(`${tag}: bad walls`);
  });
  const types = (j.blocks ?? []).map((b) => b.type);
  if (!types.includes('start') && !types.includes('lapFinish')) errs.push('needs a start (or lapFinish) block');
  if (!types.includes('finish') && !types.includes('lapFinish')) errs.push('needs a finish (or lapFinish) block');
  if ((j.laps ?? 1) > 1 && !types.includes('lapFinish')) errs.push('multi-lap tracks need a lapFinish block');
  return errs;
}
