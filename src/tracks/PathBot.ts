import { Vector3 } from 'three';
import { InputFrame, makeFrame } from '../core/InputFrame';
import { SURFACES, SurfaceId } from '../physics/Surface';
import { Vehicle } from '../physics/Vehicle';

/**
 * Minimal pure-pursuit driver that follows a track centerline, slows for corners and low-grip
 * surfaces, and lifts off in the air. Used by tests now; grows into the Phase-6 validation bot.
 */
export class PathBot {
  private idx = 0;
  /** Lateral acceleration (m/s^2) the bot is willing to use when sizing corner speed. */
  lateralBudget = 26;
  /** Hard cap (m/s). */
  maxSpeed = 80;

  constructor(
    private readonly path: Vector3[],
    private readonly surfaces: SurfaceId[] = [],
  ) {}

  get progress(): number {
    return this.idx / (this.path.length - 1);
  }

  get finished(): boolean {
    return this.idx >= this.path.length - 3;
  }

  reset(): void {
    this.idx = 0;
  }

  /** Speed (m/s) the bot wants at the car, from the tightest corner / slipperiest surface ahead. */
  private targetSpeed(from: number): number {
    let dist = 0;
    let minR = Infinity;
    let minGrip = 1;
    for (let i = from; i < this.path.length - 2 && dist < 90; i++) {
      const a = this.path[i]!, b = this.path[i + 1]!, c = this.path[i + 2]!;
      const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
      dist += l1;
      const s = this.surfaces[i];
      if (s && dist < 70) minGrip = Math.min(minGrip, SURFACES[s].grip);
      if (l1 > 12 || l2 > 12 || l1 < 0.05 || l2 < 0.05) continue; // gaps / duplicates
      const v1 = b.clone().sub(a).normalize();
      const v2 = c.clone().sub(b).normalize();
      // near-vertical stretches (loops, steep ramps) are not "corners"
      if (Math.abs(v1.y) > 0.6 || Math.abs(v2.y) > 0.6) continue;
      // only horizontal turning counts; vertical curves are handled by suspension/downforce
      v1.y = 0; v2.y = 0;
      if (v1.lengthSq() < 1e-6 || v2.lengthSq() < 1e-6) continue;
      const ang = Math.acos(Math.min(1, Math.max(-1, v1.normalize().dot(v2.normalize()))));
      if (ang < 1e-4) continue;
      const r = ((l1 + l2) * 0.5) / ang;
      if (r < minR) minR = r;
    }
    let v = Math.sqrt(this.lateralBudget * minR);
    if (minGrip < 0.9) v = Math.min(v, 12 + 45 * minGrip);
    return Math.min(v, this.maxSpeed);
  }

  drive(v: Vehicle): InputFrame {
    // advance the nearest-point index (monotonic, windowed search)
    let best = this.idx;
    let bestD = Infinity;
    for (let i = this.idx; i < Math.min(this.path.length, this.idx + 40); i++) {
      const d = this.path[i]!.distanceToSquared(v.position);
      if (d < bestD) { bestD = d; best = i; }
    }
    this.idx = best;

    // pure pursuit: aim at a point `look` metres down the path, steer for the circle through it
    const look = Math.max(9, v.speed * 0.42);
    let ti = this.idx;
    let acc = 0;
    while (ti < this.path.length - 1 && acc < look) {
      acc += this.path[ti]!.distanceTo(this.path[ti + 1]!);
      ti++;
    }
    const local = this.path[ti]!.clone().sub(v.position);
    const lx = local.dot(v.right);
    const lz = Math.max(-local.dot(v.fwd), 0.5);
    const curvature = (2 * lx) / (lx * lx + lz * lz);
    const wheelbase = v.params.rearAxleZ - v.params.frontAxleZ;
    const wheelAngle = Math.atan(wheelbase * curvature);
    const p = v.params;
    const limit = p.steerMin + (p.steerMax - p.steerMin) / (1 + (v.speed / p.steerRefSpeed) ** 2);
    const steer = Math.max(-1, Math.min(1, wheelAngle / limit));

    const vTarget = this.targetSpeed(this.idx);
    const err = vTarget - v.speed;
    const accel = Math.max(0, Math.min(1, err * 0.5 + 0.3));
    const brake = err < -3 ? Math.min(1, (-err - 3) * 0.2) : 0;
    // no pedals in the air: they command pitch there
    if (v.wheelsOnGround === 0) return makeFrame(steer, 0, 0);
    return makeFrame(steer, brake > 0 ? 0 : accel, brake);
  }
}
