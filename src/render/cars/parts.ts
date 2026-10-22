import {
  BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Quaternion, Shape, TorusGeometry, Vector3,
} from 'three';

/** Shared look: livery-driven paint and accent plus neutral dark / glass. */
export interface CarMaterials {
  paint: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  glass: MeshStandardMaterial;
}

export function makeMaterials(primary: number, accent: number): CarMaterials {
  return {
    paint: new MeshStandardMaterial({ color: primary, roughness: 0.34, metalness: 0.5 }),
    accent: new MeshStandardMaterial({ color: accent, emissive: new Color(accent), emissiveIntensity: 1.2, roughness: 0.4 }),
    dark: new MeshStandardMaterial({ color: 0x15171c, roughness: 0.65, metalness: 0.3 }),
    glass: new MeshStandardMaterial({ color: 0x0b1018, roughness: 0.05, metalness: 0.9 }),
  };
}

export type TyreKind = 'sport' | 'knobby' | 'studded' | 'balloon';

export interface CarModel {
  body: Group;
  /** Parts hidden in the hood camera so they do not block the view. */
  cockpitHidden: Object3D[];
  tyre: TyreKind;
  /** Tyre width (m). */
  tyreWidth: number;
}

/** Extrude a side-profile polygon (x = forward, y = up) to a width, centred on X = 0. */
export function sideExtrude(points: Array<[number, number]>, width: number, bevel = 0.05): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i]![0], points[i]![1]);
  shape.closePath();
  const g = new ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.rotateY(Math.PI / 2); // shape-x -> -Z (forward), extrude-z -> +X
  g.translate(-(width - bevel * 2) / 2, 0, 0);
  return g;
}

export const box = (w: number, h: number, d: number, mat: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0): Mesh => {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

/** A cylinder between two points (roll-cage tubes, struts). */
export function tube(a: [number, number, number], b: [number, number, number], radius: number, mat: MeshStandardMaterial): Mesh {
  const pa = new Vector3(...a), pb = new Vector3(...b);
  const len = pa.distanceTo(pb);
  const m = new Mesh(new CylinderGeometry(radius, radius, len, 8), mat);
  m.position.copy(pa).add(pb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), pb.sub(pa).normalize());
  return m;
}

/** Wheel + tyre in the style of the car. The returned group spins about its local X axis. */
export function makeWheel(kind: TyreKind, radius: number, width: number, outer: -1 | 1, mats: CarMaterials): Group {
  const spin = new Group();
  const tyreMat = new MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.92 });
  const hubMat = new MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.3, metalness: 0.9 });
  const tyre = new Mesh(new CylinderGeometry(radius, radius, width, 28).rotateZ(Math.PI / 2), tyreMat);
  spin.add(tyre);
  const rimR = kind === 'balloon' ? radius * 0.46 : kind === 'sport' ? radius * 0.64 : radius * 0.55;
  const hub = new Mesh(new CylinderGeometry(rimR, rimR, width + 0.02, 20).rotateZ(Math.PI / 2), hubMat);
  spin.add(hub);
  const rim = new Mesh(new TorusGeometry(rimR, 0.025, 6, 24).rotateY(Math.PI / 2), mats.accent);
  rim.position.x = outer * (width / 2 - 0.01);
  spin.add(rim);
  for (let s = 0; s < 3; s++) {
    const spoke = box(width + 0.04, rimR * 1.8, 0.05, mats.paint);
    spoke.rotation.x = (s * Math.PI) / 3;
    spin.add(spoke);
  }
  if (kind !== 'sport') {
    // tread blocks / studs / paddles so the rolling wheel reads at speed
    const n = kind === 'balloon' ? 14 : kind === 'knobby' ? 22 : 26;
    const blockW = kind === 'balloon' ? width * 0.92 : width * 0.8;
    const blockH = kind === 'studded' ? 0.05 : 0.07;
    const blockD = kind === 'studded' ? 0.05 : 0.09;
    const block = new InstancedMesh(new BoxGeometry(blockW, blockH, blockD), kind === 'studded' ? hubMat : tyreMat, n * (kind === 'studded' ? 2 : 1));
    const m = new Matrix4();
    const q = new Quaternion();
    const rows = kind === 'studded' ? [-width * 0.25, width * 0.25] : [0];
    let i = 0;
    for (const dx of rows) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (dx > 0 ? Math.PI / n : 0);
        q.setFromAxisAngle(new Vector3(1, 0, 0), a);
        m.compose(new Vector3(dx, Math.cos(a) * (radius + blockH / 2 - 0.01), Math.sin(a) * (radius + blockH / 2 - 0.01)), q, new Vector3(1, 1, 1));
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
