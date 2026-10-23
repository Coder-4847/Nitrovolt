import { Quaternion, Vector3 } from 'three';
import { CarBehavior } from '../physics/CarBehavior';
import { PHYSICS_VERSION, Simulation } from '../physics/Simulation';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { TrackData } from '../tracks/TrackTypes';
import { PHYSICS_DT } from './FixedLoop';
import { InputFrame } from './InputFrame';
import { InputRecorder } from './InputRecorder';

/** A snapshot is stored this many ticks apart (0.5 s). */
export const SNAPSHOT_INTERVAL = 50;
/** floats per snapshot: position(3) quaternion(4) velocity(3) */
const STRIDE = 10;
/** If a re-simulated ghost drifts further than this (m) from its recorded snapshot, fall back to snapshots. */
const DIVERGENCE_LIMIT = 0.3;

/**
 * A recorded run. The input stream is the truth (a ghost is re-simulated from it, so it matches the
 * original run exactly); the snapshots verify that and are the fallback when the physics differs.
 */
export interface GhostData {
  v: 1;
  trackId: string;
  carId: string;
  /** Finish time (ms). */
  time: number;
  /** Input frames from GO to the finish tick. */
  ticks: number;
  levelHash: string;
  physicsHash: string;
  /** base64 InputRecorder bytes */
  input: string;
  /** base64 Float32 snapshots: every SNAPSHOT_INTERVAL ticks from tick 0 */
  snaps: string;
}

// ------------------------------------------------------------------ small utilities

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fingerprint of everything about a level that affects driving. */
export function levelFingerprint(blocks: unknown, car: string, laps: number): string {
  return fnv1a(JSON.stringify({ blocks, car, laps }));
}

/** Fingerprint of the physics a run was recorded with (parameters + engine version). */
export function physicsFingerprint(params: VehicleParams): string {
  return fnv1a(PHYSICS_VERSION + JSON.stringify(params));
}

// ------------------------------------------------------------------ recording

export class GhostRecorder {
  private readonly input = new InputRecorder();
  private snaps: number[] = [];

  get ticks(): number {
    return this.input.ticks;
  }

  /** Call when the run starts (GO). */
  start(sim: Simulation): void {
    this.input.clear();
    this.snaps = [];
    this.snapshot(sim);
  }

  /** The frame about to be given to `sim.step`. */
  push(frame: InputFrame): void {
    this.input.push(frame);
  }

  /** Call after `sim.step`. */
  afterStep(sim: Simulation): void {
    if (sim.run.tick % SNAPSHOT_INTERVAL === 0) this.snapshot(sim);
  }

  private snapshot(sim: Simulation): void {
    const v = sim.vehicle;
    this.snaps.push(v.position.x, v.position.y, v.position.z, v.quaternion.x, v.quaternion.y, v.quaternion.z, v.quaternion.w, v.linvel.x, v.linvel.y, v.linvel.z);
  }

  /** Package the run that just finished. */
  finish(sim: Simulation, meta: { trackId: string; carId: string; levelHash: string }): GhostData {
    const f32 = new Float32Array(this.snaps);
    return {
      v: 1,
      trackId: meta.trackId,
      carId: meta.carId,
      time: sim.run.finishTime ?? 0,
      ticks: this.input.ticks,
      levelHash: meta.levelHash,
      physicsHash: physicsFingerprint(sim.vehicle.params),
      input: toBase64(this.input.toBytes()),
      snaps: toBase64(new Uint8Array(f32.buffer)),
    };
  }
}

// ------------------------------------------------------------------ playback

const _q0 = new Quaternion();
const _q1 = new Quaternion();

/**
 * Plays a ghost by re-simulating its input stream in a private simulation (own physics world, so it
 * never collides with the player). If the level / physics fingerprints differ, or the re-simulation
 * drifts from the recorded snapshots (another browser's maths), it follows the snapshots instead.
 */
export class GhostPlayer {
  mode: 'exact' | 'snapshot';
  /** True once the recorded run has played to its end. */
  ended = false;
  /** Keep the re-simulation's events for the caller (replay viewer); otherwise they are dropped each tick. */
  collect = false;
  private readonly frames: InputFrame[];
  private readonly snaps: Float32Array;
  private tick = 0;
  private readonly nominalSpring: number;

  private constructor(
    readonly data: GhostData,
    private readonly sim: Simulation,
    exact: boolean,
  ) {
    this.frames = InputRecorder.fromBytes(fromBase64(data.input)).toFrames();
    const bytes = fromBase64(data.snaps);
    this.snaps = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
    this.mode = exact ? 'exact' : 'snapshot';
    this.nominalSpring = sim.vehicle.params.springLenMax * 0.75;
  }

  static async create(
    track: TrackData,
    params: VehicleParams,
    behavior: CarBehavior | undefined,
    data: GhostData,
    levelHash: string,
  ): Promise<GhostPlayer> {
    const sim = await Simulation.create(track, params, true, undefined, behavior);
    const exact = data.levelHash === levelHash && data.physicsHash === physicsFingerprint(params);
    return new GhostPlayer(data, sim, exact);
  }

  get finishTime(): number {
    return this.data.time;
  }

  get vehicle(): Simulation['vehicle'] {
    return this.sim.vehicle;
  }

  /** Back to the grid (the player restarted). */
  reset(): void {
    this.sim.restart();
    this.tick = 0;
    this.ended = false;
  }

  /** The player's GO. */
  go(): void {
    this.sim.go();
  }

  /** Advance one tick in lock-step with the player. */
  step(): void {
    if (this.ended) return;
    if (this.tick >= this.frames.length) {
      this.ended = true;
      return;
    }
    if (this.mode === 'exact') {
      this.sim.step(this.frames[this.tick]!);
      if (!this.collect) this.sim.events.length = 0;
      if (this.sim.run.tick % SNAPSHOT_INTERVAL === 0) this.verify(this.sim.run.tick / SNAPSHOT_INTERVAL);
    }
    this.tick++;
  }

  /** Events of the re-simulation since the caller last cleared them (only filled while `collect` is on). */
  get events(): Simulation['events'] {
    return this.sim.events;
  }

  get world(): Simulation['world'] {
    return this.sim.world;
  }

  /** Ticks played so far / in the whole run. */
  get currentTick(): number {
    return this.tick;
  }

  get totalTicks(): number {
    return this.frames.length;
  }

  /** Jump to tick `n` by re-simulating from the grid (exact mode), or just moving the cursor (snapshot mode). */
  seek(n: number): void {
    const target = Math.max(0, Math.min(this.frames.length, Math.round(n)));
    if (this.mode === 'snapshot') {
      this.tick = target;
      this.ended = target >= this.frames.length;
      return;
    }
    this.reset();
    this.go();
    const was = this.collect;
    this.collect = false;
    while (this.tick < target) this.step();
    this.collect = was;
    this.sim.events.length = 0;
    this.ended = target >= this.frames.length;
  }

  /** Recorded pose at a fractional tick, interpolated from the snapshots (cheap; used while scrubbing). */
  poseAtTick(tickF: number, out: RenderPose): void {
    this.snapshotPose(tickF, out);
  }

  /** Compare the re-simulation with the recorded snapshot; bail out to snapshot mode on divergence. */
  private verify(index: number): void {
    const o = index * STRIDE;
    if (o + 2 >= this.snaps.length) return;
    const v = this.sim.vehicle.position;
    const dx = v.x - this.snaps[o]!, dy = v.y - this.snaps[o + 1]!, dz = v.z - this.snaps[o + 2]!;
    if (Math.hypot(dx, dy, dz) > DIVERGENCE_LIMIT) this.mode = 'snapshot';
  }

  /** Worst-case distance (m) between the re-simulation and the snapshot at the current tick (tests / debug). */
  snapshotError(): number {
    const idx = Math.round(this.tick / SNAPSHOT_INTERVAL);
    const o = idx * STRIDE;
    if (this.tick % SNAPSHOT_INTERVAL !== 0 || o + 2 >= this.snaps.length) return 0;
    const v = this.sim.vehicle.position;
    return Math.hypot(v.x - this.snaps[o]!, v.y - this.snaps[o + 1]!, v.z - this.snaps[o + 2]!);
  }

  /** Interpolated pose for rendering at `alpha` between the last two physics ticks. */
  pose(alpha: number, out: RenderPose): void {
    if (this.mode === 'exact') {
      this.sim.vehicle.interpolate(alpha, out);
      return;
    }
    this.snapshotPose(Math.min(this.tick, this.frames.length) + alpha - 1, out);
  }

  /** Cubic Hermite through the snapshots (positions + velocities), slerped orientation. */
  private snapshotPose(tickF: number, out: RenderPose): void {
    const t = Math.max(0, tickF) / SNAPSHOT_INTERVAL;
    const i0 = Math.min(Math.floor(t), Math.floor(this.snaps.length / STRIDE) - 1);
    const i1 = Math.min(i0 + 1, Math.floor(this.snaps.length / STRIDE) - 1);
    const u = i1 === i0 ? 0 : Math.min(1, t - i0);
    const h = SNAPSHOT_INTERVAL * PHYSICS_DT;
    const a = i0 * STRIDE, b = i1 * STRIDE;
    const s = this.snaps;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    out.position.set(
      h00 * s[a]! + h10 * h * s[a + 7]! + h01 * s[b]! + h11 * h * s[b + 7]!,
      h00 * s[a + 1]! + h10 * h * s[a + 8]! + h01 * s[b + 1]! + h11 * h * s[b + 8]!,
      h00 * s[a + 2]! + h10 * h * s[a + 9]! + h01 * s[b + 2]! + h11 * h * s[b + 9]!,
    );
    _q0.set(s[a + 3]!, s[a + 4]!, s[a + 5]!, s[a + 6]!);
    _q1.set(s[b + 3]!, s[b + 4]!, s[b + 5]!, s[b + 6]!);
    out.quaternion.slerpQuaternions(_q0, _q1, u);
    for (let k = 0; k < 4; k++) {
      out.springLen[k] = this.nominalSpring;
      out.steer[k] = 0;
      out.spin[k] = 0;
    }
  }

  /** Where the ghost car currently is (for HUD gap, camera). */
  get position(): Vector3 {
    return this.sim.vehicle.position;
  }

  dispose(): void {
    this.sim.dispose();
  }
}
