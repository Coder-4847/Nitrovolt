import {
  BufferAttribute, BufferGeometry, CapsuleGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, FrontSide, Group,
  IcosahedronGeometry, InstancedMesh, Material, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/Rng';
import { NOISE_GLSL } from './Landscape';
import { Prop, PropKind } from './SceneryPlan';
import { ThemeDef } from './Theme';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

/** Paint a geometry one flat colour (merged multi-colour props use vertex colours). */
function colored(g: BufferGeometry, hex: number): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position!.count;
  const col = new Float32Array(n * 3);
  _c.setHex(hex);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  return geo;
}

function jitter(g: BufferGeometry, amount: number, seed: number, keepBase = true): BufferGeometry {
  const r = new Rng(seed);
  const pos = g.attributes.position!;
  // identical vertices must move together or the faces tear open
  const moved = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let d = moved.get(k);
    if (!d) {
      d = [r.range(-amount, amount), keepBase && y <= 1e-4 ? 0 : r.range(-amount, amount), r.range(-amount, amount)];
      moved.set(k, d);
    }
    pos.setXYZ(i, x + d[0], y + d[1], z + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Fake ambient occlusion for foliage: darker low down and inside the crown, lighter on top and outside,
 * plus a little colour variation between clumps.
 */
function crownShade(g: BufferGeometry, centre: [number, number, number], radius: number, seed: number): BufferGeometry {
  const pos = g.attributes.position!;
  const col = g.attributes.color!;
  const r = new Rng(seed);
  const hue = 0.92 + r.next() * 0.16;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - centre[0], y = pos.getY(i) - centre[1], z = pos.getZ(i) - centre[2];
    const out = Math.min(1, Math.hypot(x, y, z) / radius);
    const k = (0.5 + 0.5 * Math.min(1, Math.max(0, (pos.getY(i) - 0.3) / 0.6))) * (0.7 + 0.3 * out) * hue;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return g;
}

/** Subdivision of leaf clumps for the geometry being built: 2 near the road, 1 for the far copies. */
let clumpDetail = 2;

/** A clump of leaves: a lumpy, softly shaded sphere (merged vertices, so it shades smooth, not faceted). */
function clump(x: number, y: number, z: number, r: number, seed: number, hex = 0xffffff, sy = 0.9): BufferGeometry {
  const base = mergeVertices(new IcosahedronGeometry(r, clumpDetail).deleteAttribute('uv').deleteAttribute('normal'));
  const g = colored(jitter(base.scale(1, sy, 1).translate(x, y, z), r * 0.13, seed, false), hex);
  return crownShade(g, [0, 0.62, 0], 0.5, seed);
}

function trunk(h: number, r0: number, r1: number, hex = 0x5a4432): BufferGeometry {
  return colored(new CylinderGeometry(r1, r0, h, 7).translate(0, h / 2, 0), hex);
}

/** A branch from `a` to `b` (unit space). */
function branch(a: [number, number, number], b: [number, number, number], r: number, hex = 0x4e3a2a): BufferGeometry {
  const va = new Vector3(...a), vb = new Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new CylinderGeometry(r * 0.6, r, len, 6).translate(0, len / 2, 0);
  const q = new Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
  g.applyQuaternion(q).translate(va.x, va.y, va.z);
  return colored(g, hex);
}

/** Broadleaf tree in a unit box (height 1, crown about 0.8 wide). */
function treeGeometry(): BufferGeometry {
  // the far copy keeps the five biggest clumps and no branches (they are hidden in the crown from afar)
  const far = clumpDetail < 2;
  const parts = far ? [trunk(0.5, 0.06, 0.035)] : [trunk(0.5, 0.06, 0.035), branch([0, 0.34, 0], [0.16, 0.52, 0.05], 0.02), branch([0, 0.38, 0], [-0.14, 0.55, -0.06], 0.02)];
  const clumps: Array<[number, number, number, number]> = [
    [0, 0.66, 0, 0.27], [0.17, 0.56, 0.07, 0.2], [-0.16, 0.58, -0.05, 0.21], [0.05, 0.82, -0.1, 0.19],
    [-0.08, 0.83, 0.12, 0.17], [0.12, 0.46, -0.14, 0.16], [-0.11, 0.46, 0.14, 0.16], [0.2, 0.72, -0.08, 0.15],
  ];
  clumps.slice(0, far ? 5 : clumps.length).forEach(([x, y, z, r], i) => parts.push(clump(x, y, z, r * (far ? 1.08 : 1), 7 + i)));
  return mergeGeometries(parts)!;
}

/** Tall narrow poplar / cypress. */
function poplarGeometry(): BufferGeometry {
  const parts = [trunk(0.3, 0.09, 0.06)];
  [[0, 0.38, 0.42], [0.02, 0.6, 0.38], [-0.02, 0.8, 0.3]].forEach(([x, y, r], i) => {
    const g = colored(jitter(new IcosahedronGeometry(r!, 1).scale(1, 1.5, 1).translate(x!, y!, 0), r! * 0.12, 40 + i, false), 0xffffff);
    parts.push(crownShade(g, [0, 0.6, 0], 0.6, 40 + i));
  });
  return mergeGeometries(parts)!;
}

/** Cherry tree: dark branching trunk, a wide flat crown of blossom and petals on the ground. */
function blossomGeometry(): BufferGeometry {
  const bark = 0x3e2c24;
  const parts = [
    trunk(0.36, 0.07, 0.05, bark),
    branch([0, 0.32, 0], [0.3, 0.58, 0.06], 0.035, bark), branch([0, 0.34, 0], [-0.28, 0.6, -0.08], 0.035, bark),
    branch([0, 0.34, 0], [0.04, 0.66, -0.26], 0.03, bark), branch([0, 0.3, 0], [-0.06, 0.55, 0.28], 0.03, bark),
  ];
  const clumps: Array<[number, number, number, number]> = [
    [0.3, 0.66, 0.05, 0.2], [-0.28, 0.68, -0.08, 0.21], [0.04, 0.74, -0.26, 0.19], [-0.06, 0.66, 0.28, 0.19],
    [0, 0.8, 0, 0.22], [0.18, 0.78, 0.2, 0.15], [-0.2, 0.8, 0.16, 0.15], [0.22, 0.76, -0.2, 0.15],
  ];
  clumps.forEach(([x, y, z, r], i) => parts.push(clump(x, y, z, r, 60 + i, 0xffffff, 0.75)));
  // fallen petals
  const petals = colored(new CircleGeometry(0.62, 18).rotateX(-Math.PI / 2).translate(0, 0.03, 0), 0xf6d8e0);
  parts.push(petals);
  return mergeGeometries(parts)!;
}

/** A conifer: trunk and six drooping, jittered tiers (snow on their upper faces in winter). */
function pineGeometry(snow: boolean): BufferGeometry {
  const parts = [trunk(0.3, 0.08, 0.05, 0x4a3424)];
  const tiers: Array<[number, number, number]> = [[0.5, 0.3, 0.26], [0.44, 0.28, 0.38], [0.37, 0.26, 0.5], [0.3, 0.24, 0.62], [0.22, 0.22, 0.74], [0.13, 0.2, 0.86]];
  tiers.forEach(([r, h, y], i) => {
    const cone = new ConeGeometry(r, h, 10, 2, true);
    // droop: pull the rim down and out a little
    const p = cone.attributes.position!;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < -h / 2 + 1e-4) p.setY(k, p.getY(k) - 0.035);
    jitter(cone.translate(0, y, 0), 0.02, 31 + i, false);
    const g = colored(cone, 0xffffff);
    const pos = g.attributes.position!, col = g.attributes.color!, nor = g.attributes.normal!;
    for (let k = 0; k < pos.count; k++) {
      const shade = 0.62 + 0.38 * ((y - 0.26) / 0.6) + 0.12 * (pos.getY(k) - y) / h;
      let cr = shade, cg = shade, cb = shade;
      if (snow) {
        // snowy pines are not tinted per instance: bake the needles' green and white snow on the upper faces
        // snow lies on the flatter upper faces; the rest shows the needles
        const sn = Math.min(1, Math.max(0, (nor.getY(k) - 0.62) / 0.2)) * (0.55 + 0.45 * ((pos.getX(k) * 7.3 + pos.getZ(k) * 5.1) % 1 + 1) % 1);
        cr = 0.17 * shade + (0.93 - 0.17 * shade) * sn; cg = 0.33 * shade + (0.95 - 0.33 * shade) * sn; cb = 0.25 * shade + (0.98 - 0.25 * shade) * sn;
      }
      col.setXYZ(k, cr, cg, cb);
    }
    parts.push(g);
  });
  return mergeGeometries(parts)!;
}

function bushGeometry(): BufferGeometry {
  return mergeGeometries([
    clump(0, 0.42, 0, 0.42, 81, 0xffffff, 0.75), clump(0.28, 0.3, 0.1, 0.3, 82, 0xffffff, 0.75), clump(-0.26, 0.3, -0.08, 0.3, 83, 0xffffff, 0.75),
  ])!;
}

/** Saguaro, built to true proportions (scaled uniformly by its height). */
function cactusGeometry(): BufferGeometry {
  const R = 0.075;
  const cap = (r: number, len: number): BufferGeometry => new CapsuleGeometry(r, len, 3, 10);
  const parts = [
    cap(R, 0.84).translate(0, 0.5, 0),
    cap(R * 0.75, 0.12).rotateZ(Math.PI / 2).translate(0.13, 0.42, 0),
    cap(R * 0.75, 0.24).translate(0.21, 0.55, 0),
    cap(R * 0.7, 0.1).rotateZ(Math.PI / 2).translate(-0.12, 0.55, 0),
    cap(R * 0.7, 0.16).translate(-0.19, 0.64, 0),
  ];
  return mergeGeometries(parts.map((g) => {
    const c = colored(g, 0xffffff);
    // ribs: darker bands round the stem
    const pos = c.attributes.position!, col = c.attributes.color!;
    for (let k = 0; k < pos.count; k++) {
      const a = Math.atan2(pos.getZ(k), pos.getX(k));
      const rib = 0.82 + 0.18 * Math.abs(Math.cos(a * 5));
      col.setXYZ(k, rib, rib, rib);
    }
    return c;
  }))!;
}

function barrelGeometry(): BufferGeometry {
  const body = colored(jitter(new SphereGeometry(0.5, 14, 8).scale(1, 0.8, 1).translate(0, 0.38, 0), 0.02, 91), 0xffffff);
  const flower = colored(new IcosahedronGeometry(0.12, 0).translate(0, 0.8, 0), 0xffd2f0);
  return mergeGeometries([body, flower])!;
}

function shrubGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const r = new Rng(97);
  for (let i = 0; i < 6; i++) parts.push(clump(r.range(-0.3, 0.3), r.range(0.2, 0.5), r.range(-0.3, 0.3), r.range(0.14, 0.24), 100 + i, 0xffffff, 0.8));
  parts.push(branch([0, 0, 0], [0.2, 0.45, 0.1], 0.03, 0x6a5440), branch([0, 0, 0], [-0.22, 0.4, -0.05], 0.03, 0x6a5440));
  return mergeGeometries(parts)!;
}

/** Grass tuft: a few thin blades leaning out (double-sided). */
function tuftGeometry(flowers: boolean): BufferGeometry {
  const r = new Rng(flowers ? 131 : 127);
  const pos: number[] = [], col: number[] = [];
  const petal = [[1, 0.85, 0.25], [1, 1, 1], [0.95, 0.45, 0.6], [0.65, 0.55, 1]];
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, Math.PI * 2);
    const bx = Math.cos(a) * r.range(0, 0.2), bz = Math.sin(a) * r.range(0, 0.2);
    const lean = r.range(0.15, 0.45);
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean, ty = r.range(0.7, 1);
    const w = 0.05;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, ty, tz);
    const dark = 0.55, light = 1.0;
    col.push(dark, dark, dark, dark, dark, dark, light, light, light);
    if (flowers && i % 2 === 0) {
      const c = petal[(i / 2) % petal.length]!;
      const s = 0.09;
      // a small upright quad pair at the tip
      pos.push(tx - s, ty, tz, tx + s, ty, tz, tx, ty + s * 1.6, tz, tx, ty, tz - s, tx, ty, tz + s, tx, ty + s * 1.6, tz);
      for (let k = 0; k < 6; k++) col.push(c[0]! * 3, c[1]! * 3, c[2]! * 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  // blades read best lit from above
  const n = g.attributes.normal!;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  return g;
}

/** Vertex colours by height: rock below, snow (or light bands) above. */
function heightColors(g: BufferGeometry, bands: Array<[number, number]>): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const pos = geo.attributes.position!;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    let hex = bands[0]![1];
    for (const [h, c] of bands) if (y >= h) hex = c;
    _c.setHex(hex);
    for (let k = 0; k < 3; k++) col.set([_c.r, _c.g, _c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function lampGeometry(): BufferGeometry {
  return mergeGeometries([
    colored(new CylinderGeometry(0.012, 0.02, 1, 8).translate(0, 0.5, 0), 0x3a3e46),
    colored(new CylinderGeometry(0.008, 0.008, 0.12, 6).rotateZ(Math.PI / 2).translate(0.05, 0.99, 0), 0x3a3e46),
    colored(new CylinderGeometry(0.03, 0.035, 0.03, 10).translate(0.1, 0.98, 0), 0x2a2e36),
    colored(new CylinderGeometry(0.026, 0.026, 0.006, 10).translate(0.1, 0.965, 0), 0xfff2c8),
  ])!;
}

type MatKind = 'foliage' | 'grass' | 'solid' | 'flat' | 'glow';

interface KindDef {
  geo: (snow: boolean) => BufferGeometry;
  mat: MatKind;
  /** Instance colour tints the vertex colours (false = vertex colours only). */
  tint?: boolean;
  /** Scale by height on all axes (built to true proportions). */
  uniform?: boolean;
  /** Casts a shadow when near the road (quality permitting). */
  shadow?: boolean;
}

const KINDS: Record<PropKind, KindDef> = {
  tree: { geo: treeGeometry, mat: 'foliage', tint: true, shadow: true },
  poplar: { geo: poplarGeometry, mat: 'foliage', tint: true, shadow: true },
  blossom: { geo: blossomGeometry, mat: 'foliage', tint: true, shadow: true },
  pine: { geo: pineGeometry, mat: 'foliage', tint: true, shadow: true },
  bush: { geo: bushGeometry, mat: 'foliage', tint: true },
  rock: { geo: () => colored(jitter(new IcosahedronGeometry(0.5, 1).scale(1, 0.75, 1).translate(0, 0.3, 0), 0.08, 11, false), 0xffffff), mat: 'flat', tint: true, shadow: true },
  cactus: { geo: cactusGeometry, mat: 'solid', tint: true, uniform: true, shadow: true },
  barrel: { geo: barrelGeometry, mat: 'solid', tint: true },
  shrub: { geo: shrubGeometry, mat: 'foliage', tint: true },
  tuft: { geo: () => tuftGeometry(false), mat: 'grass', tint: true },
  flowers: { geo: () => tuftGeometry(true), mat: 'grass', tint: false },
  mesa: {
    geo: () => heightColors(jitter(new CylinderGeometry(0.42, 0.5, 1, 12, 6).translate(0, 0.5, 0), 0.03, 31), [[0, 0xa65a36], [0.25, 0xc0784a], [0.45, 0xb4643c], [0.62, 0xd09060], [0.8, 0xb46a40], [0.97, 0xc89060]]),
    mat: 'flat',
  },
  mountain: {
    geo: () => heightColors(jitter(new ConeGeometry(0.5, 1, 18, 8).translate(0, 0.5, 0), 0.03, 21), [[0, 0x5a6578], [0.4, 0x6e7a8e], [0.56, 0xe6eef8], [0.68, 0xffffff]]),
    mat: 'flat',
  },
  lamp: { geo: lampGeometry, mat: 'glow', uniform: true },
};

/** Wind sway and a leafy breakup pattern for foliage (vertex-coloured, instanced). */
function foliageMaterial(grass: boolean, time: { value: number }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ roughness: 0.88, metalness: 0, vertexColors: true, side: grass ? DoubleSide : FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vLeaf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 o = instanceMatrix[3].xyz;
          float sway = max(0.0, position.y - ${grass ? '0.1' : '0.35'});
          float ph = uTime * ${grass ? '2.3' : '1.3'} + o.x * 0.11 + o.z * 0.13;
          transformed.x += sin(ph) * sway * ${grass ? '0.08' : '0.02'};
          transformed.z += cos(ph * 0.8) * sway * ${grass ? '0.06' : '0.015'};
          vLeaf = (instanceMatrix * vec4(position, 1.0)).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLeaf;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${grass ? '' : `{
          float d = length(vLeaf - cameraPosition);
          float leaf = lnoise(vLeaf.xy * 2.3 + vLeaf.z * 1.7) * 0.6 + lnoise(vLeaf.zy * 5.1) * 0.4;
          diffuseColor.rgb *= mix(1.0, 0.78 + 0.4 * leaf, exp(-d * 0.012));
        }`}`);
  };
  m.customProgramCacheKey = () => (grass ? 'grass' : 'foliage');
  return m;
}

/** Props at least this far (m) from the road use the light geometry and cast no shadow. */
const FAR = 45;

/** Instanced scenery: one or two InstancedMeshes per prop kind (near ones in full detail, casting shadows). */
export class Scenery {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];
  private readonly time = { value: 0 };

  constructor(props: readonly Prop[], theme: ThemeDef, shadows: boolean) {
    const snow = theme.arena.snow;
    const byKind = new Map<PropKind, Prop[]>();
    for (const p of props) {
      let l = byKind.get(p.kind);
      if (!l) byKind.set(p.kind, (l = []));
      l.push(p);
    }
    const mats: Record<MatKind, MeshStandardMaterial> = {
      foliage: foliageMaterial(false, this.time),
      grass: foliageMaterial(true, this.time),
      solid: new MeshStandardMaterial({ roughness: 0.8, metalness: 0.0, vertexColors: true }),
      flat: new MeshStandardMaterial({ roughness: 0.95, metalness: 0.0, flatShading: true, vertexColors: true }),
      glow: new MeshStandardMaterial({ roughness: 0.5, metalness: 0.3, vertexColors: true, emissive: 0xfff0c8, emissiveIntensity: 0 }),
    };
    if (theme.night) {
      // lamp heads glow: the bright vertex colour drives the emissive through a map-less trick
      mats.glow.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += step(2.4, vColor.r + vColor.g + vColor.b) * vec3(3.0, 2.6, 1.8);');
      };
    }
    this.mats.push(...Object.values(mats));
    for (const [kind, list] of byKind) {
      const def = KINDS[kind];
      // near the road: full detail (and shadows); further out a lighter copy, never seen up close
      const near = list.filter((p) => p.near < FAR), far = list.filter((p) => p.near >= FAR);
      const geo = def.geo(snow);
      clumpDetail = 1;
      const farGeo = far.length ? def.geo(snow) : geo;
      clumpDetail = 2;
      this.geos.push(geo);
      if (farGeo !== geo) this.geos.push(farGeo);
      const groups: Array<[Prop[], BufferGeometry, boolean]> = [[near, geo, !!def.shadow && shadows], [far, farGeo, false]];
      for (const [items, g, cast] of groups) {
        if (!items.length) continue;
        const mesh = new InstancedMesh(g, mats[def.mat], items.length);
        items.forEach((p, i) => {
          _q.setFromAxisAngle(UP, p.rot);
          if (def.uniform) _s.set(p.sy, p.sy, p.sy);
          else _s.set(p.sx, p.sy, p.sz);
          _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
          mesh.setMatrixAt(i, _m);
          mesh.setColorAt(i, _c.setHex(def.tint === false || (snow && kind === 'pine') ? 0xffffff : p.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = cast;
        mesh.receiveShadow = def.mat !== 'grass';
        this.group.add(mesh);
      }
    }
  }

  update(time: number): void {
    this.time.value = time;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
