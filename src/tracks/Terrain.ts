import { Vector3 } from 'three';
import { SurfaceId } from '../physics/Surface';
import { RoadSample, TerrainData } from './TrackTypes';

/** How the landscape around a track is shaped (per environment). */
export interface TerrainStyle {
  surface: SurfaceId;
  /** Height of the rolling hills away from the track (m). */
  hills: number;
  /** Size of the hill features (m). */
  hillScale: number;
  /** Small undulations close to the road (m). */
  bumps: number;
}

export const TERRAIN_STYLES: Record<string, TerrainStyle> = {
  grass: { surface: 'grass', hills: 16, hillScale: 220, bumps: 0.8 },
  snow: { surface: 'snow', hills: 26, hillScale: 260, bumps: 1.2 },
  sand: { surface: 'sand', hills: 12, hillScale: 160, bumps: 1.6 },
};

/** Landscape style for a level theme (snowy themes get snow, desert ones sand, the rest grass). */
export function terrainStyleFor(theme: string): TerrainStyle {
  if (/snow|winter|alpine/.test(theme)) return TERRAIN_STYLES.snow!;
  if (/desert|canyon|sand/.test(theme)) return TERRAIN_STYLES.sand!;
  return TERRAIN_STYLES.grass!;
}

/** Road surface sits this far above the flat ground (a low kerb). */
const KERB = 0.15;
/** Flat verge beside the road before the ground starts to fall or rise (m). */
const SHOULDER = 2.5;
/** Steepest cut slope the ground may climb away from a road (rise per metre). */
const CUT = 1.1;
/** Embankment slope down from a raised road (drop per metre). */
const FILL = 0.62;
/** Embankments carry a road at most this high above the ground; above it the road stands on pillars. */
const EMBANK_MAX = 10;
/** A jump gap leaves a ravine this deep below its lower edge. */
const PIT = 14;
/** Distance from the road over which road constraints are evaluated (m). */
const REACH = 30;
/** Margin of landscape around the track's bounding box (m). */
export const TERRAIN_MARGIN = 300;
/** The stadium's stands start this far outside the track's bounding box; the ground is flat there. */
export const ARENA_INSET = 210;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Fractal noise in [0, 1). */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

interface Seg {
  ax: number; az: number; ay: number;
  bx: number; bz: number; by: number;
  /** Banked right vectors (y component) and their horizontal lengths at both ends. */
  ary: number; bry: number; arh: number; brh: number;
  ahw: number; bhw: number;
  /** Upright road (not the top of a loop). */
  upright: boolean;
  kind: 'road' | 'gap' | 'special';
}

/**
 * Build the landscape for a track: flat ground at the level of the lowest road, verges beside every road,
 * embankments under raised road, ravines under jump gaps, and rolling hills further out. Deterministic
 * (pure maths on the centerline), so the physics and the renderer always agree.
 */
export function buildTerrain(centerline: readonly Vector3[], frames: readonly RoadSample[], style: TerrainStyle, seed: number): TerrainData {
  // ---- segments
  const segs: Seg[] = [];
  let base = Infinity;
  for (let i = 0; i < centerline.length; i++) if (frames[i]!.kind === 'road' && frames[i]!.u.y > 0.5) base = Math.min(base, centerline[i]!.y);
  if (!isFinite(base)) base = 0;
  for (let i = 0; i + 1 < centerline.length; i++) {
    const a = centerline[i]!, b = centerline[i + 1]!;
    const fa = frames[i]!, fb = frames[i + 1]!;
    const gap = fb.kind === 'gap';
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (!gap && len > 20) continue; // a discontinuity between blocks that do not connect
    if (len < 1e-4 && !gap) continue;
    const kind = gap ? 'gap' : fa.kind === 'special' || fb.kind === 'special' ? 'special' : 'road';
    segs.push({
      ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y,
      ary: fa.r.y, bry: fb.r.y, arh: Math.hypot(fa.r.x, fa.r.z), brh: Math.hypot(fb.r.x, fb.r.z),
      ahw: gap ? fb.hw || frames[i]!.hw : fa.hw, bhw: gap ? fb.hw || fa.hw : fb.hw,
      upright: fa.u.y > 0.3 && fb.u.y > 0.3,
      kind,
    });
  }
  // gap segments take the road width of their neighbours
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.kind !== 'gap') continue;
    const w = Math.max(segs[i - 1]?.bhw ?? 0, segs[i + 1]?.ahw ?? 0, 12);
    s.ahw = s.bhw = w;
  }

  // ---- grid
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of centerline) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  if (!isFinite(minX)) { minX = maxX = minZ = maxZ = 0; }
  const span = Math.max(maxX - minX, maxZ - minZ) + TERRAIN_MARGIN * 2;
  const step = span > 2400 ? 8 : span > 1600 ? 6 : 4;
  const x0 = Math.floor((minX - TERRAIN_MARGIN) / step) * step;
  const z0 = Math.floor((minZ - TERRAIN_MARGIN) / step) * step;
  const nx = Math.ceil((maxX + TERRAIN_MARGIN - x0) / step) + 1;
  const nz = Math.ceil((maxZ + TERRAIN_MARGIN - z0) / step) + 1;

  // ---- spatial hash of segments (16 m buckets, each segment in every bucket its reach touches)
  const B = 16;
  const buckets = new Map<number, number[]>();
  const key = (bx: number, bz: number): number => (bx + 4096) * 8192 + (bz + 4096);
  segs.forEach((s, idx) => {
    const r = Math.max(s.ahw, s.bhw) + REACH;
    const bx0 = Math.floor((Math.min(s.ax, s.bx) - r) / B), bx1 = Math.floor((Math.max(s.ax, s.bx) + r) / B);
    const bz0 = Math.floor((Math.min(s.az, s.bz) - r) / B), bz1 = Math.floor((Math.max(s.az, s.bz) + r) / B);
    for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++) {
      const k = key(bx, bz);
      let l = buckets.get(k);
      if (!l) buckets.set(k, (l = []));
      l.push(idx);
    }
  });

  // ---- coarse distance to the track (for where the hills start)
  const C = 24;
  const cnx = Math.ceil((nx * step) / C) + 2, cnz = Math.ceil((nz * step) / C) + 2;
  const coarse = new Float32Array(cnx * cnz);
  const pts: number[] = [];
  for (let i = 0; i < centerline.length; i += 3) pts.push(centerline[i]!.x, centerline[i]!.z);
  for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) {
    const x = x0 + i * C, z = z0 + j * C;
    let best = Infinity;
    for (let k = 0; k < pts.length; k += 2) {
      const dx = pts[k]! - x, dz = pts[k + 1]! - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    coarse[j * cnx + i] = Math.sqrt(best);
  }
  const distAt = (x: number, z: number): number => {
    const fx = (x - x0) / C, fz = (z - z0) / C;
    const i = Math.min(cnx - 2, Math.max(0, Math.floor(fx))), j = Math.min(cnz - 2, Math.max(0, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const a = coarse[j * cnx + i]!, b = coarse[j * cnx + i + 1]!, c = coarse[(j + 1) * cnx + i]!, d = coarse[(j + 1) * cnx + i + 1]!;
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };

  const ground = base - KERB;
  const heights = new Float32Array(nx * nz);
  const near = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * step;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * step;
      // ---- baseline: flat stadium floor near the track, rolling hills further out
      const d = distAt(x, z);
      const hill = style.hills * Math.pow(fbm(x / style.hillScale, z / style.hillScale, seed), 1.6) * 1.8;
      const bump = style.bumps * (fbm(x / 23, z / 23, seed + 5) - 0.5) * 2 * smooth(10, 40, d);
      const box = Math.max(minX - x, x - maxX, minZ - z, z - maxZ, 0);
      const envelope = smooth(60, 200, d) * (1 - smooth(ARENA_INSET - 80, ARENA_INSET - 15, box));
      let H = ground + bump + hill * envelope;
      // ---- road constraints
      let upper = Infinity;
      let lower = -Infinity;
      let nearest = Math.max(REACH, d - 12);
      const list = buckets.get(key(Math.floor(x / B), Math.floor(z / B)));
      if (list) {
        for (const idx of list) {
          const s = segs[idx]!;
          const dx = s.bx - s.ax, dz = s.bz - s.az;
          const len2 = dx * dx + dz * dz;
          let t = len2 > 1e-8 ? ((x - s.ax) * dx + (z - s.az) * dz) / len2 : 0;
          let along = 0;
          const len = Math.sqrt(len2);
          if (t < 0) { along = -t * len; t = 0; } else if (t > 1) { along = (t - 1) * len; t = 1; }
          const px = s.ax + dx * t, pz = s.az + dz * t, py = s.ay + (s.by - s.ay) * t;
          // signed horizontal lateral distance (right of the travel direction is +)
          let lat: number;
          if (len > 1e-4) lat = ((x - px) * -dz + (z - pz) * dx) / len;
          else lat = Math.hypot(x - px, z - pz);
          const ry = s.ary + (s.bry - s.ary) * t;
          const rh = Math.max(0.05, s.arh + (s.brh - s.arh) * t);
          const hw = s.ahw + (s.bhw - s.ahw) * t;
          const hwh = hw * rh; // horizontal half width of a banked road
          const outLat = Math.max(0, Math.abs(lat) - hwh);
          const e = Math.hypot(outLat, along);
          if (e > REACH) continue;
          if (s.kind !== 'gap' && e < nearest) nearest = e;
          if (s.kind === 'gap') {
            const pit = Math.min(s.ay, s.by) - PIT;
            const u = pit + Math.max(0, e - 3) * CUT;
            if (u < upper) upper = u;
            continue;
          }
          if (!s.upright) continue;
          const side = lat >= 0 ? 1 : -1;
          // under the road (also in the wedge between two segments on the outside of a curve, where the point is
          // just past both ends: it is still under the deck, not beside it)
          if (outLat === 0 && along < 2) {
            // under the road: hidden just below the deck
            const ys = py + (ry * (lat / rh));
            const u = s.kind === 'special' ? py - Math.abs(ry) * hw - 0.8 : ys - 0.6;
            if (u < upper) upper = u;
            if (s.kind === 'road' && ys - ground <= EMBANK_MAX + 0.5) lower = Math.max(lower, Math.min(ys, ground + EMBANK_MAX) - 0.6);
            continue;
          }
          const ye = s.kind === 'special' ? py - Math.abs(ry) * hw : py + ry * hw * side;
          const u = ye - KERB + Math.max(0, e - SHOULDER) * CUT;
          if (u < upper) upper = u;
          if (s.kind === 'road') {
            const top = Math.min(ye, ground + EMBANK_MAX + KERB);
            const l = top - KERB - Math.max(0, e - SHOULDER) * FILL;
            if (l > lower) lower = l;
          }
        }
      }
      if (lower > H) H = lower;
      if (upper < H) H = upper;
      heights[j * nx + i] = H;
      near[j * nx + i] = Math.min(255, Math.round(nearest));
    }
  }
  return { x0, z0, step, nx, nz, heights, base: ground, surface: style.surface, near, bounds: [minX, minZ, maxX, maxZ] };
}

/** Ground height at (x, z), interpolated on the same triangles the physics uses (diagonal from (i+1, j) to (i, j+1)). */
export function terrainHeight(t: TerrainData, x: number, z: number): number {
  const fx = (x - t.x0) / t.step, fz = (z - t.z0) / t.step;
  const i = Math.min(t.nx - 2, Math.max(0, Math.floor(fx))), j = Math.min(t.nz - 2, Math.max(0, Math.floor(fz)));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const h00 = t.heights[j * t.nx + i]!, h10 = t.heights[j * t.nx + i + 1]!, h01 = t.heights[(j + 1) * t.nx + i]!, h11 = t.heights[(j + 1) * t.nx + i + 1]!;
  return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}
