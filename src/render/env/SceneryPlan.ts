import { Rng } from '../../core/Rng';
import { SceneryKit } from './Theme';

export type PropKind = 'tree' | 'pine' | 'rock' | 'mountain' | 'mesa' | 'cactus' | 'terrace' | 'hill';

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

/** Distance (m) outside the track's bounding box where the arena's grandstands stand; props keep clear of it. */
export const ARENA_BAND: [number, number] = [34, 100];

/**
 * Where the scenery goes. Deterministic for a (track, kit, density), never inside the clearance corridor
 * around the driving line and never in the arena's grandstand band: small props (trees, rocks, cacti)
 * between the track and the stands, big ones (hills, terraces, mountains, mesas) outside them.
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
  /** How far outside the track's bounding box a point is (0 inside). */
  const outside = (x: number, z: number): number => Math.max(minX - x, x - maxX, minZ - z, z - maxZ, 0);

  const step = (kit === 'winter' ? 14 : kit === 'canyon' ? 22 : 20) / Math.sqrt(Math.max(0.15, density));
  const cap = Math.round(2400 * density);
  const m = ARENA_BAND[0];
  const add = (p: Prop): void => {
    if (out.length < cap * 1.4) out.push(p);
  };
  const greens = [0x4f7a3a, 0x5b8441, 0x46703a, 0x648a48];
  const pines = kit === 'winter' ? [0x2e5a44, 0x335f48, 0x294f3e] : [0x2b5a3a, 0x30623f, 0x264f34];

  // ---- inside the arena: a jittered grid between the track and the stands
  let near = 0;
  for (let x = minX - m; x <= maxX + m; x += step) {
    for (let z = minZ - m; z <= maxZ + m; z += step) {
      if (near >= cap) break;
      const px = x + rng.range(-0.45, 0.45) * step;
      const pz = z + rng.range(-0.45, 0.45) * step;
      const roll = rng.next();
      if (outside(px, pz) >= ARENA_BAND[0] - 4) continue;
      const d = idx.distance(px, pz, 80);
      if (d < CLEARANCE) continue;
      const n = noise(px / 80, pz / 80);
      near++;
      switch (kit) {
        case 'stadium':
        case 'sunset': {
          if (n > 0.55 && roll < 0.5) {
            const th = rng.range(7, 12);
            add({ kind: 'tree', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: th * 0.62, sy: th, sz: th * 0.62, color: pick(rng, greens) });
          }
          break;
        }
        case 'winter': {
          if (roll < (n > 0.4 ? 0.7 : 0.18)) {
            const h = rng.range(8, 16);
            add({ kind: 'pine', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: h * 0.4, sy: h, sz: h * 0.4, color: pick(rng, pines) });
          } else if (roll < 0.78) {
            const sz = rng.range(2, 5);
            add({ kind: 'rock', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: sz, sy: sz * 0.6, sz: sz, color: pick(rng, [0x7b8594, 0x6b7280]) });
          }
          break;
        }
        case 'canyon': {
          const r = rng.range(18, 34);
          if (d > CLEARANCE + r * 0.56 + 2 && roll < 0.14) {
            add({ kind: 'terrace', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: r, sy: rng.range(6, 14), sz: r * rng.range(0.7, 1.1), color: pick(rng, [0xc89a6a, 0xbd8d5e, 0xd0a474]) });
          } else if (roll < 0.34 && n > 0.45) {
            const h = rng.range(9, 15);
            add({ kind: 'pine', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: h * 0.38, sy: h, sz: h * 0.38, color: pick(rng, pines) });
          } else if (roll < 0.46) {
            const h = rng.range(3, 6.5);
            add({ kind: 'cactus', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: h * 0.16, sy: h, sz: h * 0.16, color: 0x4a7a3a });
          } else if (roll < 0.56) {
            const sz = rng.range(1.5, 5);
            add({ kind: 'rock', x: px, y: gy, z: pz, rot: rng.range(0, 6.28), sx: sz, sy: sz * 0.7, sz: sz, color: pick(rng, [0xa86a44, 0xbf8656]) });
          }
          break;
        }
      }
    }
  }

  // ---- outside the arena: a ring of big landscape forms
  const ringR = Math.max(radius + ARENA_BAND[1] + 140, 420);
  const ringCount = Math.round((kit === 'winter' ? 34 : kit === 'canyon' ? 32 : 26) * Math.max(0.5, density));
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const r = ringR + rng.range(0, 240);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (outside(x, z) < ARENA_BAND[1] + 20) continue;
    switch (kit) {
      case 'winter':
        add({ kind: 'mountain', x, y: gy, z, rot: rng.range(0, 6.28), sx: rng.range(150, 280), sy: rng.range(170, 340), sz: rng.range(150, 280), color: 0x5a6578 });
        break;
      case 'canyon':
        add({ kind: 'mesa', x, y: gy, z, rot: rng.range(0, 6.28), sx: rng.range(70, 160), sy: rng.range(50, 130), sz: rng.range(60, 140), color: pick(rng, [0xb4643c, 0xa65a36, 0xc8784a]) });
        break;
      default:
        add({ kind: 'hill', x, y: gy, z, rot: rng.range(0, 6.28), sx: rng.range(140, 260), sy: rng.range(30, 70), sz: rng.range(120, 220), color: pick(rng, kit === 'sunset' ? [0x3c5a34, 0x46643a] : [0x4c7a3e, 0x5a8646]) });
    }
  }
  // a belt of trees just outside the stands
  if (kit !== 'canyon') {
    const belt = Math.round(90 * density);
    for (let i = 0; i < belt; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.max(maxX - minX, maxZ - minZ) / 2 + ARENA_BAND[1] + rng.range(20, 80);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (outside(x, z) < ARENA_BAND[1] + 6) continue;
      const h = rng.range(10, 18);
      if (kit === 'winter') add({ kind: 'pine', x, y: gy, z, rot: rng.range(0, 6.28), sx: h * 0.4, sy: h, sz: h * 0.4, color: pick(rng, pines) });
      else add({ kind: 'tree', x, y: gy, z, rot: rng.range(0, 6.28), sx: h * 0.62, sy: h, sz: h * 0.62, color: pick(rng, greens) });
    }
  }
  return out;
}

export { LineIndex };
