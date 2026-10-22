import { Matrix4, Quaternion, Vector3 } from 'three';
import { SurfaceId } from '../physics/Surface';
import { Frame, MeshBuilder, Profile } from './MeshBuilder';
import { Pose, TrackData, TrackMesh } from './TrackTypes';

export type WallSide = 'none' | 'left' | 'right' | 'both';

export interface RoadOpts {
  width?: number;
  surface?: SurfaceId;
  walls?: WallSide;
  wallHeight?: number;
  thickness?: number;
  /** Max distance between frames. */
  step?: number;
}

const DEG = Math.PI / 180;
const smooth = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * "Turtle" track builder: keeps a position + orientation, and sweeps road ribbons along
 * straights, flat arcs, pitch arcs and loops. Banking is applied only to the emitted
 * cross-sections, so the underlying path stays simple.
 */
export class TrackBuilder {
  p = new Vector3();
  f = new Vector3(0, 0, -1);
  u = new Vector3(0, 1, 0);
  s = 0;

  private builders = new Map<string, MeshBuilder>();
  readonly centerline: Vector3[] = [];
  readonly centerSurface: SurfaceId[] = [];
  readonly checkpoints: Pose[] = [];
  private readonly defaults: Required<RoadOpts> = {
    width: 14,
    surface: 'tarmac',
    walls: 'none',
    wallHeight: 1.1,
    thickness: 0.9,
    step: 2.5,
  };

  setDefaults(o: RoadOpts): void {
    Object.assign(this.defaults, o);
  }

  get right(): Vector3 {
    return new Vector3().crossVectors(this.f, this.u).normalize();
  }

  private builder(kind: 'road' | 'wall' | 'deco', surface: SurfaceId): MeshBuilder {
    const key = `${kind}:${surface}`;
    let b = this.builders.get(key);
    if (!b) {
      b = new MeshBuilder(kind, surface, kind !== 'deco');
      this.builders.set(key, b);
    }
    return b;
  }

  // ---------------------------------------------------------------- turtle primitives

  private rotateAbout(axis: Vector3, ang: number): void {
    if (ang === 0) return;
    const q = new Quaternion().setFromAxisAngle(axis, ang);
    this.f.applyQuaternion(q).normalize();
    this.u.applyQuaternion(q).normalize();
    // re-orthogonalise
    const r = new Vector3().crossVectors(this.f, this.u).normalize();
    this.u.crossVectors(r, this.f).normalize();
  }

  /** Advance `ds` metres while rotating by yaw (about up, + = left) and pitch (about right, + = nose up). */
  private advance(ds: number, yaw: number, pitch: number): void {
    const turn = (k: number): void => {
      this.rotateAbout(this.u.clone(), yaw * k);
      this.rotateAbout(this.right, pitch * k);
    };
    turn(0.5);
    this.p.addScaledVector(this.f, ds);
    turn(0.5);
    this.s += ds;
  }

  private frame(bank = 0): Frame {
    let u = this.u.clone();
    if (bank !== 0) {
      const r = this.right;
      u = u.multiplyScalar(Math.cos(bank)).addScaledVector(r, Math.sin(bank)).normalize();
    }
    return { p: this.p.clone(), f: this.f.clone(), u, s: this.s };
  }

  /** Teleport forward without any geometry (a jump gap), optionally dropping/rising and re-pitching. */
  gap(length: number, drop = 0, newPitchDeg?: number): void {
    const horiz = this.f.clone().setY(0).normalize();
    this.p.addScaledVector(horiz, length);
    this.p.y -= drop;
    this.s += length;
    if (newPitchDeg !== undefined) {
      const pitch = newPitchDeg * DEG;
      this.f.copy(horiz).multiplyScalar(Math.cos(pitch));
      this.f.y = Math.sin(pitch);
      this.f.normalize();
      const r = new Vector3().crossVectors(this.f, new Vector3(0, 1, 0)).normalize();
      this.u.crossVectors(r, this.f).normalize();
    }
    this.centerline.push(this.p.clone());
    this.centerSurface.push('tarmac');
  }

  // ---------------------------------------------------------------- road emission

  private roadProfile(o: Required<RoadOpts>): Profile {
    const w = o.width / 2;
    return [[-w, 0], [w, 0], [w, -o.thickness], [-w, -o.thickness]];
  }

  private emit(frames: Frame[], o: Required<RoadOpts>): void {
    this.builder('road', o.surface).sweep(frames, this.roadProfile(o));
    if (o.walls !== 'none') {
      const w = o.width / 2;
      const th = 0.7;
      const h = o.wallHeight;
      const wallSurface: SurfaceId = 'tarmac';
      const mk = (side: 1 | -1): void => {
        const x0 = side * w;
        const x1 = side * (w + th);
        // walls extend slightly below the road surface so there is no gap at the seam
        const prof: Profile = [[x0, -0.3], [x1, -0.3], [x1, h], [x0, h]];
        this.builder('wall', wallSurface).sweep(frames, prof);
      };
      if (o.walls === 'left' || o.walls === 'both') mk(-1);
      if (o.walls === 'right' || o.walls === 'both') mk(1);
    }
    for (const fr of frames) {
      this.centerline.push(fr.p.clone());
      this.centerSurface.push(o.surface);
    }
  }

  private opts(o?: RoadOpts): Required<RoadOpts> {
    return { ...this.defaults, ...o };
  }

  straight(length: number, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const n = Math.max(1, Math.ceil(length / o.step));
    const frames: Frame[] = [this.frame()];
    for (let i = 0; i < n; i++) {
      this.advance(length / n, 0, 0);
      frames.push(this.frame());
    }
    this.emit(frames, o);
  }

  /** Flat (or slope-following) arc. angleDeg > 0 turns left. `bankDeg` is tilt toward the inside. */
  arc(radius: number, angleDeg: number, bankDeg = 0, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const total = Math.abs(angleDeg) * DEG * radius;
    const n = Math.max(2, Math.ceil(total / Math.min(o.step, radius * 0.12)));
    const dir = Math.sign(angleDeg);
    const yawPer = (dir * total) / radius / n;
    const ds = total / n;
    const frames: Frame[] = [this.frame(0)];
    for (let i = 1; i <= n; i++) {
      this.advance(ds, yawPer, 0);
      const t = i / n;
      // ease the bank in over the first 25% and out over the last 25%
      const e = Math.min(smooth(Math.min(1, t / 0.25)), smooth(Math.min(1, (1 - t) / 0.25)));
      // positive roll about forward tilts the right side down => right turns bank positive
      frames.push(this.frame(-dir * bankDeg * DEG * e));
    }
    this.emit(frames, o);
  }

  /** Smooth vertical curve: change slope by `deltaDeg` (+ = nose up) with the given radius. */
  pitch(deltaDeg: number, radius: number, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const total = Math.abs(deltaDeg) * DEG * radius;
    const n = Math.max(2, Math.ceil(total / Math.min(o.step, radius * 0.12)));
    const per = (Math.sign(deltaDeg) * total) / radius / n;
    const ds = total / n;
    const frames: Frame[] = [this.frame()];
    for (let i = 0; i < n; i++) {
      this.advance(ds, 0, per);
      frames.push(this.frame());
    }
    this.emit(frames, o);
  }

  /**
   * Full vertical loop. The exit is displaced sideways by `shift` metres so the ring clears the
   * run-up; heading and up vector are restored exactly at the exit.
   */
  loop(radius: number, shift: number, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const f0 = this.f.clone(), u0 = this.u.clone(), r0 = this.right, p0 = this.p.clone();
    const n = Math.ceil((2 * Math.PI * radius) / 1.6);
    const frames: Frame[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * 2 * Math.PI;
      const k = i / n;
      const ss = smooth(k);
      const dss = (30 * k * k * (1 - k) * (1 - k)) / (2 * Math.PI); // d(smootherstep)/dt
      const pos = p0.clone()
        .addScaledVector(f0, radius * Math.sin(t))
        .addScaledVector(u0, radius * (1 - Math.cos(t)))
        .addScaledVector(r0, shift * ss);
      const tan = new Vector3()
        .addScaledVector(f0, radius * Math.cos(t))
        .addScaledVector(u0, radius * Math.sin(t))
        .addScaledVector(r0, shift * dss)
        .normalize();
      const uc = new Vector3().addScaledVector(f0, -Math.sin(t)).addScaledVector(u0, Math.cos(t));
      const up = uc.addScaledVector(tan, -uc.dot(tan)).normalize();
      frames.push({ p: pos, f: tan, u: up, s: this.s + (i / n) * 2 * Math.PI * radius });
    }
    this.s += 2 * Math.PI * radius;
    this.p.copy(p0).addScaledVector(r0, shift);
    this.f.copy(f0);
    this.u.copy(u0);
    this.emit(frames, { ...o, walls: o.walls });
  }

  // ---------------------------------------------------------------- misc

  /** Record the current turtle pose as a checkpoint (respawn point). */
  checkpoint(): void {
    this.checkpoints.push(this.pose());
  }

  pose(): Pose {
    const r = this.right;
    const m = new Matrix4().makeBasis(r, this.u, this.f.clone().negate());
    const q = new Quaternion().setFromRotationMatrix(m);
    return { position: this.p.clone().addScaledVector(this.u, 0.75), quaternion: q };
  }

  /** Place the turtle explicitly. Heading is `yawDeg` about +Y (0 = north / -Z, + = left). */
  place(position: Vector3, yawDeg = 0): void {
    this.p.copy(position);
    const y = yawDeg * DEG;
    this.f.set(-Math.sin(y), 0, -Math.cos(y));
    this.u.set(0, 1, 0);
    this.s = 0;
  }

  /** A flat decorative box (finish arch posts, markers) placed relative to the turtle. */
  deco(width: number, height: number, depth: number, sideOffset: number, surface: SurfaceId = 'tech'): void {
    const b = this.builder('deco', surface);
    const r = this.right;
    const centre = this.p.clone().addScaledVector(r, sideOffset).addScaledVector(this.u, height / 2);
    const fr = (z: number): Frame => ({ p: centre.clone().addScaledVector(this.f, z), f: this.f.clone(), u: this.u.clone(), s: z });
    const prof: Profile = [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]];
    b.sweep([fr(-depth / 2), fr(depth / 2)], prof);
  }

  finish(id: string, name: string, start: Pose, killY: number): TrackData {
    const meshes: TrackMesh[] = [];
    for (const b of this.builders.values()) meshes.push(b.build());
    return { id, name, meshes, start, checkpoints: this.checkpoints, killY, centerline: this.centerline, centerSurface: this.centerSurface };
  }
}
