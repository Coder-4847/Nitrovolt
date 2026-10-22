import { Vector3 } from 'three';
import { SurfaceId } from '../physics/Surface';
import { MeshKind, TrackMesh } from './TrackTypes';

/** A station along a swept path. `up` is the (possibly banked) surface normal. */
export interface Frame {
  p: Vector3;
  f: Vector3;
  u: Vector3;
  /** Distance travelled along the path (m), drives UV tiling. */
  s: number;
}

export type Profile = Array<[number, number]>; // [lateral (right+), vertical (up+)] metres

/** Accumulates triangles for one (kind, surface) bucket. */
export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];

  constructor(
    readonly kind: MeshKind,
    readonly surface: SurfaceId,
    readonly collide: boolean,
  ) {}

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(p: Vector3, n: Vector3, u: number, v: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }

  /** Quad A-B-C-D (any winding); winding is fixed so the face normal agrees with `outward`. */
  quad(
    a: Vector3, b: Vector3, c: Vector3, d: Vector3,
    na: Vector3, nb: Vector3, nc: Vector3, nd: Vector3,
    uvs: [number, number][],
    outward: Vector3,
  ): void {
    const ia = this.vert(a, na, uvs[0]![0], uvs[0]![1]);
    const ib = this.vert(b, nb, uvs[1]![0], uvs[1]![1]);
    const ic = this.vert(c, nc, uvs[2]![0], uvs[2]![1]);
    const id = this.vert(d, nd, uvs[3]![0], uvs[3]![1]);
    const e1 = new Vector3().subVectors(b, a);
    const e2 = new Vector3().subVectors(c, a);
    const faceN = e1.cross(e2);
    if (faceN.dot(outward) >= 0) this.idx.push(ia, ib, ic, ia, ic, id);
    else this.idx.push(ia, ic, ib, ia, id, ic);
  }

  /** Convex polygon cap fan, wound to face `outward`. */
  cap(points: Vector3[], normal: Vector3, uvs: [number, number][]): void {
    const base = this.vertexCount;
    for (let i = 0; i < points.length; i++) this.vert(points[i]!, normal, uvs[i]![0], uvs[i]![1]);
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0]!, b = points[i]!, c = points[i + 1]!;
      const fn = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      if (fn.dot(normal) >= 0) this.idx.push(base, base + i, base + i + 1);
      else this.idx.push(base, base + i + 1, base + i);
    }
  }

  /**
   * Sweep a convex cross-section along `frames`. Each profile edge becomes a smooth-shaded strip,
   * with hard edges between edges. UVs are in metres/4 so a grid texture stays square everywhere.
   */
  sweep(frames: Frame[], profileIn: Profile, caps = true): void {
    if (frames.length < 2) return;
    // ensure CCW (x right, y up)
    let area = 0;
    for (let i = 0; i < profileIn.length; i++) {
      const [x0, y0] = profileIn[i]!;
      const [x1, y1] = profileIn[(i + 1) % profileIn.length]!;
      area += x0 * y1 - x1 * y0;
    }
    const profile = area >= 0 ? profileIn : [...profileIn].reverse();
    const n = profile.length;

    // pre-compute profile points per frame
    const grid: Vector3[][] = frames.map((fr) => {
      const r = new Vector3().crossVectors(fr.f, fr.u).normalize();
      return profile.map(([x, y]) => new Vector3().copy(fr.p).addScaledVector(r, x).addScaledVector(fr.u, y));
    });
    const rights = frames.map((fr) => new Vector3().crossVectors(fr.f, fr.u).normalize());

    // cumulative perimeter for u coordinate
    const per: number[] = [0];
    for (let j = 0; j < n; j++) {
      const a = profile[j]!, b = profile[(j + 1) % n]!;
      per.push(per[j]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }

    const edgeN = (fi: number, j: number): Vector3 => {
      const a = profile[j]!, b = profile[(j + 1) % n]!;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = dy / len, ny = -dx / len; // outward for CCW
      return new Vector3().addScaledVector(rights[fi]!, nx).addScaledVector(frames[fi]!.u, ny).normalize();
    };

    for (let i = 0; i < frames.length - 1; i++) {
      const s0 = frames[i]!.s / 4, s1 = frames[i + 1]!.s / 4;
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n;
        const n0 = edgeN(i, j), n1 = edgeN(i + 1, j);
        const A = grid[i]![j]!, B = grid[i]![j2]!, C = grid[i + 1]![j2]!, D = grid[i + 1]![j]!;
        this.quad(A, B, C, D, n0, n0, n1, n1, [
          [per[j]! / 4, s0], [per[j + 1]! / 4, s0], [per[j + 1]! / 4, s1], [per[j]! / 4, s1],
        ], n0);
      }
    }
    if (caps) {
      const first = frames[0]!, last = frames[frames.length - 1]!;
      const uvs = profile.map(([x, y]): [number, number] => [x / 4, y / 4]);
      this.cap(grid[0]!, new Vector3().copy(first.f).negate(), uvs);
      this.cap(grid[frames.length - 1]!, new Vector3().copy(last.f), uvs);
    }
  }

  build(): TrackMesh {
    return {
      kind: this.kind,
      surface: this.surface,
      collide: this.collide,
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nor),
      uvs: new Float32Array(this.uv),
      indices: new Uint32Array(this.idx),
    };
  }
}
