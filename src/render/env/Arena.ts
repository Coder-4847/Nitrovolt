import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Material,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/Rng';
import { flagAtlasTexture, ledBoardTexture, screenTexture } from './Signage';

/** How the arena is dressed for a theme. */
export interface ArenaStyle {
  /** Stand concrete and roof colours. */
  structure: number;
  roof: number;
  /** Seat colours (one per section, cycled). */
  seats: number[];
  /** Snow on roofs and steps (winter). */
  snow: boolean;
  accent: number;
}

/** One ring sample: base point at the front of the stands, outward normal, curvature (1/R, 0 on straights), perimeter distance. */
interface RingSample { x: number; z: number; nx: number; nz: number; curv: number; s: number }

/** Segment width along the ring and stand depth, in the segment's local units (scaled by SCALE in the world). */
const SEG = 16;
/** World scale of the stands (a big bowl that reads from the raised road). */
const SCALE = 1.6;
const DEPTH = 18;
const H0 = 4; // podium wall height
const TIERS = 16;
const RISE = 0.6;
const TREAD = 1.0;
const TOP = H0 + TIERS * RISE; // top of the seating
const ROOF_Y = TOP + 4.2;

/** Rounded rectangle around the track, sampled every SEG metres (counter-clockwise seen from above). */
function ringSamples(minX: number, maxX: number, minZ: number, maxZ: number, radius: number): RingSample[] {
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2 - radius, hz = (maxZ - minZ) / 2 - radius;
  // pieces: four straights and four quarter arcs
  type Piece = { len: number; at: (u: number) => RingSample };
  const pieces: Piece[] = [];
  const straight = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-3) return;
    pieces.push({ len, at: (u) => ({ x: x0 + (x1 - x0) * u, z: z0 + (z1 - z0) * u, nx, nz, curv: 0, s: 0 }) });
  };
  const arc = (ax: number, az: number, a0: number): void => {
    pieces.push({
      len: (Math.PI / 2) * radius,
      at: (u) => {
        const a = a0 + u * (Math.PI / 2);
        const nx = Math.cos(a), nz = Math.sin(a);
        return { x: ax + nx * radius, z: az + nz * radius, nx, nz, curv: 1 / radius, s: 0 };
      },
    });
  };
  straight(cx + hx + radius, cz - hz, cx + hx + radius, cz + hz, 1, 0);
  arc(cx + hx, cz + hz, 0);
  straight(cx + hx, cz + hz + radius, cx - hx, cz + hz + radius, 0, 1);
  arc(cx - hx, cz + hz, Math.PI / 2);
  straight(cx - hx - radius, cz + hz, cx - hx - radius, cz - hz, -1, 0);
  arc(cx - hx, cz - hz, Math.PI);
  straight(cx - hx, cz - hz - radius, cx + hx, cz - hz - radius, 0, -1);
  arc(cx + hx, cz - hz, (3 * Math.PI) / 2);
  const total = pieces.reduce((a, p) => a + p.len, 0);
  const n = Math.max(8, Math.round(total / (SEG * SCALE)));
  const step = total / n;
  const out: RingSample[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i + 0.5) * step;
    for (const p of pieces) {
      if (d <= p.len) {
        const r = p.at(d / p.len);
        r.s = (i + 0.5) * step;
        out.push(r);
        break;
      }
      d -= p.len;
    }
  }
  return out;
}

/** Instance matrix: local x along the ring, z outward, y up, scaled to the world size of the stands. */
function frameAt(r: RingSample, y: number): Matrix4 {
  const n = new Vector3(r.nx, 0, r.nz);
  const up = new Vector3(0, 1, 0);
  const t = new Vector3().crossVectors(up, n);
  return new Matrix4().makeBasis(t.multiplyScalar(SCALE), up.multiplyScalar(SCALE), n.multiplyScalar(SCALE)).setPosition(r.x, y, r.z);
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry => new BoxGeometry(w, h, d).translate(x, y + h / 2, z);

/** Stepped seating deck: treads and risers between the podium wall and the back wall (local frame). */
function seatingGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < TIERS; i++) {
    const z0 = 1 + i * TREAD;
    const y = H0 + (i + 1) * RISE;
    // tread (a slab one step deep, down to the step below so there are no gaps)
    parts.push(box(SEG, RISE, TREAD, 0, y - RISE, z0 + TREAD / 2));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** Podium wall, back wall, roof columns and the roof slab. */
function structureGeometry(snow: boolean): BufferGeometry {
  const back = DEPTH + 0.5;
  const parts = [
    box(SEG, H0 + RISE, 1, 0, 0, 0.5),
    box(SEG, TOP + 1.2, 0.8, 0, 0, back),
    box(SEG, H0, DEPTH - 1, 0, 0, DEPTH / 2 + 0.5),
    box(0.7, ROOF_Y - TOP, 0.7, -SEG / 2 + 0.6, TOP, back),
    box(0.7, ROOF_Y - TOP, 0.7, SEG / 2 - 0.6, TOP, back),
    // rafters under the roof
    box(0.35, 0.6, DEPTH - 2, -SEG / 4, ROOF_Y - 0.6, (DEPTH + 4) / 2),
    box(0.35, 0.6, DEPTH - 2, SEG / 4, ROOF_Y - 0.6, (DEPTH + 4) / 2),
  ];
  if (snow) parts.push(box(SEG, 0.15, 1, 0, H0 + RISE, 0.5));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/**
 * Seat shading on the deck, in the segment's local frame: seat backs and cushions in the section colour,
 * concrete aisles at the section ends, and a sparse crowd. Anti-aliased; distant stands fade to the
 * average so they never shimmer. Corner segments taper (`aCurv`) so the ring closes without gaps.
 */
function standMaterial(base: number, snow: boolean): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBase = { value: new Color(base) };
    sh.uniforms.uSnow = { value: snow ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCurv; varying vec3 vLoc; varying vec3 vLN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = transformed; vLN = objectNormal;\n#ifdef USE_INSTANCING\ntransformed.x *= 1.0 + max(transformed.z, 0.0) * aCurv;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLoc; varying vec3 vLN; uniform vec3 uBase; uniform float uSnow;
        float shash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 seat = diffuseColor.rgb;
          vec3 conc = uBase;
          float sx = vLoc.x / 0.55;
          float fw = max(fwidth(sx), 1e-3);
          float detail = 1.0 - smoothstep(0.3, 0.9, fw);
          float f = fract(sx);
          float inSeat = smoothstep(0.08 - fw, 0.08 + fw, f) * (1.0 - smoothstep(0.86 - fw, 0.86 + fw, f));
          float aisle = step(${(SEG / 2 - 0.9).toFixed(2)}, abs(vLoc.x));
          float riser = step(0.5, -vLN.z);
          float top = step(0.5, vLN.y);
          float ry = fract((vLoc.y - ${H0.toFixed(1)}) / ${RISE.toFixed(2)});
          float back = riser * step(0.25, ry);
          float cushion = top * step(vLoc.z - floor(vLoc.z - 1.0) - 1.0, 0.55);
          float seatMask = mix(0.62, inSeat, detail) * max(back, cushion) * (1.0 - aisle);
          // sparse crowd on the seat backs
          vec2 cell = vec2(floor(sx), floor((vLoc.y - ${H0.toFixed(1)}) / ${RISE.toFixed(2)}));
          float r = shash(cell + floor(vLoc.z));
          vec3 shirt = vec3(fract(r * 7.1), fract(r * 13.7), fract(r * 3.3)) * 0.8 + 0.15;
          float person = step(0.86, r) * back * inSeat * detail * (1.0 - aisle);
          diffuseColor.rgb = mix(conc, seat, seatMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, shirt, person);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * top * 0.85);
        }`);
  };
  m.customProgramCacheKey = () => `stand:${snow}`;
  return m;
}

/** LED board strip along the podium wall; its texture runs continuously around the ring and scrolls. */
function ledMaterial(accent: number): MeshBasicMaterial {
  const map = ledBoardTexture(accent);
  const m = new MeshBasicMaterial({ map, color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uScroll = { value: 0 };
    m.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aU; uniform float uScroll;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvMapUv.x = (aU + position.x) / 64.0 + uScroll;\n#endif');
  };
  m.customProgramCacheKey = () => 'arena-led';
  return m;
}

/** Flags on poles: an atlas of designs, waving in a vertex shader. */
function flagMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ map: flagAtlasTexture(), side: DoubleSide, roughness: 0.8 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    m.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlag; uniform float uTime;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (vMapUv + vec2(mod(aFlag, 4.0), floor(aFlag / 4.0))) * 0.25;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float along = position.x + 1.5;
        transformed.z += sin(along * 2.2 - uTime * 6.0 + aFlag * 1.7) * 0.18 * along;
        transformed.y -= along * 0.06;`);
  };
  m.customProgramCacheKey = () => 'arena-flag';
  return m;
}

/**
 * The stadium around a level: a ring of roofed grandstands (seat rows, aisles, a sparse crowd), an LED
 * board running all the way round the podium wall, flags along the roof, big video screens and light
 * towers at the corners. Every part is one InstancedMesh sharing the ring's instance frames.
 */
export class Arena {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];
  private led: MeshBasicMaterial | null = null;
  private flag: MeshStandardMaterial | null = null;

  constructor(centerline: ReadonlyArray<{ x: number; z: number }>, groundY: number, style: ArenaStyle, seed: number) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of centerline) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    if (!Number.isFinite(minX)) return;
    const margin = 46;
    minX -= margin; maxX += margin; minZ -= margin; maxZ += margin;
    const radius = Math.min(70, (maxX - minX) / 2 - 1, (maxZ - minZ) / 2 - 1);
    const ring = ringSamples(minX, maxX, minZ, maxZ, radius);
    const rng = new Rng(seed);

    const add = (geo: BufferGeometry, mat: Material, frames: Matrix4[], attrs: Record<string, number[]> = {}, colors?: number[]): InstancedMesh => {
      this.geos.push(geo);
      if (!this.mats.includes(mat)) this.mats.push(mat);
      const im = new InstancedMesh(geo, mat, frames.length);
      frames.forEach((f, i) => im.setMatrixAt(i, f));
      for (const [k, v] of Object.entries(attrs)) geo.setAttribute(k, new InstancedBufferAttribute(new Float32Array(v), 1));
      if (colors) {
        const c = new Color();
        colors.forEach((hex, i) => im.setColorAt(i, c.setHex(hex)));
      }
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    };

    const frames = ring.map((r) => frameAt(r, groundY));
    // taper per local unit of depth (the ring's curvature in local units)
    const curv = ring.map((r) => r.curv * SCALE);
    // seating (section colours change every few segments)
    const seatCols = ring.map((_, i) => style.seats[Math.floor(i / 3) % style.seats.length]!);
    add(seatingGeometry(), standMaterial(style.structure, style.snow), frames, { aCurv: curv }, seatCols);
    const structMat = new MeshStandardMaterial({ color: style.structure, roughness: 0.85 });
    const structMatT = this.taper(structMat);
    add(structureGeometry(style.snow), structMatT, frames, { aCurv: curv });
    // roof slab, cantilevered toward the track, white on top
    const roofGeo = box(SEG, 0.5, DEPTH - 2, 0, ROOF_Y, (DEPTH + 2) / 2 - 1).rotateX(-0.06);
    add(roofGeo, this.taper(new MeshStandardMaterial({ color: style.snow ? 0xf4f7fa : style.roof, roughness: 0.6, metalness: 0.2 })), frames, { aCurv: curv });
    // LED board on the podium wall, facing the track
    this.led = ledMaterial(style.accent);
    const ledGeo = new PlaneGeometry(SEG, 1.4).rotateY(Math.PI).translate(0, 2.2, -0.02);
    add(ledGeo, this.led, frames, { aU: ring.map((r) => r.s / SCALE) });
    // flags on poles along the back of the roof
    const poleFrames: Matrix4[] = [];
    const flagFrames: Matrix4[] = [];
    const flagIds: number[] = [];
    ring.forEach((r, i) => {
      if (i % 2) return;
      const f = frameAt(r, groundY);
      poleFrames.push(f.clone().multiply(new Matrix4().makeTranslation(0, ROOF_Y, DEPTH + 0.8)));
      flagFrames.push(f.clone().multiply(new Matrix4().makeTranslation(1.5, ROOF_Y + 7.2, DEPTH + 0.8)));
      flagIds.push(Math.floor(rng.next() * 16));
    });
    add(new CylinderGeometry(0.08, 0.1, 9, 6).translate(0, 4.5, 0), new MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.7, roughness: 0.35 }), poleFrames);
    this.flag = flagMaterial();
    add(new PlaneGeometry(3, 2, 12, 2), this.flag, flagFrames, { aFlag: flagIds });

    // video screens on pylons in the middle of each long side, and light towers at the corners
    const sides = [0.125, 0.375, 0.625, 0.875].map((u) => ring[Math.floor(u * ring.length) % ring.length]!);
    sides.forEach((r, k) => {
      const f = frameAt(r, groundY);
      const pylon = new Mesh(new BoxGeometry(2.2, 30, 2.2).translate(0, 15, 0), structMat);
      pylon.applyMatrix4(f.clone().multiply(new Matrix4().makeTranslation(0, 0, -7)));
      const frame = new Mesh(new BoxGeometry(10.6, 20.6, 1).translate(0, 26, 0), new MeshStandardMaterial({ color: 0x1a1d23, roughness: 0.5 }));
      frame.applyMatrix4(f.clone().multiply(new Matrix4().makeTranslation(0, 0, -7.6)));
      const screenMat = new MeshBasicMaterial({ map: screenTexture(style.accent, k) });
      const screen = new Mesh(new PlaneGeometry(10, 20).rotateY(Math.PI).translate(0, 26, -0.52), screenMat);
      screen.applyMatrix4(f.clone().multiply(new Matrix4().makeTranslation(0, 0, -7.6)));
      this.mats.push(screenMat);
      this.group.add(pylon, frame, screen);
    });
    const corners = [0, 0.25, 0.5, 0.75].map((u) => ring[Math.floor((u + 0.0625) * ring.length) % ring.length]!);
    const towerMat = new MeshStandardMaterial({ color: 0xc4c9d0, metalness: 0.6, roughness: 0.4 });
    const lampMat = new MeshBasicMaterial({ color: new Color(0.95, 0.96, 1) });
    this.mats.push(towerMat, lampMat);
    for (const r of corners) {
      const f = frameAt(r, groundY).multiply(new Matrix4().makeTranslation(0, 0, DEPTH + 8));
      const mast = new Mesh(new CylinderGeometry(0.6, 1.1, 52, 10).translate(0, 26, 0), towerMat);
      const head = new Mesh(new BoxGeometry(9, 5, 0.8).translate(0, 54, 0), towerMat);
      const lamps = new Mesh(new PlaneGeometry(8.4, 4.4).rotateY(Math.PI).translate(0, 54, -0.42), lampMat);
      for (const m of [mast, head, lamps]) {
        m.applyMatrix4(f);
        this.group.add(m);
      }
    }
  }

  /** A standard material that tapers corner segments like the seating does. */
  private taper(m: MeshStandardMaterial): MeshStandardMaterial {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCurv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x *= 1.0 + max(transformed.z, 0.0) * aCurv;\n#endif');
    };
    m.customProgramCacheKey = () => 'arena-taper';
    this.mats.push(m);
    return m;
  }

  update(time: number): void {
    const led = this.led?.userData.shader as { uniforms: Record<string, { value: number }> } | undefined;
    if (led) led.uniforms.uScroll!.value = (time * 0.02) % 1;
    const flag = this.flag?.userData.shader as { uniforms: Record<string, { value: number }> } | undefined;
    if (flag) flag.uniforms.uTime!.value = time;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.group.clear();
  }
}
