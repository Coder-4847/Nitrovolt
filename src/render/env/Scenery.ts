import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, Material, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/Rng';
import { Prop, PropKind } from './SceneryPlan';

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
  mat: 'building' | 'matte' | 'flat' | 'glow' | 'metal';
  /** Instance colour tints the vertex colours (false = vertex colours only). */
  tint?: boolean;
}

const KINDS: Record<PropKind, KindDef> = {
  building: { geo: () => boxAt(1, 1, 1), mat: 'building', tint: true },
  skyscraper: { geo: () => mergeGeometries([boxAt(1, 0.82, 1), boxAt(0.78, 0.14, 0.78, 0, 0.82), boxAt(0.42, 0.04, 0.42, 0, 0.96)])!, mat: 'building', tint: true },
  neonBar: { geo: () => mergeGeometries([boxAt(1, 1, 0.04, 0, 0, 0.5), boxAt(1, 1, 0.04, 0, 0, -0.5), boxAt(0.04, 1, 1, 0.5), boxAt(0.04, 1, 1, -0.5)])!, mat: 'glow', tint: true },
  billboard: {
    geo: () => mergeGeometries([colored(boxAt(0.05, 0.55, 0.3, -0.35), 0x30344a), colored(boxAt(0.05, 0.55, 0.3, 0.35), 0x30344a), colored(boxAt(1, 0.45, 1, 0, 0.55), 0xffffff)])!,
    mat: 'glow', tint: true,
  },
  beacon: { geo: () => new SphereGeometry(0.5, 8, 6), mat: 'glow', tint: true },
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
    geo: () => {
      const g = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const pos = g.attributes.position!;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.5 && pos.getZ(i) > 0) pos.setY(i, 0.25);
      g.computeVertexNormals();
      return g;
    },
    mat: 'matte', tint: true,
  },
  lightTower: { geo: () => mergeGeometries([colored(boxAt(0.6, 34, 0.6), 0xcfd6e0), colored(boxAt(6, 3, 0.6, 0, 33), 0xffffff)])!, mat: 'glow', tint: false },
};

/** Night windows on building faces, lit at random per instance and floor (world-space, no textures). */
function buildingMaterial(glow: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ roughness: 0.85, metalness: 0.15 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = { value: glow };
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying float vInst; uniform float uWin;\nfloat whash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vWN.y) < 0.5 && uWin > 0.0) {
          float hcoord = dot(vWP.xz, normalize(vec2(-vWN.z, vWN.x)));
          vec2 cell = floor(vec2(hcoord / 3.2, vWP.y / 3.8));
          vec2 f = fract(vec2(hcoord / 3.2, vWP.y / 3.8));
          float win = step(0.16, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.74);
          float r = whash(vec3(cell, vInst));
          float lit = step(0.64, r);
          vec3 wc = mix(vec3(1.0, 0.72, 0.42), vec3(0.45, 0.85, 1.0), step(0.85, r));
          totalEmissiveRadiance += wc * win * lit * uWin * (0.6 + 0.8 * fract(r * 7.0));
          diffuseColor.rgb *= 1.0 - win * 0.35;
        }`);
  };
  return m;
}

/**
 * Instanced scenery: one InstancedMesh per prop kind (a dozen draw calls for thousands of props),
 * plus animated turbine rotors and blinking beacons.
 */
export class Scenery {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];
  private rotors: InstancedMesh | null = null;
  private rotorBase: Array<{ p: Vector3; yaw: number; s: number; phase: number }> = [];
  private beaconMat: MeshBasicMaterial | null = null;

  constructor(props: readonly Prop[], opts: { night: boolean }) {
    const byKind = new Map<PropKind, Prop[]>();
    for (const p of props) {
      let l = byKind.get(p.kind);
      if (!l) byKind.set(p.kind, (l = []));
      l.push(p);
    }
    const matCache = new Map<string, Material>();
    const material = (kind: PropKind, def: KindDef): Material => {
      const key = kind === 'beacon' ? 'beacon' : def.mat;
      let m = matCache.get(key);
      if (m) return m;
      switch (def.mat) {
        case 'building': m = buildingMaterial(opts.night ? 0.85 : 0); break;
        case 'glow': m = new MeshBasicMaterial({ color: new Color(2.2, 2.2, 2.2), vertexColors: kind === 'billboard' || kind === 'lightTower' }); break;
        case 'metal': m = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.45 }); break;
        case 'matte': m = new MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 }); break;
        default: m = new MeshStandardMaterial({ roughness: 0.95, metalness: 0.0, flatShading: true, vertexColors: true });
      }
      if (kind === 'beacon') this.beaconMat = m as MeshBasicMaterial;
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
    if (this.beaconMat) {
      const on = Math.sin(time * 3.2) > 0.2 ? 3 : 0.25;
      this.beaconMat.color.setRGB(on, on, on);
    }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
