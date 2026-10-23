import { BoxGeometry, BufferGeometry, CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from '../../tracks/Terrain';
import { RoadSample, TerrainData } from '../../tracks/TrackTypes';

/** Metres from the road surface down to the underside of the slab. */
const SLAB = 1.0;

/**
 * Concrete support columns under raised road, every ~24 m along the driving line, from the terrain to the
 * slab (a pair under wide road). Skipped on loops, half-pipes and jump gaps, wherever the ground already
 * carries the road, and wherever another stretch of road runs underneath. Render-only.
 */
export function buildPillars(centerline: readonly Vector3[], frames: readonly RoadSample[], terrain: TerrainData): InstancedMesh | null {
  const spots: Array<{ x: number; z: number; y: number; yaw: number; h: number }> = [];
  let acc = 0;
  for (let i = 1; i < centerline.length - 1; i++) {
    const a = centerline[i - 1]!, p = centerline[i]!, b = centerline[i + 1]!;
    const f = frames[i]!;
    const seg = Math.hypot(p.x - a.x, p.z - a.z);
    if (seg > 20 || f.kind !== 'road' || f.u.y < 0.85) { acc = 0; continue; }
    acc += seg;
    if (acc < 24) continue;
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 0.5) continue;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const offs = f.hw >= 10 ? [-f.hw * 0.55, f.hw * 0.55] : [0];
    let placed = false;
    for (const o of offs) {
      const x = p.x + f.r.x * o, z = p.z + f.r.z * o;
      const top = p.y + f.r.y * o - SLAB;
      const g = terrainHeight(terrain, x, z);
      const h = top - g;
      if (h < 2.5) continue;
      // nothing else may run through the column
      let blocked = false;
      for (let j = 0; j < centerline.length && !blocked; j++) {
        if (Math.abs(j - i) < 10) continue;
        const q = centerline[j]!;
        if (Math.hypot(q.x - x, q.z - z) < (frames[j]?.hw ?? 8) + 2 && q.y < top - 1 && q.y > g - 1) blocked = true;
      }
      if (blocked) continue;
      spots.push({ x, z, y: g - 0.5, yaw, h: h + 0.5 });
      placed = true;
    }
    if (placed) acc = 0;
  }
  if (!spots.length) return null;
  // unit-height column with a cap and a footing, scaled to each spot
  const geo: BufferGeometry = mergeGeometries([
    new CylinderGeometry(0.9, 1.0, 1, 14).translate(0, 0.5, 0),
    new BoxGeometry(3.2, 0.04, 2.4).translate(0, 0.98, 0),
  ])!;
  const mat = new MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 });
  const mesh = new InstancedMesh(geo, mat, spots.length);
  const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), pos = new Vector3();
  spots.forEach((sp, i) => {
    q.setFromAxisAngle(new Vector3(0, 1, 0), sp.yaw);
    s.set(1, sp.h, 1);
    m.compose(pos.set(sp.x, sp.y, sp.z), q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
