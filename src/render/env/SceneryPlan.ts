import { Rng } from '../../core/Rng';
import { ARENA_INSET, fbm, terrainHeight } from '../../tracks/Terrain';
import { TerrainData } from '../../tracks/TrackTypes';
import { SceneryKit } from './Theme';

export type PropKind =
  | 'tree' | 'poplar' | 'blossom' | 'pine' | 'bush' | 'rock' | 'cactus' | 'barrel' | 'shrub' | 'tuft' | 'flowers'
  | 'mesa' | 'mountain' | 'lamp';

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
  /** Distance to the nearest road edge (m): near props cast shadows. */
  near: number;
}

/** Minimum distance from a road edge (m) per prop kind: tufts line the verge, trees stand back a little. */
export const CLEARANCE: Record<PropKind, number> = {
  tree: 8, poplar: 7, blossom: 8, pine: 6.5, bush: 3.5, rock: 4, cactus: 5, barrel: 3, shrub: 3, tuft: 1.4, flowers: 1.8,
  mesa: 60, mountain: 60, lamp: 4,
};

const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r.next() * list.length)]!;

/** Distance to the road (m) at a point, from the terrain's per-vertex record (nearest grid point). */
export function roadDistance(t: TerrainData, x: number, z: number): number {
  const i = Math.round((x - t.x0) / t.step), j = Math.round((z - t.z0) / t.step);
  if (i < 0 || j < 0 || i >= t.nx || j >= t.nz) return 255;
  // the grid stores distances at its points: the worst case inside a cell is half a diagonal closer
  return Math.max(0, t.near[j * t.nx + i]! - t.step * 0.71);
}

/** Ground slope (rise per metre) at a point. */
function slopeAt(t: TerrainData, x: number, z: number): number {
  const d = t.step;
  const hx = terrainHeight(t, x + d, z) - terrainHeight(t, x - d, z);
  const hz = terrainHeight(t, x, z + d) - terrainHeight(t, x, z - d);
  return Math.hypot(hx, hz) / (2 * d);
}

const KIT_SEED: Record<SceneryKit, number> = { forest: 11, snow: 23, desert: 37, sunset: 41, night: 53 };

/**
 * Where the scenery goes, deterministic for a (terrain, kit, density): grass tufts and flowers along the
 * verges, bushes and rocks a little further out, woods and copses (or cactus fields) framing the road, all
 * standing on the terrain; mountains or mesas far behind the stadium.
 */
export function planScenery(t: TerrainData, kit: SceneryKit, density: number, seed: number): Prop[] {
  const out: Prop[] = [];
  if (density <= 0) return out;
  const rng = new Rng((seed ^ (KIT_SEED[kit] * 2654435761)) >>> 0);
  const [bx0, bz0, bx1, bz1] = t.bounds;
  const inner = ARENA_INSET - 22;
  const box = (x: number, z: number): number => Math.max(bx0 - x, x - bx1, bz0 - z, z - bz1, 0);
  const groundAt = (x: number, z: number): number => terrainHeight(t, x, z);
  const place = (kind: PropKind, x: number, z: number, h: number, w: number, color: number, nd: number, sink = 0.25): void => {
    out.push({ kind, x, y: groundAt(x, z) - sink, z, rot: rng.range(0, Math.PI * 2), sx: w, sy: h, sz: w * rng.range(0.85, 1.15), color, near: nd });
  };
  // autumn: oranges, reds and golds instead of greens
  const greens = kit === 'sunset' ? [0xd9791f, 0xe0902a, 0xc0521c, 0xb8431a, 0xe8b030, 0xa86a22] : kit === 'night' ? [0x2f5a2c, 0x35602f, 0x2a502a] : [0x4f8a3a, 0x5b9441, 0x467a36, 0x68984a];
  const pines = kit === 'snow' ? [0x2e5a44, 0x335f48, 0x294f3e] : [0x2b5a3a, 0x30623f, 0x264f34];
  const blossoms = [0xd9541e, 0xe8a030, 0xc23a1c, 0xf0c040];
  const rocks = kit === 'desert' ? [0xa86a44, 0xbf8656, 0x9a5e3c] : kit === 'snow' ? [0x7b8594, 0x6b7280, 0x8a93a0] : [0x8a8478, 0x7a7468, 0x969084];
  const tuftCol = kit === 'desert' ? [0xb8a060, 0xa8905a, 0xc4ae70] : kit === 'snow' ? [0x8a9a7a] : kit === 'sunset' ? [0xb8a050, 0xc08a3a, 0x9a7a34] : [0x5c9a3c, 0x6aa844, 0x4e8a36];
  const flowerCol = kit === 'sunset' ? [0xd9541e, 0xe8a030, 0xb8431a, 0xf0c040] : [0xffd23a, 0xffffff, 0xf26a8c, 0x9a7aff, 0xff8a3a];

  // ---- the band inside the stadium: a jittered grid, denser near the road
  const step = 7 / Math.sqrt(Math.max(0.2, density));
  for (let x = bx0 - inner; x <= bx1 + inner; x += step) {
    for (let z = bz0 - inner; z <= bz1 + inner; z += step) {
      const px = x + rng.range(-0.5, 0.5) * step, pz = z + rng.range(-0.5, 0.5) * step;
      if (box(px, pz) > inner) continue;
      const nd = roadDistance(t, px, pz);
      if (nd < 1.2) continue;
      const roll = rng.next();
      const wood = fbm(px / 110, pz / 110, seed + 3); // woods and clearings
      const slope = slopeAt(t, px, pz);
      const pit = groundAt(px, pz) < t.base - 3;
      // near-road framing: more detail within 40 m of the road
      const framing = nd < 45 ? 1 : nd < 90 ? 0.55 : 0.3;
      switch (kit) {
        case 'forest':
        case 'sunset':
        case 'night': {
          const treeP = (wood > 0.55 ? 0.55 : wood > 0.45 ? 0.2 : 0.04) * framing;
          if (!pit && nd >= CLEARANCE.tree && roll < treeP) {
            const hgt = rng.range(9, 16);
            if (kit === 'sunset' && rng.next() < 0.5) place('blossom', px, pz, hgt * 0.75, hgt * 0.85, pick(rng, blossoms), nd);
            else if (rng.next() < 0.18) place('poplar', px, pz, hgt * 1.3, hgt * 0.32, pick(rng, greens), nd);
            else if (kit !== 'sunset' && rng.next() < 0.22) place('pine', px, pz, hgt * 1.1, hgt * 0.42, pick(rng, pines), nd);
            else place('tree', px, pz, hgt, hgt * 0.75, pick(rng, greens), nd);
          } else if (nd >= CLEARANCE.bush && roll < treeP + 0.05 * framing) {
            place('bush', px, pz, rng.range(1.2, 2.6), rng.range(1.8, 3.6), pick(rng, greens), nd, 0.3);
          } else if (nd >= CLEARANCE.rock && roll < treeP + 0.07 * framing && (slope > 0.3 || rng.next() < 0.3)) {
            const s = rng.range(1, 3.2);
            place('rock', px, pz, s * 0.7, s, pick(rng, rocks), nd, s * 0.2);
          } else if (kit === 'night' && nd >= CLEARANCE.lamp && nd < 7 && roll > 0.985) {
            place('lamp', px, pz, 11, 1, 0xffffff, nd, 0);
          }
          break;
        }
        case 'snow': {
          const treeP = (wood > 0.5 ? 0.62 : wood > 0.4 ? 0.25 : 0.06) * framing;
          if (!pit && nd >= CLEARANCE.pine && roll < treeP) {
            const hgt = rng.range(8, 18);
            place('pine', px, pz, hgt, hgt * 0.42, pick(rng, pines), nd);
          } else if (nd >= CLEARANCE.rock && roll < treeP + 0.06 * framing) {
            const s = rng.range(1.2, 3.6);
            place('rock', px, pz, s * 0.7, s, pick(rng, rocks), nd, s * 0.25);
          } else if (nd >= CLEARANCE.bush && roll < treeP + 0.09 * framing) {
            place('bush', px, pz, rng.range(0.8, 1.6), rng.range(1.4, 2.6), 0x55705a, nd, 0.3);
          }
          break;
        }
        case 'desert': {
          const fieldP = (wood > 0.5 ? 0.18 : 0.06) * framing;
          if (!pit && nd >= CLEARANCE.cactus && roll < fieldP) {
            const hgt = rng.range(4, 9);
            place('cactus', px, pz, hgt, hgt * 0.17, pick(rng, [0x4c7a3a, 0x557f40, 0x46703a]), nd, 0.1);
          } else if (nd >= CLEARANCE.barrel && roll < fieldP + 0.05 * framing) {
            place('barrel', px, pz, rng.range(0.6, 1.2), rng.range(0.7, 1.2), pick(rng, [0x5a8a44, 0x4e7c3c]), nd, 0.05);
          } else if (nd >= CLEARANCE.shrub && roll < fieldP + 0.12 * framing) {
            place('shrub', px, pz, rng.range(0.8, 1.6), rng.range(1.4, 2.8), pick(rng, [0x8a8a4a, 0x7a7444, 0x9a8a54]), nd, 0.2);
          } else if (nd >= CLEARANCE.rock && roll < fieldP + 0.18 * framing) {
            const s = rng.range(1.2, 4.5);
            place('rock', px, pz, s * 0.75, s, pick(rng, rocks), nd, s * 0.2);
          }
          break;
        }
      }
    }
  }

  // ---- verge detail: grass tufts and flowers right beside the road
  if (kit !== 'snow') {
    const vstep = 2.6 / Math.sqrt(Math.max(0.2, density));
    for (let x = bx0 - 40; x <= bx1 + 40; x += vstep) {
      for (let z = bz0 - 40; z <= bz1 + 40; z += vstep) {
        const px = x + rng.range(-0.5, 0.5) * vstep, pz = z + rng.range(-0.5, 0.5) * vstep;
        const nd = roadDistance(t, px, pz);
        if (nd < CLEARANCE.tuft || nd > 14) continue;
        const k = 1 - nd / 14;
        const roll = rng.next();
        if (roll > 0.55 * k + 0.08) continue;
        if (kit !== 'desert' && nd > CLEARANCE.flowers && rng.next() < 0.12) place('flowers', px, pz, rng.range(0.35, 0.6), rng.range(0.6, 1.1), pick(rng, flowerCol), nd, 0.05);
        else place('tuft', px, pz, rng.range(0.4, 0.9), rng.range(0.6, 1.2), pick(rng, tuftCol), nd, 0.05);
      }
    }
  }

  // ---- far landscape behind the stadium
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const half = Math.max(bx1 - bx0, bz1 - bz0) / 2;
  if (kit === 'snow' || kit === 'desert') {
    const n = Math.round(30 * Math.max(0.5, density));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.05, 0.05);
      const r = half + ARENA_INSET + 260 + rng.range(0, 320);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (box(x, z) < ARENA_INSET + 120) continue;
      if (kit === 'snow') out.push({ kind: 'mountain', x, y: t.base - 2, z, rot: rng.range(0, 6.28), sx: rng.range(200, 360), sy: rng.range(160, 320), sz: rng.range(200, 360), color: 0x5a6578, near: 999 });
      else out.push({ kind: 'mesa', x, y: t.base - 2, z, rot: rng.range(0, 6.28), sx: rng.range(90, 200), sy: rng.range(60, 150), sz: rng.range(80, 180), color: pick(rng, [0xb4643c, 0xa65a36, 0xc8784a]), near: 999 });
    }
  }
  // tree belt beyond the stands
  if (kit !== 'desert') {
    const n = Math.round(160 * density);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = half + ARENA_INSET + rng.range(70, 150);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (box(x, z) < ARENA_INSET + 55) continue;
      const hgt = rng.range(12, 22);
      const y = t.base - 0.3;
      if (kit === 'snow') out.push({ kind: 'pine', x, y, z, rot: rng.range(0, 6.28), sx: hgt * 0.42, sy: hgt, sz: hgt * 0.42, color: pick(rng, pines), near: 999 });
      else out.push({ kind: 'tree', x, y, z, rot: rng.range(0, 6.28), sx: hgt * 0.75, sy: hgt, sz: hgt * 0.75, color: pick(rng, greens), near: 999 });
    }
  }
  return out;
}
