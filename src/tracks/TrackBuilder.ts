import { Matrix4, Quaternion, Vector3 } from 'three';
import { EffectId, SurfaceId } from '../physics/Surface';
import { Frame, MeshBuilder, Profile } from './MeshBuilder';
import { Pose, TrackData, TrackMesh, TrackTrigger, TriggerKind } from './TrackTypes';

export type WallSide = 'none' | 'left' | 'right' | 'both';

export interface RoadOpts {
  width?: number;
  surface?: SurfaceId;
  /** Special-block behaviour painted on this road piece. */
  effect?: EffectId;
  walls?: WallSide;
  wallHeight?: number;
  thickness?: number;
  /** Max distance between frames. */
  step?: number;
}

type ResolvedOpts = Required<Omit<RoadOpts, 'effect'>> & { effect: EffectId | undefined };

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
  readonly triggers: TrackTrigger[] = [];
  /** Unique id for the block being built (fragile blocks break per block). */
  blockId = 0;
  private readonly defaults: Required<Omit<RoadOpts, 'effect'>> & { effect: EffectId | undefined } = {
    width: 14,
    surface: 'tarmac',
    effect: undefined,
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

  private builder(kind: 'road' | 'wall' | 'deco', surface: SurfaceId, effect?: EffectId, tint?: number): MeshBuilder {
    const fragile = effect === 'fragile';
    const key = `${kind}:${surface}:${effect ?? ''}${fragile ? ':' + this.blockId : ''}:${tint ?? ''}`;
    let b = this.builders.get(key);
    if (!b) {
      b = new MeshBuilder(kind, surface, kind !== 'deco', effect, fragile ? this.blockId : -1, tint);
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

  private roadProfile(o: ResolvedOpts): Profile {
    const w = o.width / 2;
    return [[-w, 0], [w, 0], [w, -o.thickness], [-w, -o.thickness]];
  }

  private emit(frames: Frame[], o: ResolvedOpts): void {
    this.builder('road', o.surface, o.effect).sweep(frames, this.roadProfile(o));
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

  private opts(o?: RoadOpts): ResolvedOpts {
    return { ...this.defaults, ...o } as ResolvedOpts;
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
    const n = Math.max(2, Math.ceil(total / Math.min(bankDeg > 0 ? Math.min(o.step, 1.2) : o.step, radius * 0.12)));
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

  // ---------------------------------------------------------------- block-library primitives

  /** Level the nose to an absolute pitch (degrees) without moving. Used for landing-ramp entries. */
  setPitch(deg: number): void {
    const horiz = this.f.clone().setY(0).normalize();
    const pitch = deg * DEG;
    this.f.copy(horiz).multiplyScalar(Math.cos(pitch));
    this.f.y = Math.sin(pitch);
    this.f.normalize();
    const r = new Vector3().crossVectors(this.f, new Vector3(0, 1, 0)).normalize();
    this.u.crossVectors(r, this.f).normalize();
  }

  /**
   * Smooth slope covering `forward` m of ground and `rise` m of height (negative = down).
   * `arcs` = 2: level -> slope -> level. `arcs` = 1 with rise > 0: level -> ramp that exits pitched up
   * (jump ramp). `arcs` = 1 with rise < 0: starts pitched down and levels out (landing).
   */
  slope(forward: number, rise: number, radius: number, arcs: 1 | 2, opts?: RoadOpts): void {
    const { theta, straight } = solveSlope(forward, Math.abs(rise), radius, arcs);
    const deg = theta / DEG;
    const up = rise >= 0;
    if (arcs === 2) {
      this.pitch(up ? deg : -deg, radius, opts);
      if (straight > 1e-3) this.straight(straight, opts);
      this.pitch(up ? -deg : deg, radius, opts);
    } else if (up) {
      this.pitch(deg, radius, opts);
      if (straight > 1e-3) this.straight(straight, opts);
    } else {
      this.setPitch(-deg);
      if (straight > 1e-3) this.straight(straight, opts);
      this.pitch(deg, radius, opts);
    }
  }

  /** Straight whose cross-section rolls to `bankDeg` (toward the right when positive) and back. */
  straightBanked(length: number, bankDeg: number, opts?: RoadOpts, ramp = 0.3): void {
    const o = this.opts(opts);
    const n = Math.max(2, Math.ceil(length / Math.min(o.step, 1.0)));
    const frames: Frame[] = [this.frame(0)];
    for (let i = 1; i <= n; i++) {
      this.advance(length / n, 0, 0);
      const t = i / n;
      const e = Math.min(smooth(Math.min(1, t / ramp)), smooth(Math.min(1, (1 - t) / ramp)));
      frames.push(this.frame(bankDeg * DEG * e));
    }
    this.emit(frames, o);
  }

  /**
   * Descending (or climbing) spiral: a full circle of `radius` turning left (angle > 0) or right,
   * losing `drop` metres with smooth entry/exit so heading and level slope are restored at the end.
   */
  spiral(radius: number, angleDeg: number, drop: number, bankDeg = 0, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const dir = Math.sign(angleDeg);
    const total = Math.abs(angleDeg) * DEG;
    const f0 = this.f.clone().setY(0).normalize();
    const r0 = new Vector3().crossVectors(f0, new Vector3(0, 1, 0)).normalize();
    const side = r0.clone().multiplyScalar(-dir); // toward the circle centre
    const p0 = this.p.clone();
    const n = Math.max(8, Math.ceil((total * radius) / 1.2));
    const frames: Frame[] = [];
    for (let i = 0; i <= n; i++) {
      const phi = (i / n) * total;
      const k = i / n;
      const pos = p0.clone().addScaledVector(f0, radius * Math.sin(phi)).addScaledVector(side, radius * (1 - Math.cos(phi)));
      pos.y = p0.y - drop * smooth(k);
      const dss = (30 * k * k * (1 - k) * (1 - k)) / total; // d(smootherstep)/dphi
      const tan = new Vector3()
        .addScaledVector(f0, radius * Math.cos(phi))
        .addScaledVector(side, radius * Math.sin(phi));
      tan.y = -drop * dss;
      tan.normalize();
      const ru = new Vector3().crossVectors(tan, new Vector3(0, 1, 0)).normalize();
      let up = new Vector3().crossVectors(ru, tan).normalize();
      const bank = -dir * bankDeg * DEG * Math.min(smooth(Math.min(1, k / 0.15)), smooth(Math.min(1, (1 - k) / 0.15)));
      up = up.multiplyScalar(Math.cos(bank)).addScaledVector(ru, Math.sin(bank)).normalize();
      frames.push({ p: pos, f: tan, u: up, s: this.s + (i / n) * total * radius });
    }
    this.s += total * radius;
    this.p.copy(frames[frames.length - 1]!.p);
    this.f.copy(f0);
    this.u.set(0, 1, 0);
    this.emit(frames, o);
  }

  /** U-shaped half-pipe (built from convex strips so colliders stay simple). */
  halfpipe(length: number, pipeRadius = 8.5, spanDeg = 150, opts?: RoadOpts): void {
    const o = this.opts(opts);
    const n = Math.max(1, Math.ceil(length / 4));
    const frames: Frame[] = [this.frame(0)];
    for (let i = 0; i < n; i++) {
      this.advance(length / n, 0, 0);
      frames.push(this.frame(0));
    }
    const segs = 14;
    const half = (spanDeg * DEG) / 2;
    const th = o.thickness;
    const pt = (a: number, r: number): [number, number] => [r * Math.sin(a), pipeRadius - r * Math.cos(a)];
    const b = this.builder('road', o.surface, o.effect);
    for (let k = 0; k < segs; k++) {
      const a0 = -half + (2 * half * k) / segs;
      const a1 = -half + (2 * half * (k + 1)) / segs;
      const outerTop0 = pt(a0, pipeRadius), outerTop1 = pt(a1, pipeRadius);
      const under0 = pt(a0, pipeRadius + th), under1 = pt(a1, pipeRadius + th);
      b.sweep(frames, [outerTop0, outerTop1, under1, under0]);
    }
    for (const fr of frames) {
      this.centerline.push(fr.p.clone());
      this.centerSurface.push(o.surface);
    }
  }

  // ---------------------------------------------------------------- misc

  /** Record a gameplay line across the road at the current turtle pose. */
  trigger(kind: TriggerKind, roadWidth = 14, index?: number): void {
    const pose = this.pose(0);
    const idx = kind === 'checkpoint' ? (index ?? this.triggers.filter((t) => t.kind === 'checkpoint').length) : 0;
    this.triggers.push({ kind, index: idx, position: pose.position, quaternion: pose.quaternion, halfWidth: roadWidth / 2 + 3, halfHeight: 10 });
  }

  /** Turtle pose, lifted by `lift` metres along the surface normal (cars spawn slightly above the road). */
  pose(lift = 0.75): Pose {
    const r = this.right;
    const m = new Matrix4().makeBasis(r, this.u, this.f.clone().negate());
    const q = new Quaternion().setFromRotationMatrix(m);
    return { position: this.p.clone().addScaledVector(this.u, lift), quaternion: q };
  }

  /** Place the turtle explicitly. Heading is `yawDeg` about +Y (0 = north / -Z, + = left). */
  place(position: Vector3, yawDeg = 0): void {
    this.p.copy(position);
    const y = yawDeg * DEG;
    this.f.set(-Math.sin(y), 0, -Math.cos(y));
    this.u.set(0, 1, 0);
    this.s = 0;
  }

  /**
   * Non-colliding decorative box. Offsets are in the turtle frame: `dz` forward, `dx` right, `dy` up
   * (to the box's bottom); `w`/`h`/`d` are width, height and depth.
   */
  decoBox(dz: number, dx: number, dy: number, w: number, h: number, d: number, tint: number): void {
    const b = this.builder('deco', 'tech', undefined, tint);
    const r = this.right;
    const centre = this.p.clone().addScaledVector(this.f, dz).addScaledVector(r, dx).addScaledVector(this.u, dy + h / 2);
    const fr = (z: number): Frame => ({ p: centre.clone().addScaledVector(this.f, z), f: this.f.clone(), u: this.u.clone(), s: z });
    const prof: Profile = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    b.sweep([fr(-d / 2), fr(d / 2)], prof);
  }

  /** Overhead gantry across the road at the current pose (start / checkpoint / finish arches). */
  gantry(roadWidth: number, tint: number): void {
    const hw = roadWidth / 2 + 1.1;
    this.decoBox(0, -hw, 0, 0.9, 8, 0.9, tint);
    this.decoBox(0, hw, 0, 0.9, 8, 0.9, tint);
    this.decoBox(0, 0, 7.4, hw * 2 + 0.9, 1.1, 1.0, tint);
  }

  /** Where the car spawns at the start line (set by start / lap-finish blocks). */
  spawn: Pose | null = null;

  setSpawn(): void {
    this.spawn = this.pose(0.75);
  }

  finish(id: string, name: string, start: Pose, killY: number, meta: Partial<Omit<TrackData, 'meshes' | 'start' | 'killY' | 'centerline' | 'centerSurface' | 'triggers'>> = {}): TrackData {
    const meshes: TrackMesh[] = [];
    for (const b of this.builders.values()) meshes.push(b.build());
    return {
      id, name, car: 'volt', theme: 'grey', seed: 0, laps: 1,
      medals: { author: 0, gold: 0, silver: 0, bronze: 0 },
      ...meta,
      meshes, start, killY, triggers: this.triggers, centerline: this.centerline, centerSurface: this.centerSurface,
    };
  }
}

/** Solve ramp geometry: `arcs` pitch arcs of `radius` plus a straight cover `forward` metres and `rise` metres. */
export function solveSlope(forward: number, rise: number, radius: number, arcs: 1 | 2): { theta: number; straight: number } {
  const straightFor = (th: number): number => (forward - arcs * radius * Math.sin(th)) / Math.cos(th);
  const riseFor = (th: number): number => arcs * radius * (1 - Math.cos(th)) + straightFor(th) * Math.sin(th);
  const maxTh = Math.min(Math.PI / 2 - 0.01, forward >= arcs * radius ? Math.PI / 2 - 0.01 : Math.asin(forward / (arcs * radius)));
  if (riseFor(maxTh) < rise) throw new Error(`slope unreachable: forward ${forward}, rise ${rise}, R ${radius}`);
  let lo = 0, hi = maxTh;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (riseFor(mid) < rise) lo = mid;
    else hi = mid;
  }
  const theta = (lo + hi) / 2;
  return { theta, straight: Math.max(0, straightFor(theta)) };
}
