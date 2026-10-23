import { BoxGeometry, BufferGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';

/** Metres from the driving line down to the underside of the road slab. */
const SLAB = 0.9;

/**
 * Concrete support columns under raised road, every ~14 m along the driving line, from the ground to the
 * slab. Skipped on steep or curling sections (loops, wall-rides) and wherever another stretch of road
 * runs underneath. Render-only: there is nothing to hit.
 */
export function buildPillars(centerline: readonly Vector3[], groundY: number): InstancedMesh | null {
  const spots: Array<{ p: Vector3; yaw: number; h: number }> = [];
  let acc = 0;
  for (let i = 1; i < centerline.length - 1; i++) {
    const a = centerline[i - 1]!, p = centerline[i]!, b = centerline[i + 1]!;
    const seg = Math.hypot(p.x - a.x, p.z - a.z);
    if (seg > 20) { acc = 0; continue; } // a jump gap
    acc += seg;
    if (acc < 14) continue;
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 0.5 || Math.abs(b.y - a.y) / run > 0.35) continue;
    const top = p.y - SLAB;
    const h = top - groundY;
    if (h < 2.5) continue;
    // nothing else may run through the column
    let blocked = false;
    for (let j = 0; j < centerline.length && !blocked; j++) {
      if (Math.abs(j - i) < 6) continue;
      const q = centerline[j]!;
      if (Math.hypot(q.x - p.x, q.z - p.z) < 9 && q.y < top - 1 && q.y > groundY - 1) blocked = true;
    }
    if (blocked) continue;
    acc = 0;
    spots.push({ p, yaw: Math.atan2(b.x - a.x, b.z - a.z), h });
  }
  if (!spots.length) return null;
  // unit-height column, scaled to each spot
  const geo: BufferGeometry = new BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0);
  const mat = new MeshStandardMaterial({ color: 0x8d939b, roughness: 0.85 });
  const mesh = new InstancedMesh(geo, mat, spots.length);
  const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), pos = new Vector3();
  spots.forEach((sp, i) => {
    q.setFromAxisAngle(new Vector3(0, 1, 0), sp.yaw);
    s.set(1, sp.h, 1);
    m.compose(pos.set(sp.p.x, groundY, sp.p.z), q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
