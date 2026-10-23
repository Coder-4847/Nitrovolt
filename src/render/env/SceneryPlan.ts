import { Rng } from '../../core/Rng';
import { SceneryKit } from './Theme';

export type PropKind =
  | 'building' | 'tower' | 'skyscraper' | 'roofUnit' | 'tree'
  | 'pine' | 'rock' | 'mountain' | 'cabin'
  | 'mesa' | 'cactus'
  | 'pad' | 'container' | 'crane' | 'turbine' | 'chimney'
  | 'stand' | 'lightTower';

/** One scenery instance: position of its base centre, yaw, size (m) and colour. */
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
}

export interface SceneryInput {
  /** Driving line (x, y, z). */
  centerline: ReadonlyArray<{ x: number; y: number; z: number }>;
  seed: number;
  /** Height of the ground plane under the track. */
  groundY: number;
}

/** Nothing (except far silhouettes) is placed closer than this to the driving line, in plan view. */
export const CLEARANCE = 20;
/** Tall props keep more room so they never loom over the road. */
export const CLEARANCE_TALL = 30;

/** Uniform-grid index over the centerline (XZ) for fast nearest-distance queries. */
class LineIndex {
  private readonly cells = new Map<string, Array<[number, number]>>();
  constructor(points: ReadonlyArray<{ x: number; z: number }>, private readonly size = 32) {
    for (const p of points) {
      const k = `${Math.floor(p.x / size)},${Math.floor(p.z / size)}`;
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push([p.x, p.z]);
    }
  }
  /** Distance to the nearest centerline point, capped at `max`. */
  distance(x: number, z: number, max: number): number {
    const r = Math.ceil(max / this.size);
    const cx = Math.floor(x / this.size), cz = Math.floor(z / this.size);
    let best = max * max;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const c = this.cells.get(`${cx + i},${cz + j}`);
        if (!c) continue;
        for (const [px, pz] of c) {
          const d = (px - x) ** 2 + (pz - z) ** 2;
          if (d < best) best = d;
        }
      }
    }
    return Math.sqrt(best);
  }
  /** Direction (yaw) from (x, z) toward the nearest centerline point within `max`. */
  nearestYaw(x: number, z: number, max: number): number {
    const r = Math.ceil(max / this.size);
    const cx = Math.floor(x / this.size), cz = Math.floor(z / this.size);
    let best = Infinity, bx = x, bz = z - 1;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        for (const [px, pz] of this.cells.get(`${cx + i},${cz + j}`) ?? []) {
          const d = (px - x) ** 2 + (pz - z) ** 2;
          if (d < best) { best = d; bx = px; bz = pz; }
        }
      }
    }
    return Math.atan2(bx - x, bz - z);
  }
}

const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r.next() * list.length)]!;

/** Smooth 2D value noise in [0, 1] from a seed (clumps forests, districts). */
function valueNoise(seed: number): (x: number, z: number) => number {
  const h = (i: number, j: number): number => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z);
    const fx = x - i, fz = z - j;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/**
 * Where the scenery goes. Deterministic for a (track, kit, density), never inside the clearance corridor
 * around the driving line, denser near the track and taller further away, plus a ring of far silhouettes.
 */
export function planScenery(input: SceneryInput, kit: SceneryKit, density: number): Prop[] {
  const pts = input.centerline;
  const out: Prop[] = [];
  if (pts.length < 2 || density <= 0) return out;
  const kitSeed = [...kit].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const rng = new Rng((input.seed ^ kitSeed) >>> 0);
  const noise = valueNoise((input.seed ^ 0x5bd1e995) | 0);
  const idx = new LineIndex(pts);
  const gy = input.groundY;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2;

  const spacing: Record<SceneryKit, number> = { stadium: 48, city: 30, alpine: 13, desert: 34, coast: 26 };
  const margin: Record<SceneryKit, number> = { stadium: 120, city: 230, alpine: 200, desert: 260, coast: 200 };
  const step = spacing[kit] / Math.sqrt(Math.max(0.15, density));
  const cap = Math.round(2600 * density);
  const m = margin[kit];

  const add = (p: Prop): void => {
    if (out.length < cap * 1.4) out.push(p);
  };

  // ---- near field: jittered grid around the track
  let near = 0;
  for (let x = minX - m; x <= maxX + m; x += step) {
    for (let z = minZ - m; z <= maxZ + m; z += step) {
      if (near >= cap) break;
      const px = x + rng.range(-0.45, 0.45) * step;
      const pz = z + rng.range(-0.45, 0.45) * step;
      const roll = rng.next();
      const d = idx.distance(px, pz, m + 40);
      if (d < CLEARANCE) continue;
      const far01 = Math.min(1, (d - CLEARANCE) / m);
      const n = noise(px / 90, pz / 90);
      near++;
      switch (kit) {
        case 'city': {
          if (d < CLEARANCE_TALL) {
            // street trees fill the band right next to the road
            if (roll < 0.4) {
              const th = rng.range(7, 12);
              add({ kind: 'tree', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: th * 0.6, sy: th, sz: th * 0.6, color: pick(rng, [0x4f7a3a, 0x5b8441, 0x46703a, 0x648a48]) });
            }
            break;
          }
          if (roll > 0.86) {
            // a small park: a cluster of trees
            for (let k = 0; k < 4; k++) {
              const th = rng.range(8, 14);
              add({ kind: 'tree', x: px + rng.range(-8, 8), y: gy, z: pz + rng.range(-8, 8), rot: rng.range(0, 6.28), sx: th * 0.6, sy: th, sz: th * 0.6, color: pick(rng, [0x4f7a3a, 0x5b8441, 0x46703a]) });
            }
            break;
          }
          const w = rng.range(14, 24), dd = rng.range(14, 24);
          const h = rng.range(16, 34) + far01 * rng.range(30, 110) * (0.5 + n);
          const rot = Math.round(rng.range(0, 4)) * (Math.PI / 2) + rng.range(-0.04, 0.04);
          const glass = h > 60 || rng.next() < 0.3;
          if (glass) add({ kind: 'tower', x: px, y: gy, z: pz, rot, sx: w, sy: h, sz: dd, color: pick(rng, [0x66737f, 0x56636f, 0x7b868f, 0x5e6d7b, 0x8a949b, 0x4d5a66]) });
          else add({ kind: 'building', x: px, y: gy, z: pz, rot, sx: w, sy: h, sz: dd, color: pick(rng, [0xc9c3b8, 0xb9b4ab, 0xd6d2ca, 0xa9a49c, 0xbfc3c6, 0x9fa4a8]) });
          // rooftop plant room
          if (!glass || rng.next() < 0.5) {
            const c = Math.cos(rot), sn = Math.sin(rot);
            const ox = rng.range(-0.2, 0.2) * w, oz = rng.range(-0.2, 0.2) * dd;
            add({ kind: 'roofUnit', x: px + ox * c + oz * sn, y: gy + h, z: pz - ox * sn + oz * c, rot, sx: w * rng.range(0.25, 0.45), sy: rng.range(1.8, 3.6), sz: dd * rng.range(0.25, 0.45), color: 0x9a9ea3 });
          }
          break;
        }
        case 'alpine': {
          const forest = n > 0.42;
          if (roll < (forest ? 0.78 : 0.16)) {
            const h = rng.range(7, 17) * (0.8 + far01 * 0.4);
            add({ kind: 'pine', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: h * 0.42, sy: h, sz: h * 0.42, color: pick(rng, [0x1f4a34, 0x24503a, 0x1a4030, 0x2b5a40]) });
          } else if (roll < (forest ? 0.84 : 0.24)) {
            const s = rng.range(2, 7) * (1 + far01);
            add({ kind: 'rock', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: s, sy: s * rng.range(0.5, 0.9), sz: s * rng.range(0.7, 1.2), color: pick(rng, [0x6b7280, 0x7b8594, 0x5c6470]) });
          } else if (!forest && roll < 0.255 && d > CLEARANCE_TALL) {
            add({ kind: 'cabin', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: 7, sy: 5, sz: 9, color: 0x6a4a32 });
          }
          break;
        }
        case 'desert': {
          if (roll < 0.1 && d > CLEARANCE_TALL + 10) {
            const r = rng.range(16, 40) * (0.7 + far01);
            add({ kind: 'mesa', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: r, sy: rng.range(18, 55) * (0.6 + far01 * 0.8), sz: r * rng.range(0.7, 1.1), color: pick(rng, [0xb4643c, 0xc0784a, 0xa65a36]) });
          } else if (roll < 0.36) {
            const s = rng.range(1.5, 6) * (1 + far01 * 0.6);
            add({ kind: 'rock', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: s, sy: s * 0.7, sz: s, color: pick(rng, [0xa86a44, 0xbf8656, 0x9a5c3a]) });
          } else if (roll < 0.52) {
            const h = rng.range(3, 7.5);
            add({ kind: 'cactus', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: h * 0.16, sy: h, sz: h * 0.16, color: 0x4a7a3a });
          }
          break;
        }
        case 'coast': {
          if (roll < 0.16 && n > 0.45) {
            // a quay with a container yard on it
            const pw = rng.range(40, 70), pd = rng.range(30, 50);
            const rot = Math.round(rng.range(0, 4)) * (Math.PI / 2);
            if (idx.distance(px, pz, m + 60) < CLEARANCE + Math.hypot(pw, pd) / 2) break;
            add({ kind: 'pad', x: px, y: gy, z: pz, rot, sx: pw, sy: 1.4, sz: pd, color: 0x8a8c90 });
            const c = Math.cos(rot), s = Math.sin(rot);
            const rows = Math.floor(pw / 7), cols = Math.floor(pd / 3.2);
            for (let i = 0; i < rows; i++) {
              for (let j = 0; j < cols; j++) {
                if (rng.next() < 0.35) continue;
                const lx = -pw / 2 + 4 + i * 7, lz = -pd / 2 + 2 + j * 3.2;
                const stack = 1 + Math.floor(rng.next() * 3);
                for (let k = 0; k < stack; k++) {
                  add({ kind: 'container', x: px + lx * c + lz * s, y: gy + 1.4 + k * 2.6, z: pz - lx * s + lz * c, rot, sx: 6, sy: 2.6, sz: 2.5, color: pick(rng, [0xc8382e, 0x2f6bb0, 0x2e8a5a, 0xe0a82e, 0x5a6e8a, 0xd0d0d0, 0xe06a1e]) });
                }
              }
            }
            if (rng.next() < 0.6) add({ kind: 'crane', x: px + (pw / 2 - 6) * c, y: gy + 1.4, z: pz - (pw / 2 - 6) * s, rot: rot + Math.PI / 2, sx: 1, sy: rng.range(34, 46), sz: 1, color: 0xffd21f });
          } else if (roll < 0.2 && d > CLEARANCE_TALL + 20) {
            add({ kind: 'turbine', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: 1, sy: rng.range(48, 64), sz: 1, color: 0xf0f2f4 });
          }
          break;
        }
        case 'stadium': {
          if (d < CLEARANCE_TALL) break;
          if (roll < 0.12) add({ kind: 'stand', x: px, y: gy, z: pz, rot: idx.nearestYaw(px, pz, 120), sx: rng.range(30, 50), sy: rng.range(10, 16), sz: 14, color: pick(rng, [0x8d949c, 0x9aa1a8, 0x7f868e]) });
          else if (roll < 0.18) add({ kind: 'lightTower', x: px, y: gy, z: pz, rot: idx.nearestYaw(px, pz, 120), sx: 1, sy: rng.range(30, 40), sz: 1, color: 0xcfd6e0 });
          else if (roll < 0.34) {
            const th = rng.range(8, 13);
            add({ kind: 'tree', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: th * 0.6, sy: th, sz: th * 0.6, color: pick(rng, [0x4f7a3a, 0x5b8441, 0x46703a]) });
          }
          break;
        }
      }
    }
  }

  // ---- far silhouettes on a ring around the whole level
  const ringR = Math.max(radius + 380, 650);
  const ringCount = Math.round((kit === 'city' ? 60 : kit === 'alpine' ? 34 : kit === 'desert' ? 30 : kit === 'coast' ? 22 : 0) * Math.max(0.5, density));
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const r = ringR + rng.range(0, 260);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    switch (kit) {
      case 'city': {
        const w = rng.range(20, 40);
        const h = rng.range(90, 300);
        add({ kind: 'skyscraper', x, y: gy, z, rot: rng.range(0, 1.57), sx: w, sy: h, sz: w * rng.range(0.7, 1.2), color: pick(rng, [0x66737f, 0x56636f, 0x7b868f, 0x8a949b]) });
        break;
      }
      case 'alpine':
        add({ kind: 'mountain', x, y: gy, z, rot: rng.range(0, 6.28), sx: rng.range(150, 280), sy: rng.range(170, 360), sz: rng.range(150, 280), color: 0x5a6578 });
        break;
      case 'desert':
        add({ kind: 'mesa', x, y: gy, z, rot: rng.range(0, 6.28), sx: rng.range(70, 160), sy: rng.range(60, 150), sz: rng.range(60, 140), color: pick(rng, [0xb4643c, 0xa65a36, 0xc8784a]) });
        break;
      case 'coast':
        if (rng.next() < 0.5) add({ kind: 'chimney', x, y: gy, z, rot: 0, sx: rng.range(8, 14), sy: rng.range(80, 140), sz: 1, color: 0x8a8c90 });
        else add({ kind: 'turbine', x, y: gy, z, rot: rng.range(0, 6.28), sx: 1, sy: rng.range(60, 80), sz: 1, color: 0xf0f2f4 });
        break;
      default:
    }
  }
  return out;
}

export { LineIndex };
