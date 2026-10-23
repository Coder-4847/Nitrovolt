import { SurfaceSpec } from '../physics/Surface';
import { BLOCKS } from '../tracks/BlockLibrary';
import { ChainStart, placeItem } from '../tracks/ChainLayout';
import { blockCells } from '../tracks/Footprint';
import { WallSide } from '../tracks/TrackBuilder';
import { BlockJson, TrackJson, Variant } from '../tracks/TrackSchema';

/** What the next placed (or painted) block looks like. */
export interface Brush {
  type: string;
  variant: Variant;
  surface: SurfaceSpec;
  /** 'auto' = the block's own default (banked curves and loops have rails). */
  walls: WallSide | 'auto';
}

export type Tool = 'place' | 'paint' | 'erase' | 'pick';

const MAX_UNDO = 200;
/** Editing area: blocks must stay inside +-GRID_LIMIT cells and LEVEL_LIMIT levels. */
export const GRID_LIMIT = 120;
export const LEVEL_LIMIT = 40;
export const MAX_BLOCKS = 1500;

export const emptyLevel = (id: string, name = 'New track'): TrackJson => ({
  id,
  name,
  car: 'volt',
  theme: 'neon',
  seed: 1,
  laps: 1,
  blocks: [{ type: 'start', gridPos: [0, 0, 0], rot: 0 }],
  medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
});

/**
 * The editor's document: the level JSON being edited plus a grid cursor and a brush. Pure (no DOM, no
 * Three.js), so every editing operation is unit-tested. Every change goes through `commit`, which keeps
 * undo / redo history and notifies the view.
 */
export class EditorModel {
  json: TrackJson;
  cursor: ChainStart = { gridPos: [0, 0, -1], rot: 0 };
  brush: Brush = { type: 'straight2', variant: 'std', surface: 'tarmac', walls: 'auto' };
  tool: Tool = 'place';
  /** After placing a track piece, jump the cursor to its exit. */
  chain = true;
  /** Bumped on every change (views re-render when it moves). */
  revision = 0;
  private readonly undoStack: string[] = [];
  private readonly redoStack: string[] = [];
  onChange: () => void = () => undefined;

  constructor(json: TrackJson) {
    this.json = structuredClone(json);
    this.cursorAfterLast();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Put the cursor where the last track piece ends (start of a session / after load). */
  cursorAfterLast(): void {
    for (let i = this.json.blocks.length - 1; i >= 0; i--) {
      const b = this.json.blocks[i]!;
      if (!BLOCKS[b.type]?.chain) continue;
      try {
        this.cursor = placeItem({ gridPos: b.gridPos, rot: b.rot }, { type: b.type, variant: b.variant }).next;
      } catch {
        this.cursor = { gridPos: [...b.gridPos], rot: b.rot };
      }
      return;
    }
  }

  /** Record the current state for undo, apply `fn`, notify. */
  private commit(fn: () => void): void {
    this.undoStack.push(JSON.stringify(this.json));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    fn();
    this.changed();
  }

  private changed(): void {
    this.revision++;
    this.onChange();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.json));
    this.json = JSON.parse(prev) as TrackJson;
    this.changed();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.json));
    this.json = JSON.parse(next) as TrackJson;
    this.changed();
  }

  /** Change level settings (name, car, theme, laps) as one undoable step. */
  setMeta(patch: Partial<Pick<TrackJson, 'name' | 'car' | 'theme' | 'laps'>>): void {
    this.commit(() => Object.assign(this.json, patch));
  }

  // ---- cursor
  moveCursor(x: number, z: number): void {
    this.cursor = { gridPos: [clamp(x, GRID_LIMIT), this.cursor.gridPos[1], clamp(z, GRID_LIMIT)], rot: this.cursor.rot };
  }
  setLevel(level: number): void {
    this.cursor = { gridPos: [this.cursor.gridPos[0], clamp(level, LEVEL_LIMIT), this.cursor.gridPos[2]], rot: this.cursor.rot };
  }
  rotate(dir: 1 | -1 = 1): void {
    this.cursor = { gridPos: [...this.cursor.gridPos], rot: (((this.cursor.rot + dir) % 4) + 4) % 4 as 0 | 1 | 2 | 3 };
  }

  /** The block the brush would place at the cursor (and the anchor after it), or null if it cannot go there. */
  preview(): { block: BlockJson; next: ChainStart } | null {
    try {
      return placeItem(this.cursor, this.itemFromBrush());
    } catch {
      return null;
    }
  }

  private itemFromBrush(): { type: string; variant?: Variant; surface?: SurfaceSpec; walls?: WallSide } {
    const def = BLOCKS[this.brush.type]!;
    return {
      type: this.brush.type,
      ...(def.fixedWidth || this.brush.variant === 'std' ? {} : { variant: this.brush.variant }),
      ...(this.brush.surface === 'tarmac' ? {} : { surface: this.brush.surface }),
      ...(this.brush.walls === 'auto' ? {} : { walls: this.brush.walls }),
    };
  }

  // ---- editing
  /** Index of the block occupying a grid column, preferring the one closest to `level`. */
  blockAt(x: number, z: number, level = this.cursor.gridPos[1]): number {
    let best = -1;
    let bestD = Infinity;
    this.json.blocks.forEach((b, i) => {
      for (const c of blockCells(b)) {
        if (c.x !== x || c.z !== z) continue;
        const d = level < c.lo ? c.lo - level : level > c.hi ? level - c.hi : 0;
        if (d < bestD && d <= 3) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  }

  /** Place the brush at the cursor. Returns the new block's index or -1 when it does not fit. */
  place(): number {
    const p = this.preview();
    if (!p || this.json.blocks.length >= MAX_BLOCKS) return -1;
    // only one start / lap line: placing another moves it
    let idx = -1;
    this.commit(() => {
      if (p.block.type === 'start' || p.block.type === 'lapFinish') {
        this.json.blocks = this.json.blocks.filter((b) => b.type !== 'start' && b.type !== 'lapFinish');
      }
      // replace an identical-anchor block instead of stacking two on the same spot
      const same = this.json.blocks.findIndex((b) => b.gridPos.join() === p.block.gridPos.join() && b.rot === p.block.rot && BLOCKS[b.type]?.chain === BLOCKS[p.block.type]?.chain);
      if (same >= 0) this.json.blocks.splice(same, 1, p.block);
      else this.json.blocks.push(p.block);
      idx = same >= 0 ? same : this.json.blocks.length - 1;
      if (p.block.type === 'lapFinish' && (this.json.laps ?? 1) < 2) this.json.laps = 2;
      if (p.block.type === 'start' && (this.json.laps ?? 1) > 1) this.json.laps = 1;
      if (this.chain && BLOCKS[p.block.type]!.chain) this.cursor = p.next;
    });
    return idx;
  }

  erase(index: number): void {
    if (index < 0 || index >= this.json.blocks.length) return;
    this.commit(() => {
      const [b] = this.json.blocks.splice(index, 1);
      if (b && this.chain) this.cursor = { gridPos: [...b.gridPos], rot: b.rot };
    });
  }

  /** Apply the brush's width, surface and walls to an existing block (its type stays). */
  paint(index: number): void {
    const b = this.json.blocks[index];
    if (!b) return;
    this.commit(() => {
      const def = BLOCKS[b.type]!;
      if (!def.fixedWidth) {
        if (this.brush.variant === 'std') delete b.variant;
        else b.variant = this.brush.variant;
      }
      if (this.brush.surface === 'tarmac') delete b.surface;
      else b.surface = this.brush.surface;
      if (this.brush.walls === 'auto') delete b.walls;
      else b.walls = this.brush.walls;
    });
  }

  /** Eyedropper: copy a block into the brush and put the cursor on it. */
  pick(index: number): void {
    const b = this.json.blocks[index];
    if (!b) return;
    this.brush = { type: b.type, variant: b.variant ?? 'std', surface: b.surface ?? 'tarmac', walls: b.walls ?? 'auto' };
    this.cursor = { gridPos: [...b.gridPos], rot: b.rot };
    this.tool = 'place';
    this.changed();
  }

  /** Replace the whole document (load / import); undoable. */
  replace(json: TrackJson): void {
    this.commit(() => {
      this.json = structuredClone(json);
    });
    this.cursorAfterLast();
  }
}

const clamp = (n: number, lim: number): number => Math.max(-lim, Math.min(lim, Math.round(n)));
