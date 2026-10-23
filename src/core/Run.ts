import { Quaternion, Vector3 } from 'three';
import { PHYSICS_DT } from './FixedLoop';
import { TrackTrigger } from '../tracks/TrackTypes';

/** `ready` = the car is gridded and waiting for GO (the countdown is a UI timer; the physics is not stepped). */
export type RunState = 'ready' | 'running' | 'finished';

export type RunEvent =
  | { type: 'checkpoint'; index: number; splitIndex: number; time: number }
  | { type: 'lap'; lap: number; splitIndex: number; time: number }
  | { type: 'finish'; time: number; splitIndex: number };

/** Distance (m) the car must travel away from the finish line before it can count again (lap tracks). */
const ARM_DISTANCE = 40;
/** How far below a trigger plane the car can be and still count (m). */
const TRIGGER_BELOW = 2.5;

const _p = new Vector3();
const _q = new Quaternion();

/** Local-frame position of `pos` relative to a trigger. */
function toLocal(t: TrackTrigger, pos: Vector3, out: Vector3): Vector3 {
  _q.copy(t.quaternion).invert();
  return out.copy(pos).sub(t.position).applyQuaternion(_q);
}

/**
 * Race rules: countdown, ordered checkpoints, laps and the finish. All times are integer
 * milliseconds measured from GO, and crossing times are interpolated inside the physics tick so
 * they are millisecond-accurate (and exactly reproducible).
 */
export class RunLogic {
  state: RunState = 'ready';
  /** Ticks elapsed since GO (the run clock; the grid pre-roll is not counted). */
  tick = 0;
  nextCp = 0;
  lap = 0;
  /** Every split in order: each checkpoint, each lap line, then the finish (ms). */
  splits: number[] = [];
  finishTime: number | null = null;
  readonly events: RunEvent[] = [];

  private armed = false;
  private readonly cps: TrackTrigger[];
  private readonly finish: TrackTrigger | undefined;

  constructor(
    triggers: TrackTrigger[],
    readonly laps: number,
  ) {
    this.cps = triggers.filter((t) => t.kind === 'checkpoint').sort((a, b) => a.index - b.index);
    this.finish = triggers.find((t) => t.kind === 'finish');
  }

  get checkpointCount(): number {
    return this.cps.length;
  }

  /** Milliseconds on the run clock at the *start* of the current tick (0 before GO). */
  get timeMs(): number {
    if (this.state === 'ready') return 0;
    if (this.state === 'finished' && this.finishTime !== null) return this.finishTime;
    return this.tick * PHYSICS_DT * 1000;
  }

  /** Back to the grid, waiting for GO. */
  reset(): void {
    this.tick = 0;
    this.nextCp = 0;
    this.lap = 0;
    this.splits = [];
    this.finishTime = null;
    this.armed = false;
    this.events.length = 0;
    this.state = 'ready';
  }

  /** GO: the clock starts at zero. */
  go(): void {
    if (this.state === 'ready') this.state = 'running';
  }

  /** True while the player must not be able to drive. */
  get locked(): boolean {
    return this.state === 'ready';
  }

  /**
   * Advance one tick. `prev` / `curr` are the car's positions before and after this physics step.
   * Returns the pose to respawn at if a checkpoint or lap line was just collected, else null.
   */
  step(prev: Vector3, curr: Vector3): TrackTrigger | null {
    const n = this.tick;
    let collected: TrackTrigger | null = null;

    if (this.state === 'running') {
      const cp = this.cps[this.nextCp];
      if (cp) {
        const t = this.crossing(cp, prev, curr);
        if (t !== null) {
          const time = this.msAt(n, t);
          this.splits.push(time);
          this.events.push({ type: 'checkpoint', index: this.nextCp, splitIndex: this.splits.length - 1, time });
          this.nextCp++;
          collected = cp;
        }
      }
      const fin = this.finish;
      if (fin) {
        if (!this.armed && curr.distanceTo(fin.position) > ARM_DISTANCE) this.armed = true;
        if (this.armed && this.nextCp >= this.cps.length) {
          const t = this.crossing(fin, prev, curr);
          if (t !== null) {
            const time = this.msAt(n, t);
            this.splits.push(time);
            if (this.lap + 1 < this.laps) {
              this.lap++;
              this.nextCp = 0;
              this.armed = false;
              this.events.push({ type: 'lap', lap: this.lap, splitIndex: this.splits.length - 1, time });
              collected = fin;
            } else {
              this.state = 'finished';
              this.finishTime = time;
              this.events.push({ type: 'finish', time, splitIndex: this.splits.length - 1 });
            }
          }
        }
      }
    }
    if (this.state !== 'ready') this.tick++;
    return collected;
  }

  /** Fraction (0..1] through this tick at which the car crossed the trigger plane forward, or null. */
  private crossing(t: TrackTrigger, prev: Vector3, curr: Vector3): number | null {
    const a = toLocal(t, prev, _p);
    const z0 = a.z;
    const b = toLocal(t, curr, new Vector3());
    const z1 = b.z;
    if (!(z0 > 0 && z1 <= 0)) return null; // must go from behind to ahead
    const alpha = z0 / (z0 - z1);
    const x = a.x + (b.x - a.x) * alpha;
    const y = a.y + (b.y - a.y) * alpha;
    if (Math.abs(x) > t.halfWidth || y < -TRIGGER_BELOW || y > t.halfHeight) return null;
    return alpha;
  }

  private msAt(tickStart: number, alpha: number): number {
    return Math.round((tickStart + alpha) * PHYSICS_DT * 1000);
  }
}
