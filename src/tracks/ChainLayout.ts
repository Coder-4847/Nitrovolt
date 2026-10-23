import { Vector3 } from 'three';
import { BLOCKS } from './BlockLibrary';
import { TrackBuilder } from './TrackBuilder';
import { BlockJson, CELL, LEVEL_H, VARIANT_WIDTH, Variant } from './TrackSchema';
import { blockEntry } from './TrackGenerator';

export interface BlockExit {
  /** Exit point relative to the block's entry point, in the block's own frame (rot 0: +x right, -z forward). */
  dx: number;
  dy: number;
  dz: number;
  /** Heading change in degrees (+ = left). */
  dyawDeg: number;
  /** Pitch of the exit tangent in degrees (non-zero for jump ramps). */
  pitchDeg: number;
}

const cache = new Map<string, BlockExit>();

/** Exit pose of a block, measured by building it once in a scratch builder. */
export function blockExit(type: string, variant: Variant = 'std'): BlockExit {
  const key = `${type}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = BLOCKS[type];
  if (!def) throw new Error(`unknown block ${type}`);
  const t = new TrackBuilder();
  t.place(new Vector3(0, 0, 0), 0);
  def.build(t, { width: def.fixedWidth ?? VARIANT_WIDTH[variant], surface: 'tarmac', effect: undefined, walls: 'none' });
  const yaw = (Math.atan2(-t.f.x, -t.f.z) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, t.f.y))) * 180) / Math.PI;
  // a jump ramp's lip sits below the grid level above it; that level is its nominal exit
  const lip = def.category === 'jump' && pitch > 1;
  const e: BlockExit = {
    dx: t.p.x,
    dy: lip ? Math.ceil(t.p.y / LEVEL_H - 1e-6) * LEVEL_H : t.p.y,
    dz: t.p.z,
    dyawDeg: def.chain ? yaw : 0,
    pitchDeg: (Math.asin(Math.max(-1, Math.min(1, t.f.y))) * 180) / Math.PI,
  };
  cache.set(key, e);
  return e;
}

export interface ChainItem {
  type: string;
  variant?: Variant;
  surface?: BlockJson['surface'];
  walls?: BlockJson['walls'];
  /** Empty cells to skip before this block (jump gaps). */
  gap?: number;
  /** Whole levels (4 m) to rise before placing this block. */
  dy?: number;
}

export interface ChainStart {
  gridPos: [number, number, number];
  rot: 0 | 1 | 2 | 3;
}

export interface ChainResult {
  blocks: BlockJson[];
  /** Anchor the *next* block would take; equals the first block's anchor for a closed circuit. */
  next: ChainStart;
}

const mod4 = (n: number): 0 | 1 | 2 | 3 => (((n % 4) + 4) % 4) as 0 | 1 | 2 | 3;

/**
 * Place one chain item at `anchor`: returns the block and the anchor the next block takes.
 * Throws if the block's exit is off the grid.
 */
export function placeItem(anchor: ChainStart, item: ChainItem, index = 0): { block: BlockJson; next: ChainStart } {
  const def = BLOCKS[item.type];
  if (!def) throw new Error(`unknown block ${item.type}`);
  const [gx, gy, gz] = anchor.gridPos;
  // apply gap / dy by moving the anchor before placing
  const heading = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), (anchor.rot * Math.PI) / 2);
  const gx2 = gx + Math.round(heading.x) * (item.gap ?? 0);
  const gz2 = gz + Math.round(heading.z) * (item.gap ?? 0);
  const gy2 = gy + (item.dy ?? 0);
  const block: BlockJson = { type: item.type, gridPos: [gx2, gy2, gz2], rot: anchor.rot };
  if (item.variant) block.variant = item.variant;
  if (item.surface) block.surface = item.surface;
  if (item.walls) block.walls = item.walls;
  // scenery does not move the cursor
  if (!def.chain) return { block, next: { gridPos: [gx, gy, gz], rot: anchor.rot } };
  const ex = blockExit(item.type, item.variant ?? 'std');
  const { position: entry } = blockEntry(block);
  const rotRad = (block.rot * Math.PI) / 2;
  const off = new Vector3(ex.dx, ex.dy, ex.dz).applyAxisAngle(new Vector3(0, 1, 0), rotRad);
  const exitWorld = entry.clone().add(off);
  const newRot = mod4(block.rot + Math.round(ex.dyawDeg / 90));
  const dir = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), (newRot * Math.PI) / 2);
  const next = exitWorld.clone().addScaledVector(dir, CELL / 2);
  const cx = next.x / CELL, cz = next.z / CELL, cy = next.y / LEVEL_H;
  if (Math.abs(cx - Math.round(cx)) > 0.02 || Math.abs(cz - Math.round(cz)) > 0.02 || Math.abs(cy - Math.round(cy)) > 0.02) {
    throw new Error(`block ${index} (${item.type}) exits off-grid: cell (${cx.toFixed(3)}, ${cy.toFixed(3)}, ${cz.toFixed(3)})`);
  }
  return { block, next: { gridPos: [Math.round(cx), Math.round(cy), Math.round(cz)], rot: newRot } };
}

/**
 * Place blocks end-to-end: each block's anchor cell is found from the previous block's measured exit,
 * so authors (and the level generator) only list block types. Throws if an exit is off the grid.
 */
export function layoutChain(items: ChainItem[], start: ChainStart = { gridPos: [0, 0, 0], rot: 0 }): ChainResult {
  const blocks: BlockJson[] = [];
  let anchor: ChainStart = { gridPos: [...start.gridPos], rot: start.rot };
  for (const [i, item] of items.entries()) {
    const r = placeItem(anchor, item, i);
    blocks.push(r.block);
    anchor = r.next;
  }
  return { blocks, next: anchor };
}
