import { Vector3 } from 'three';
import { BLOCKS } from './BlockLibrary';
import { ChainStart } from './ChainLayout';
import { TrackBuilder } from './TrackBuilder';
import { BlockJson, CELL, LEVEL_H, VARIANT_WIDTH, Variant } from './TrackSchema';

/** A grid column a block passes through, with the height band (in 4 m levels) it occupies there. */
export interface CellUse {
  x: number;
  z: number;
  lo: number;
  hi: number;
}

/** Local samples of a block (relative to its anchor-cell centre, rot 0), measured once from a scratch build. */
const samples = new Map<string, Vector3[]>();

function localSamples(type: string, variant: Variant): Vector3[] {
  const key = `${type}:${variant}`;
  const hit = samples.get(key);
  if (hit) return hit;
  const def = BLOCKS[type]!;
  const width = def.fixedWidth ?? VARIANT_WIDTH[variant];
  const t = new TrackBuilder();
  t.place(new Vector3(0, 0, 0), 0);
  def.build(t, { width, surface: 'tarmac', effect: undefined, walls: 'none' });
  const pts: Vector3[] = [];
  const c = t.centerline;
  const half = Math.max(1, width / 2 - 1.5);
  // skip the samples right at the entry and exit: they sit on the shared edge with the neighbouring block
  for (let i = 1; i < c.length - 1; i++) {
    const p = c[i]!;
    const q = c[Math.min(c.length - 1, i + 1)]!;
    const r = c[Math.max(0, i - 1)]!;
    const dir = q.clone().sub(r).setY(0);
    const side = dir.lengthSq() > 1e-6 ? new Vector3(-dir.z, 0, dir.x).normalize() : new Vector3(1, 0, 0);
    for (const s of [-half, 0, half]) pts.push(p.clone().addScaledVector(side, s).add(new Vector3(0, 0, CELL / 2)));
  }
  // decorative blocks (scenery) still claim their anchor cell
  if (pts.length === 0) pts.push(new Vector3(0, 0, 0));
  samples.set(key, pts);
  return pts;
}

/** Columns a placed block covers (with its height band). */
export function blockCells(b: BlockJson): CellUse[] {
  const pts = localSamples(b.type, b.variant ?? 'std');
  const ang = (b.rot * Math.PI) / 2;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const [gx, gy, gz] = b.gridPos;
  const map = new Map<string, CellUse>();
  for (const p of pts) {
    // rotate about +Y by ang (same convention as Vector3.applyAxisAngle)
    const x = p.x * cos + p.z * sin;
    const z = -p.x * sin + p.z * cos;
    const cx = gx + Math.round(x / CELL);
    const cz = gz + Math.round(z / CELL);
    const lv = gy + p.y / LEVEL_H;
    const k = `${cx},${cz}`;
    const e = map.get(k);
    if (e) {
      e.lo = Math.min(e.lo, lv);
      e.hi = Math.max(e.hi, lv);
    } else map.set(k, { x: cx, z: cz, lo: lv, hi: lv });
  }
  return [...map.values()];
}

/** Columns flown over by a jump gap: from the ramp's exit anchor `gap` cells along its heading. */
export function gapCells(from: ChainStart, gap: number, lo: number, hi: number): CellUse[] {
  const ang = (from.rot * Math.PI) / 2;
  const hx = Math.round(-Math.sin(ang)), hz = Math.round(-Math.cos(ang));
  const out: CellUse[] = [];
  for (let i = 0; i < gap; i++) out.push({ x: from.gridPos[0] + hx * i, z: from.gridPos[2] + hz * i, lo, hi });
  return out;
}

/**
 * Which grid columns the track already uses. A new block may not come within `clearance` levels
 * (vertically) of an earlier block in the same column, nor sit right beside a much earlier block at a
 * similar height (that would let players hop between sections and skip track).
 */
export class Occupancy {
  private readonly cols = new Map<string, Array<CellUse & { idx: number }>>();
  constructor(
    readonly clearance = 2.6,
    /** Blocks this many steps back or more may not be direct neighbours at a similar height. */
    readonly neighbourGap = 5,
  ) {}

  conflicts(cells: CellUse[], idx: number): boolean {
    for (const c of cells) {
      for (const e of this.cols.get(`${c.x},${c.z}`) ?? []) {
        if (e.idx >= idx - 1) continue;
        if (c.lo < e.hi + this.clearance && c.hi > e.lo - this.clearance) return true;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        for (const e of this.cols.get(`${c.x + dx},${c.z + dz}`) ?? []) {
          if (e.idx > idx - this.neighbourGap) continue;
          if (c.lo < e.hi + 1.6 && c.hi > e.lo - 1.6) return true;
        }
      }
    }
    return false;
  }

  add(cells: CellUse[], idx: number): void {
    for (const c of cells) {
      const k = `${c.x},${c.z}`;
      let l = this.cols.get(k);
      if (!l) this.cols.set(k, (l = []));
      l.push({ ...c, idx });
    }
  }

  /** Remove everything added for blocks with index >= idx (backtracking). */
  truncate(idx: number): void {
    for (const [k, l] of this.cols) {
      const kept = l.filter((e) => e.idx < idx);
      if (kept.length) this.cols.set(k, kept);
      else this.cols.delete(k);
    }
  }
}
