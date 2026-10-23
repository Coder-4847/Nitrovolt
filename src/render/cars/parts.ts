import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Group, InstancedMesh, LatheGeometry, Matrix4,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Quaternion, RepeatWrapping, SRGBColorSpace, Vector2, Vector3,
} from 'three';

/** Shared look: livery-driven paint and accent, plus trim, glass, metal and lamp materials. */
export interface CarMaterials {
  paint: MeshStandardMaterial;
  /** Paint with the livery artwork (stripes, number, carbon lower sides) mapped onto lofted bodies. */
  livery: MeshPhysicalMaterial;
  /** Exposed carbon fibre (wings, floor, diffuser). */
  carbon: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  /** Satin black plastic: bumpers, diffusers, mirrors, arch liners. */
  dark: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  head: MeshBasicMaterial;
  tail: MeshBasicMaterial;
}

export function makeMaterials(primary: number, accent: number, number = 1): CarMaterials {
  const art = liveryTexture(primary, accent, number);
  return {
    // clear-coated paint: picks up the sky through the environment map
    paint: new MeshPhysicalMaterial({ color: primary, roughness: 0.42, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }),
    livery: new MeshPhysicalMaterial({ map: art, roughness: 0.4, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    carbon: new MeshStandardMaterial({ map: carbonTexture(), color: 0x9aa0a8, roughness: 0.38, metalness: 0.3 }),
    accent: new MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.2 }),
    dark: new MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.72, metalness: 0.1 }),
    glass: new MeshPhysicalMaterial({ color: 0x141a22, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
    metal: new MeshStandardMaterial({ color: 0xa8aeb6, roughness: 0.35, metalness: 0.85 }),
    head: new MeshBasicMaterial({ color: new Color(0.95, 0.97, 1) }),
    tail: new MeshBasicMaterial({ color: new Color(0.5, 0.03, 0.03) }),
  };
}

export type TyreKind = 'sport' | 'knobby' | 'studded' | 'balloon';

export interface CarModel {
  body: Group;
  /** Where the digital speed display sits (car-local, facing backwards) and its size. */
  plate?: { x: number; y: number; z: number; w: number; h: number };
  /** Parts hidden in the hood camera so they do not block the view. */
  cockpitHidden: Object3D[];
  tyre: TyreKind;
  /** Tyre width (m). */
  tyreWidth: number;
  /** Boost exhaust outlets (car-local) and their look: an electric glow or a combustion flame. */
  exhaust: Array<[number, number, number]>;
  flame: 'electric' | 'fire';
}

/**
 * One cross-section of a lofted body, at `z` (car-local, -Z is forward). The section is a rounded
 * rectangle (superellipse) `w` wide between heights `y0` and `y1`; `bot` / `top` narrow its lower and
 * upper halves (wheel arches below the shoulder, tumblehome of a cabin).
 */
export interface Station {
  z: number;
  w: number;
  y0: number;
  y1: number;
  bot?: number;
  top?: number;
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const FONT = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", Impact, sans-serif';

/**
 * Livery artwork for lofted bodies. Texture x runs once around the section (0 = right side, 0.25 = top,
 * 0.5 = left side, 0.75 = underside) and y along the body (0 = nose, 1 = tail): the paint colour, a
 * twin stripe along the top, an accent sweep and the race number on both flanks, carbon underneath.
 */
export function paintLivery(g: CanvasRenderingContext2D, primary: number, accent: number, number: number): void {
  const W = g.canvas.width, H = g.canvas.height;
  g.fillStyle = css(primary);
  g.fillRect(0, 0, W, H);
  // carbon underside
  g.fillStyle = '#1a1c20';
  g.fillRect(W * 0.6, 0, W * 0.3, H);
  // accent sweeps along both flanks
  g.fillStyle = css(accent);
  for (const x0 of [0, W * 0.5]) {
    g.beginPath();
    g.moveTo(x0 + W * 0.06, H * 0.18);
    g.lineTo(x0 + W * 0.12, H * 0.18);
    g.lineTo(x0 + W * 0.2, H * 0.95);
    g.lineTo(x0 + W * 0.13, H * 0.95);
    g.closePath();
    g.fill();
  }
  // twin stripe over the top
  g.fillStyle = '#f4f6f8';
  g.fillRect(W * 0.235, 0, W * 0.008, H);
  g.fillRect(W * 0.257, 0, W * 0.008, H);
  g.fillStyle = css(accent);
  g.fillRect(W * 0.243, 0, W * 0.014, H);
  // race number on both flanks, reading along the car
  const label = String(number).padStart(2, '0');
  for (const [x, flip] of [[W * 0.03, 1], [W * 0.47, -1]] as const) {
    g.save();
    g.translate(x, H * 0.56);
    g.rotate((flip * Math.PI) / 2);
    g.fillStyle = '#f4f6f8';
    g.beginPath();
    g.arc(0, 0, H * 0.075, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111316';
    g.font = `italic 800 ${Math.round(H * 0.1)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 0, 2);
    g.restore();
  }
}

export function liveryTexture(primary: number, accent: number, number: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  paintLivery(c.getContext('2d')!, primary, accent, number);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let carbonCache: CanvasTexture | null = null;
/** Woven carbon-fibre pattern (tiles). */
export function carbonTexture(): CanvasTexture {
  if (carbonCache) return carbonCache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#202328';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) {
    g.fillStyle = (x + y) % 16 === 0 ? '#2c3037' : '#17191d';
    g.fillRect(x, y, 8, 4);
    g.fillStyle = (x + y) % 16 === 0 ? '#17191d' : '#2c3037';
    g.fillRect(x, y + 4, 8, 4);
  }
  carbonCache = new CanvasTexture(c);
  carbonCache.colorSpace = SRGBColorSpace;
  carbonCache.wrapS = carbonCache.wrapT = RepeatWrapping;
  carbonCache.repeat.set(4, 4);
  return carbonCache;
}

/**
 * Smooth body shell through the stations: the section parameters are interpolated with Catmull-Rom
 * splines along the length, every section is a superellipse ring, and the ends are closed. Returns an
 * indexed geometry with smooth normals.
 */
export function loft(stations: Station[], opts: { ring?: number; sub?: number; square?: number } = {}): BufferGeometry {
  const ring = opts.ring ?? 32;
  const sub = opts.sub ?? 5;
  const ex = 2 / (opts.square ?? 4);
  const st = [...stations].sort((a, b) => a.z - b.z);
  const at = (i: number): Station => st[Math.max(0, Math.min(st.length - 1, i))]!;
  // densified sections
  const secs: Required<Station>[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      const f = (key: keyof Station, def: number): number => catmull(a[key] ?? def, b[key] ?? def, c[key] ?? def, d[key] ?? def, t);
      secs.push({ z: b.z + (c.z - b.z) * t, w: f('w', 1), y0: f('y0', 0), y1: f('y1', 1), bot: f('bot', 1), top: f('top', 1) });
    }
  }
  const last = st[st.length - 1]!;
  secs.push({ z: last.z, w: last.w, y0: last.y0, y1: last.y1, bot: last.bot ?? 1, top: last.top ?? 1 });

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const zMin = secs[0]!.z, zMax = secs[secs.length - 1]!.z;
  for (const s of secs) {
    const a = s.w / 2, b = (s.y1 - s.y0) / 2, yc = (s.y0 + s.y1) / 2;
    // ring + 1 vertices: the seam is duplicated so the livery's u can run 0..1 without wrapping
    for (let j = 0; j <= ring; j++) {
      const th = (j / ring) * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th);
      const u = Math.sign(c) * Math.abs(c) ** ex;
      const v = Math.sign(sn) * Math.abs(sn) ** ex;
      const narrow = v < 0 ? 1 + (s.bot - 1) * Math.min(1, -v * 1.25) : 1 + (s.top - 1) * v * v;
      pos.push(u * a * narrow, yc + v * b, s.z);
      uv.push(j / ring, (s.z - zMin) / Math.max(1e-6, zMax - zMin));
    }
  }
  const n = secs.length;
  const R = ring + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * R + j, b = i * R + j + 1, c = (i + 1) * R + j, d = (i + 1) * R + j + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // end caps: fan to the section centre
  for (const [i, flip] of [[0, true], [n - 1, false]] as const) {
    const s = secs[i]!;
    const centre = pos.length / 3;
    pos.push(0, (s.y0 + s.y1) / 2, s.z);
    uv.push(0.25, i === 0 ? 0 : 1);
    for (let j = 0; j < ring; j++) {
      const a = i * R + j, b = i * R + j + 1;
      if (flip) idx.push(centre, b, a);
      else idx.push(centre, a, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A mesh from a loft, ready to add to a body. */
export const shell = (stations: Station[], mat: MeshStandardMaterial, opts?: Parameters<typeof loft>[1]): Mesh => new Mesh(loft(stations, opts), mat);

export const box = (w: number, h: number, d: number, mat: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0): Mesh => {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/** A cylinder between two points (roll-cage tubes, struts). */
export function tube(a: [number, number, number], b: [number, number, number], radius: number, mat: MeshStandardMaterial): Mesh {
  const pa = new Vector3(...a), pb = new Vector3(...b);
  const len = pa.distanceTo(pb);
  const m = new Mesh(new CylinderGeometry(radius, radius, len, 10), mat);
  m.position.copy(pa).add(pb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), pb.sub(pa).normalize());
  return m;
}

/** Mirror a part across the car's centre plane (returns the copy). */
export function mirrored(m: Mesh): Mesh {
  const c = m.clone();
  c.position.x = -c.position.x;
  c.rotation.y = -c.rotation.y;
  c.rotation.z = -c.rotation.z;
  return c;
}

/** Tyre cross-section (lathe profile about the axle): rounded shoulders, slightly bulged sidewalls. */
function tyreGeometry(radius: number, width: number, kind: TyreKind): BufferGeometry {
  const hw = width / 2;
  const side = kind === 'balloon' ? 0.5 : kind === 'sport' ? 0.32 : 0.42; // sidewall height / radius
  const inner = radius * (1 - side);
  const sh = Math.min(hw * 0.45, radius * 0.12);
  const pts: Vector2[] = [];
  pts.push(new Vector2(inner, -hw * 0.92));
  pts.push(new Vector2(inner + (radius - inner) * 0.55, -hw * 1.02));
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    pts.push(new Vector2(radius - sh + Math.sin(a) * sh, -hw + sh - Math.cos(a) * sh));
  }
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    pts.push(new Vector2(radius - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh));
  }
  pts.push(new Vector2(inner + (radius - inner) * 0.55, hw * 1.02));
  pts.push(new Vector2(inner, hw * 0.92));
  // lathe spins about Y; the wheel spins about X
  return new LatheGeometry(pts, 40).rotateZ(Math.PI / 2);
}

/** Wheel + tyre in the style of the car. The returned group spins about its local X axis. */
export function makeWheel(kind: TyreKind, radius: number, width: number, outer: -1 | 1, mats: CarMaterials): Group {
  const spin = new Group();
  const tyreMat = new MeshStandardMaterial({ color: 0x18191b, roughness: 0.9 });
  const rimMat = kind === 'sport'
    ? new MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.3, metalness: 0.8 })
    : new MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.35, metalness: 0.8 });
  spin.add(new Mesh(tyreGeometry(radius, width, kind), tyreMat));
  const side = kind === 'balloon' ? 0.5 : kind === 'sport' ? 0.32 : 0.42;
  const rimR = radius * (1 - side) + 0.005;
  const face = outer * (width / 2 - 0.04);
  // rim barrel + a dished face of spokes
  spin.add(new Mesh(new CylinderGeometry(rimR, rimR, width * 0.86, 28, 1, true).rotateZ(Math.PI / 2), rimMat));
  const disc = new Mesh(new CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.02, 28).rotateZ(Math.PI / 2), mats.dark);
  disc.position.x = face - outer * 0.05;
  spin.add(disc);
  const spokes = kind === 'balloon' ? 6 : kind === 'sport' ? 5 : 6;
  for (let s = 0; s < spokes; s++) {
    const sp = box(0.035, rimR * 0.92, kind === 'sport' ? 0.07 : 0.09, rimMat);
    sp.geometry.translate(0, rimR * 0.46, 0);
    sp.position.x = face;
    sp.rotation.x = (s / spokes) * Math.PI * 2;
    spin.add(sp);
  }
  const hub = new Mesh(new CylinderGeometry(rimR * 0.2, rimR * 0.2, 0.06, 14).rotateZ(Math.PI / 2), rimMat);
  hub.position.x = face;
  spin.add(hub);
  // brake disc and the calliper in the livery accent (the calliper does not spin, but at speed nobody can tell)
  const brake = new Mesh(new CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.025, 24).rotateZ(Math.PI / 2), mats.metal);
  brake.position.x = face - outer * 0.09;
  spin.add(brake);
  const cal = box(0.05, rimR * 0.36, rimR * 0.5, mats.accent, face - outer * 0.12, rimR * 0.5, 0);
  spin.add(cal);
  if (kind !== 'sport') {
    // tread blocks / studs / paddles so the rolling wheel reads at speed
    const n = kind === 'balloon' ? 16 : kind === 'knobby' ? 24 : 28;
    const blockW = kind === 'balloon' ? width * 0.86 : width * 0.78;
    const blockH = kind === 'studded' ? 0.035 : 0.05;
    const blockD = kind === 'studded' ? 0.045 : 0.08;
    const rows = kind === 'studded' ? [-width * 0.24, width * 0.24] : kind === 'knobby' ? [-width * 0.2, width * 0.2] : [0];
    const w = kind === 'balloon' ? blockW : blockW / rows.length * 0.9;
    const block = new InstancedMesh(new BoxGeometry(w, blockH, blockD), kind === 'studded' ? mats.metal : tyreMat, n * rows.length);
    const m = new Matrix4();
    const q = new Quaternion();
    let i = 0;
    for (const [ri, dx] of rows.entries()) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (ri % 2 ? Math.PI / n : 0);
        q.setFromAxisAngle(new Vector3(1, 0, 0), a);
        m.compose(new Vector3(dx, Math.cos(a) * (radius + blockH / 2 - 0.012), Math.sin(a) * (radius + blockH / 2 - 0.012)), q, new Vector3(1, 1, 1));
        block.setMatrixAt(i++, m);
      }
    }
    spin.add(block);
  }
  spin.traverse((o) => {
    if (o instanceof Mesh || o instanceof InstancedMesh) o.castShadow = true;
  });
  return spin;
}
