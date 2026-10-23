import {
  BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Material,
  Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/Rng';
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
  geo: (snow: boolean) => BufferGeometry;
  /** flat: faceted vertex colours; soft: smooth vertex colours. */
  mat: 'flat' | 'soft';
  /** Instance colour tints the vertex colours (false = vertex colours only). */
  tint?: boolean;
}

/** A conifer: trunk and five jittered tiers of foliage (white tips in winter). */
function pineGeometry(snow: boolean): BufferGeometry {
  const parts = [colored(new CylinderGeometry(0.05, 0.08, 0.3, 7).translate(0, 0.15, 0), 0x4a3424)];
  const tiers: Array<[number, number, number]> = [[0.5, 0.36, 0.3], [0.42, 0.32, 0.46], [0.34, 0.28, 0.61], [0.25, 0.24, 0.75], [0.15, 0.2, 0.88]];
  tiers.forEach(([r, h, y], i) => {
    const cone = jitter(new ConeGeometry(r, h, 9, 1).translate(0, y, 0), 0.025, 31 + i, false);
    parts.push(colored(cone, snow && i % 2 === 1 ? 0xeef3f8 : 0xffffff));
  });
  if (snow) parts.push(colored(new ConeGeometry(0.09, 0.1, 8).translate(0, 0.98, 0), 0xf4f8fc));
  return mergeGeometries(parts)!;
}

/** Stepped sand terrace (canyon): stacked, slightly irregular tiers with darker risers. */
function terraceGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const r = 0.5 - i * 0.085;
    const g = jitter(new CylinderGeometry(r * 0.97, r, 1 / tiers, 14, 1).translate(0, (i + 0.5) / tiers, 0), 0.012, 61 + i);
    parts.push(colored(g, i % 2 ? 0xf2e2c8 : 0xffffff));
  }
  return mergeGeometries(parts)!;
}

const KINDS: Record<PropKind, KindDef> = {
  tree: {
    geo: () => mergeGeometries([
      colored(new CylinderGeometry(0.05, 0.07, 0.42, 6).translate(0, 0.21, 0), 0x5a4634),
      colored(jitter(new IcosahedronGeometry(0.42, 1).scale(1, 0.9, 1).translate(0, 0.62, 0), 0.05, 5, false), 0xffffff),
      colored(jitter(new IcosahedronGeometry(0.26, 1).translate(0.18, 0.82, 0.05), 0.04, 9, false), 0xf0f4ea),
    ])!,
    mat: 'soft', tint: true,
  },
  pine: { geo: (snow) => pineGeometry(snow), mat: 'soft', tint: true },
  rock: { geo: () => colored(jitter(new IcosahedronGeometry(0.5, 1).translate(0, 0.32, 0), 0.09, 11, false), 0xffffff), mat: 'flat', tint: true },
  mountain: {
    geo: () => heightColors(jitter(new ConeGeometry(0.5, 1, 18, 8).translate(0, 0.5, 0), 0.03, 21), [[0, 0x5a6578], [0.4, 0x6e7a8e], [0.56, 0xe6eef8], [0.68, 0xffffff]]),
    mat: 'flat',
  },
  mesa: {
    geo: () => heightColors(jitter(new CylinderGeometry(0.42, 0.5, 1, 12, 6).translate(0, 0.5, 0), 0.03, 31), [[0, 0xa65a36], [0.25, 0xc0784a], [0.45, 0xb4643c], [0.62, 0xd09060], [0.8, 0xb46a40], [0.97, 0xc89060]]),
    mat: 'flat',
  },
  cactus: {
    geo: () => mergeGeometries([
      new CylinderGeometry(0.4, 0.45, 1, 8).translate(0, 0.5, 0),
      new CylinderGeometry(0.28, 0.3, 0.35, 7).translate(0.62, 0.55, 0),
      new CylinderGeometry(0.28, 0.3, 0.3, 7).rotateZ(Math.PI / 2).translate(0.4, 0.4, 0),
      new CylinderGeometry(0.26, 0.28, 0.28, 7).translate(-0.6, 0.62, 0),
      new CylinderGeometry(0.26, 0.28, 0.28, 7).rotateZ(Math.PI / 2).translate(-0.38, 0.5, 0),
    ].map((g) => colored(g, 0xffffff)))!,
    mat: 'soft', tint: true,
  },
  terrace: { geo: () => terraceGeometry(), mat: 'flat', tint: true },
  hill: { geo: () => colored(new SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff), mat: 'soft', tint: true },
};

/** Instanced scenery: one InstancedMesh per prop kind (a handful of draw calls for thousands of props). */
export class Scenery {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];

  constructor(props: readonly Prop[], theme: ThemeDef) {
    const snow = theme.arena.snow;
    const byKind = new Map<PropKind, Prop[]>();
    for (const p of props) {
      let l = byKind.get(p.kind);
      if (!l) byKind.set(p.kind, (l = []));
      l.push(p);
    }
    const flat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0.0, flatShading: true, vertexColors: true });
    const soft = new MeshStandardMaterial({ roughness: 0.9, metalness: 0.0, vertexColors: true });
    this.mats.push(flat, soft);
    for (const [kind, list] of byKind) {
      const def = KINDS[kind];
      const geo = def.geo(snow);
      this.geos.push(geo);
      const mesh = new InstancedMesh(geo, def.mat === 'flat' ? flat : soft, list.length);
      list.forEach((p, i) => {
        _q.setFromAxisAngle(UP, p.rot);
        _s.set(p.sx, p.sy, p.sz);
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
    }
  }

  update(_time: number): void {}

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
