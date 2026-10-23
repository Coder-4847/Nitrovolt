import { Vector3 } from 'three';
import { InputFrame, makeFrame } from '../core/InputFrame';
import { SURFACES, SurfaceId } from '../physics/Surface';
import { Vehicle } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';

import type { BotHints } from './TrackSchema';

/** Apply a level's recorded driving style to a bot. */
export function applyBotHints(bot: PathBot, hints: BotHints | undefined): void {
  if (!hints) return;
  if (hints.maxSpeed) bot.maxSpeed = hints.maxSpeed;
  if (hints.lookTime) bot.lookTime = hints.lookTime;
  if (hints.steerSlew) bot.steerSlew = hints.steerSlew;
  if (hints.lateralBudget) bot.lateralBudget = hints.lateralBudget;
}

/**
 * Minimal pure-pursuit driver that follows a track centerline, slows for corners and low-grip
 * surfaces, and lifts off in the air. Used by tests now; grows into the Phase-6 validation bot.
 */
export class PathBot {
  private idx = 0;
  private lastSteer = 0;
  /** Lateral acceleration (m/s^2) the bot is willing to use when sizing corner speed. */
  lateralBudget = 20;
  /** Hard cap (m/s). */
  maxSpeed = 80;
  /** Pure-pursuit lookahead: max(lookMin, speed * lookTime) metres. */
  lookMin = 10;
  lookTime = 0.45;
  /** Max steering change per tick (analog slew). */
  steerSlew = 0.15;
  /** Seconds below 1.5 m/s before the bot reverses out. */
  private stuckTicks = 0;
  private reverseTicks = 0;

  constructor(
    private readonly path: Vector3[],
    private readonly surfaces: SurfaceId[] = [],
    /** Closed circuit: wrap around to the start instead of finishing (multi-lap tracks). */
    private readonly closed = false,
    /** The car being driven: grip per surface sets corner speeds and braking. */
    private readonly carParams?: VehicleParams,
  ) {}

  get progress(): number {
    return this.idx / (this.path.length - 1);
  }

  get finished(): boolean {
    return !this.closed && this.idx >= this.path.length - 3;
  }

  reset(): void {
    this.idx = 0;
    this.lastSteer = 0;
    this.stuckTicks = 0;
    this.reverseTicks = 0;
  }

  /**
   * Speed (m/s) the bot may carry right now: for every upcoming point take its corner / surface limit and
   * add what braking at `brakeDecel` over the distance to it allows; the minimum wins.
   */
  /** Effective tyre friction coefficient of the car on a surface (1.0 when the car is unknown). */
  private mu(surface: SurfaceId | undefined): number {
    const p = this.carParams;
    if (!p || !surface) return 2;
    return p.gripFront * SURFACES[surface].grip * p.surfaceGrip[surface];
  }

  private targetSpeed(from: number): number {
    let dist = 0;
    let best = this.maxSpeed;
    // braking must work across every surface on the way to the point, so use the slipperiest so far
    let minMu = this.mu(this.surfaces[from % this.path.length]);
    const n = this.path.length;
    const last = this.closed ? from + 140 : n - 2;
    for (let i = from; i < last && dist < 220; i++) {
      const a = this.path[i % n]!, b = this.path[(i + 1) % n]!, c = this.path[(i + 2) % n]!;
      const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
      dist += l1;
      let limit = this.maxSpeed;
      const s = this.surfaces[i % n];
      const mu = this.mu(s);
      if (this.carParams) {
        // slippery ground: no fast straights either, steering barely works
        if (mu < 0.7) limit = Math.min(limit, 8 + 25 * mu);
      } else if (s && SURFACES[s].grip < 0.9) limit = Math.min(limit, 12 + 45 * SURFACES[s].grip);
      minMu = Math.min(minMu, mu);
      const brakeDecel = Math.min(16, 0.55 * minMu * 19.6);
      const budget = Math.min(this.lateralBudget, 0.5 * mu * 19.6);
      if (!(l1 > 12 || l2 > 12 || l1 < 0.05 || l2 < 0.05)) {
        const v1 = b.clone().sub(a).normalize();
        const v2 = c.clone().sub(b).normalize();
        // near-vertical stretches (loops, steep ramps) are not "corners"
        if (!(Math.abs(v1.y) > 0.6 || Math.abs(v2.y) > 0.6)) {
          v1.y = 0; v2.y = 0;
          if (v1.lengthSq() > 1e-6 && v2.lengthSq() > 1e-6) {
            const ang = Math.acos(Math.min(1, Math.max(-1, v1.normalize().dot(v2.normalize()))));
            if (ang > 1e-4) limit = Math.min(limit, Math.sqrt(budget * (((l1 + l2) * 0.5) / ang)));
          }
        }
      }
      best = Math.min(best, Math.sqrt(limit * limit + 2 * brakeDecel * dist));
    }
    return best;
  }

  drive(v: Vehicle): InputFrame {
    // advance the nearest-point index (monotonic, windowed search)
    let best = this.idx;
    let bestD = Infinity;
    for (let i = this.idx; i < Math.min(this.path.length, this.idx + 40); i++) {
      const d = this.path[i]!.distanceToSquared(v.position);
      if (d < bestD) { bestD = d; best = i; }
    }
    // teleported (respawn)? re-locate on the whole path instead of searching only ahead
    if (bestD > 40 * 40) {
      for (let i = 0; i < this.path.length; i++) {
        const d = this.path[i]!.distanceToSquared(v.position);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    this.idx = best;
    if (this.closed && this.idx >= this.path.length - 4) this.idx = 0;

    // pure pursuit: aim at a point `look` metres down the path, steer for the circle through it
    const look = Math.max(this.lookMin, v.speed * this.lookTime);
    let ti = this.idx;
    let acc = 0;
    const n = this.path.length;
    while (ti < (this.closed ? this.idx + 140 : n - 1) && acc < look) {
      acc += this.path[ti % n]!.distanceTo(this.path[(ti + 1) % n]!);
      ti++;
    }
    const local = this.path[ti % n]!.clone().sub(v.position);
    // steer relative to where the car is actually going (robust while sliding)
    let hx = v.fwd, hr = v.right;
    if (v.speed > 6 && v.forwardSpeed > 0) {
      hx = v.linvel.clone().addScaledVector(v.up, -v.linvel.dot(v.up)).normalize();
      hr = new Vector3().crossVectors(hx, v.up).normalize();
    }
    const lx = local.dot(hr);
    const lz = Math.max(local.dot(hx), 0.5);
    const curvature = (2 * lx) / (lx * lx + lz * lz);
    const wheelbase = v.params.rearAxleZ - v.params.frontAxleZ;
    const wheelAngle = Math.atan(wheelbase * curvature);
    const p = v.params;
    const limit = p.steerMin + (p.steerMax - p.steerMin) / (1 + (v.speed / p.steerRefSpeed) ** 2);
    let steer = Math.max(-1, Math.min(1, wheelAngle / limit));
    // analog slew, like a thumb on a stick: no instant full-lock flips
    steer = this.lastSteer + Math.max(-this.steerSlew, Math.min(this.steerSlew, steer - this.lastSteer));
    this.lastSteer = steer;

    const vTarget = this.targetSpeed(this.idx);
    const err = vTarget - v.speed;
    const accel = Math.max(0, Math.min(1, err * 0.5 + 0.3));
    // trail-brake gently: hard braking while steering or sliding just spins the car
    let brake = err < -1.5 ? Math.min(1, (-err - 1.5) * 0.4) : 0;
    brake *= 1 - Math.min(0.85, Math.abs(steer) * 1.1);
    if (Math.abs(v.bodySlip) > 0.2) brake = 0;
    let lift = Math.abs(v.bodySlip) > 0.35 ? 0.15 : 1; // sliding: stop feeding the rear tyres
    // low-grip ground: feather the throttle while the wheel is turned, or the drive eats the lateral grip
    if (this.carParams && this.mu(this.surfaces[this.idx % n]) < 1.2) lift *= 1 - 0.75 * Math.min(1, Math.abs(steer) * 1.6);
    // no pedals in the air: they command pitch there
    if (v.wheelsOnGround === 0) return makeFrame(steer, 0, 0);
    // stuck against a wall? back out for a moment with the wheel turned the other way
    if (v.speed < 1.5) this.stuckTicks++;
    else this.stuckTicks = 0;
    if (this.stuckTicks > 150 && this.reverseTicks === 0) this.reverseTicks = 120;
    if (this.reverseTicks > 0) {
      this.reverseTicks--;
      if (this.reverseTicks === 0) this.stuckTicks = 0;
      return makeFrame(-steer, 0, 1);
    }
    return makeFrame(steer, brake > 0 ? 0 : accel * lift, brake);
  }
}
