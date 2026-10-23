import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, Material, Matrix4, MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/Rng';
import { Prop, PropKind } from './SceneryPlan';
import { ThemeDef } from './Theme';

/** How a prop kind maps onto its unit mesh: per-axis scaling (box-like) or uniform by height. */
const UNIFORM: Partial<Record<PropKind, number>> = { crane: 40, turbine: 56, chimney: 100, lightTower: 34 };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

function boxAt(w: number, h: number, d: number, x = 0, y = 0, z = 0): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

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

/** Vertex colours by height: rock below, snow (or light bands) above. */
function heightColors(g: BufferGeometry, bands: Array<[number, number]>): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const pos = geo.attributes.position!;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    // colour whole faces by their centre so the low-poly facets stay crisp
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

interface KindDef {
  geo: () => BufferGeometry;
  /** concrete / glass: procedural facades; flat: faceted vertex colours; soft: smooth vertex colours. */
  mat: 'concrete' | 'glass' | 'matte' | 'flat' | 'soft' | 'metal';
  /** Instance colour tints the vertex colours (false = vertex colours only). */
  tint?: boolean;
}

const KINDS: Record<PropKind, KindDef> = {
  building: { geo: () => boxAt(1, 1, 1), mat: 'concrete', tint: true },
  tower: { geo: () => mergeGeometries([boxAt(1, 0.9, 1), boxAt(0.86, 0.1, 0.86, 0, 0.9)])!, mat: 'glass', tint: true },
  skyscraper: { geo: () => mergeGeometries([boxAt(1, 0.82, 1), boxAt(0.78, 0.14, 0.78, 0, 0.82), boxAt(0.42, 0.04, 0.42, 0, 0.96)])!, mat: 'glass', tint: true },
  roofUnit: { geo: () => boxAt(1, 1, 1), mat: 'metal', tint: true },
  tree: {
    geo: () => mergeGeometries([
      colored(new CylinderGeometry(0.05, 0.07, 0.42, 6).translate(0, 0.21, 0), 0x5a4634),
      colored(jitter(new IcosahedronGeometry(0.42, 1).scale(1, 0.9, 1).translate(0, 0.62, 0), 0.05, 5, false), 0xffffff),
    ])!,
    mat: 'soft', tint: true,
  },
  pine: {
    geo: () => mergeGeometries([
      colored(new CylinderGeometry(0.06, 0.09, 0.25, 6).translate(0, 0.125, 0), 0x4a3424),
      colored(new ConeGeometry(0.5, 0.45, 7).translate(0, 0.38, 0), 0xffffff),
      colored(new ConeGeometry(0.4, 0.38, 7).translate(0, 0.6, 0), 0xffffff),
      colored(new ConeGeometry(0.28, 0.32, 7).translate(0, 0.82, 0), 0xffffff),
      colored(new ConeGeometry(0.16, 0.12, 7).translate(0, 0.93, 0), 0xf4f8ff),
    ])!,
    mat: 'flat', tint: true,
  },
  rock: { geo: () => colored(jitter(new IcosahedronGeometry(0.5, 1).translate(0, 0.32, 0), 0.09, 11, false), 0xffffff), mat: 'flat', tint: true },
  mountain: {
    geo: () => heightColors(jitter(new ConeGeometry(0.5, 1, 11, 6).translate(0, 0.5, 0), 0.035, 21), [[0, 0x5a6578], [0.42, 0x6e7a8e], [0.58, 0xe6eef8], [0.7, 0xffffff]]),
    mat: 'flat',
  },
  cabin: {
    geo: () => mergeGeometries([colored(boxAt(1, 0.55, 1), 0x6a4a32), colored(new ConeGeometry(0.78, 0.45, 4).rotateY(Math.PI / 4).scale(1, 1, 0.92).translate(0, 0.77, 0), 0xf0f4fa)])!,
    mat: 'flat',
  },
  mesa: {
    geo: () => heightColors(jitter(new CylinderGeometry(0.42, 0.5, 1, 9, 5).translate(0, 0.5, 0), 0.03, 31), [[0, 0xa65a36], [0.25, 0xc0784a], [0.45, 0xb4643c], [0.62, 0xd09060], [0.8, 0xb46a40], [0.97, 0xc89060]]),
    mat: 'flat',
  },
  cactus: {
    geo: () => mergeGeometries([
      new CylinderGeometry(0.4, 0.45, 1, 7).translate(0, 0.5, 0),
      new CylinderGeometry(0.28, 0.3, 0.35, 6).translate(0.62, 0.55, 0),
      new CylinderGeometry(0.28, 0.3, 0.3, 6).rotateZ(Math.PI / 2).translate(0.4, 0.4, 0),
      new CylinderGeometry(0.26, 0.28, 0.28, 6).translate(-0.6, 0.62, 0),
      new CylinderGeometry(0.26, 0.28, 0.28, 6).rotateZ(Math.PI / 2).translate(-0.38, 0.5, 0),
    ].map((g) => colored(g, 0xffffff)))!,
    mat: 'flat', tint: true,
  },
  pad: { geo: () => boxAt(1, 1, 1), mat: 'matte', tint: true },
  container: { geo: () => boxAt(1, 1, 1), mat: 'metal', tint: true },
  crane: {
    geo: () => mergeGeometries([
      boxAt(1.6, 40, 1.6), boxAt(1.8, 1.6, 34, 0, 38, 10), boxAt(1.8, 1.4, 10, 0, 38.1, -9), boxAt(3.5, 3.4, 3.5, 0, 34.5),
      boxAt(2.4, 3, 2, 0, 35, -12), boxAt(0.3, 14, 0.3, 0, 24, 22),
    ].map((g) => g.toNonIndexed()))!,
    mat: 'metal', tint: true,
  },
  turbine: {
    geo: () => mergeGeometries([new CylinderGeometry(0.9, 1.7, 56, 10).translate(0, 28, 0), boxAt(2.4, 2.4, 6, 0, 55, 0.8)].map((g) => g.toNonIndexed()))!,
    mat: 'matte', tint: true,
  },
  chimney: {
    geo: () => mergeGeometries([
      colored(new CylinderGeometry(3.6, 5.5, 100, 12).translate(0, 50, 0), 0x8a8c90),
      colored(new CylinderGeometry(3.75, 3.75, 5, 12).translate(0, 84, 0), 0xc8382e),
      colored(new CylinderGeometry(3.75, 3.75, 5, 12).translate(0, 94, 0), 0xf0f0f0),
    ])!,
    mat: 'flat',
  },
  stand: {
    // raked seating under a cantilevered roof on two columns
    geo: () => {
      const g = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const pos = g.attributes.position!;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.5 && pos.getZ(i) > 0) pos.setY(i, 0.25);
      g.computeVertexNormals();
      return mergeGeometries([
        colored(g, 0xffffff),
        colored(boxAt(1.04, 0.04, 0.9, 0, 1.15, 0.02), 0xe9ebee),
        colored(boxAt(0.02, 1.15, 0.03, -0.45, 0, -0.42), 0xb8bcc2),
        colored(boxAt(0.02, 1.15, 0.03, 0.45, 0, -0.42), 0xb8bcc2),
      ])!;
    },
    mat: 'matte', tint: true,
  },
  lightTower: { geo: () => mergeGeometries([colored(boxAt(0.6, 34, 0.6), 0xb8bcc2), colored(boxAt(6, 3, 0.6, 0, 33), 0xe4e7ea)])!, mat: 'metal', tint: false },
};

/**
 * Procedural facades on building faces (world-space, anti-aliased, no textures): a curtain wall of glass
 * panes between slim mullions and spandrels, or punched windows in a stone / concrete frame. The pane
 * grid fades to its average colour once a cell gets smaller than a pixel, so distant towers never shimmer.
 * The instance colour is the glass tint (glass) or the wall colour (concrete). Roofs stay plain.
 */
function facadeMaterial(kind: 'glass' | 'concrete'): MeshStandardMaterial {
  const glass = kind === 'glass';
  const m = new MeshStandardMaterial({ roughness: glass ? 0.4 : 0.85, metalness: glass ? 0.2 : 0.0 });
  // column width, floor height, pane rectangle within a cell, pane colour multiplier
  const g = glass
    ? { col: '1.6', floor: '3.8', x0: '0.05', x1: '0.95', y0: '0.12', y1: '0.9', frame: 'vec3(0.62, 0.65, 0.68)' }
    : { col: '3.2', floor: '3.5', x0: '0.22', x1: '0.78', y0: '0.26', y1: '0.82', frame: 'diffuseColor.rgb' };
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying float vInst;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        mat4 bldM = modelMatrix;
        vInst = 0.0;
        #ifdef USE_INSTANCING
          bldM = modelMatrix * instanceMatrix;
          vInst = float(gl_InstanceID);
        #endif
        vWP = (bldM * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(bldM) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying float vInst;\nfloat whash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fWin = 0.0;
        if (abs(vWN.y) < 0.5) {
          vec2 hdir = normalize(vec2(-vWN.z, vWN.x));
          vec2 q = vec2(dot(vWP.xz, hdir) / ${g.col}, vWP.y / ${g.floor});
          vec2 fw = max(fwidth(q), vec2(1e-4));
          vec2 f = fract(q);
          float wx = smoothstep(${g.x0} - fw.x, ${g.x0} + fw.x, f.x) * (1.0 - smoothstep(${g.x1} - fw.x, ${g.x1} + fw.x, f.x));
          float wy = smoothstep(${g.y0} - fw.y, ${g.y0} + fw.y, f.y) * (1.0 - smoothstep(${g.y1} - fw.y, ${g.y1} + fw.y, f.y));
          float far = smoothstep(0.25, 0.7, max(fw.x, fw.y));
          fWin = mix(wx * wy, (${g.x1} - ${g.x0}) * (${g.y1} - ${g.y0}), far);
          // per-pane variation only while panes are big on screen (it would sparkle further away)
          float r = mix(0.5, whash(vec3(floor(q), vInst)), 1.0 - smoothstep(0.06, 0.2, max(fw.x, fw.y)));
          vec3 tint = diffuseColor.rgb;
          vec3 pane = ${glass ? 'tint * (0.9 + 0.18 * r)' : 'vec3(0.17, 0.2, 0.24) * (0.88 + 0.24 * r)'};
          diffuseColor.rgb = mix(${g.frame}, pane, fWin);
        } else {
          diffuseColor.rgb *= 0.78;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, fWin);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, fWin);');
  };
  m.customProgramCacheKey = () => `facade:${kind}`;
  return m;
}

/**
 * Instanced scenery: one InstancedMesh per prop kind (a dozen draw calls for thousands of props),
 * plus animated turbine rotors.
 */
export class Scenery {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];
  private rotors: InstancedMesh | null = null;
  private rotorBase: Array<{ p: Vector3; yaw: number; s: number; phase: number }> = [];
  constructor(props: readonly Prop[], _theme: ThemeDef) {
    const byKind = new Map<PropKind, Prop[]>();
    for (const p of props) {
      let l = byKind.get(p.kind);
      if (!l) byKind.set(p.kind, (l = []));
      l.push(p);
    }
    const matCache = new Map<string, Material>();
    const material = (kind: PropKind, def: KindDef): Material => {
      const vc = kind === 'lightTower' || kind === 'stand';
      const key = `${def.mat}:${vc}`;
      let m = matCache.get(key);
      if (m) return m;
      switch (def.mat) {
        case 'concrete': m = facadeMaterial('concrete'); break;
        case 'glass': m = facadeMaterial('glass'); break;
        case 'metal': m = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.4, vertexColors: vc }); break;
        case 'matte': m = new MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, vertexColors: vc }); break;
        case 'soft': m = new MeshStandardMaterial({ roughness: 0.9, metalness: 0.0, vertexColors: true }); break;
        default: m = new MeshStandardMaterial({ roughness: 0.95, metalness: 0.0, flatShading: true, vertexColors: true });
      }
      matCache.set(key, m);
      this.mats.push(m);
      return m;
    };

    for (const [kind, list] of byKind) {
      const def = KINDS[kind];
      const geo = def.geo();
      this.geos.push(geo);
      const mesh = new InstancedMesh(geo, material(kind, def), list.length);
      const uni = UNIFORM[kind];
      list.forEach((p, i) => {
        _q.setFromAxisAngle(UP, p.rot);
        if (uni) _s.setScalar(p.sy / uni);
        else _s.set(p.sx, p.sy, p.sz);
        _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
        mesh.setMatrixAt(i, _m);
        mesh.setColorAt(i, _c.setHex(def.tint === false ? 0xffffff : p.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      if (kind === 'turbine') this.addRotors(list);
    }
  }

  private addRotors(list: Prop[]): void {
    const blade = new BoxGeometry(1.2, 24, 0.35).translate(0, 12, 0);
    const parts = [0, 1, 2].map((k) => blade.clone().rotateZ((k * Math.PI * 2) / 3));
    const geo = mergeGeometries(parts)!;
    this.geos.push(geo);
    const mat = new MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.6 });
    this.mats.push(mat);
    this.rotors = new InstancedMesh(geo, mat, list.length);
    this.rotors.instanceMatrix.setUsage(DynamicDrawUsage);
    this.rotors.frustumCulled = false;
    this.rotorBase = list.map((p, i) => ({ p: new Vector3(p.x, p.y, p.z), yaw: p.rot, s: p.sy / 56, phase: i * 1.7 }));
    this.group.add(this.rotors);
    this.update(0);
  }

  update(time: number): void {
    if (this.rotors) {
      const qy = new Quaternion();
      const qz = new Quaternion();
      const hub = new Vector3();
      this.rotorBase.forEach((r, i) => {
        qy.setFromAxisAngle(UP, r.yaw);
        qz.setFromAxisAngle(new Vector3(0, 0, 1), time * 0.9 + r.phase);
        hub.set(0, 55 * r.s, -2.4 * r.s).applyQuaternion(qy).add(r.p);
        _m.compose(hub, qy.multiply(qz), _s.setScalar(r.s));
        this.rotors!.setMatrixAt(i, _m);
      });
      this.rotors.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
