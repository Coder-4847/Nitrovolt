import { Vector3 } from 'three';
import { InputFrame } from '../core/InputFrame';
import { SurfaceId } from './Surface';
import type { Vehicle } from './Vehicle';

/** What a car behaviour module can see and touch each tick. Forces are added before integration. */
export interface BehaviorCtx {
  v: Vehicle;
  /** Physics step actually used this tick (slow-motion scales it). */
  dt: number;
  /** Driver input after locks and cruise control. */
  input: InputFrame;
  /** Surface under the most loaded wheel, null in the air. */
  surface: SurfaceId | null;
  /** Vertical landing speed (m/s) in `onLand`. */
  impact: number;
}

/**
 * The per-car "feel" layered on the shared physics core. Parameter sets cover most of a car; behaviours
 * add the bits a number cannot (power-slide initiation, ice momentum, jump kicks). All hooks must be
 * deterministic: they may only use the vehicle state and the context.
 */
export interface CarBehavior {
  /** After tyres/aero, before the step is integrated. */
  update?(c: BehaviorCtx): void;
  /** The first tick all four wheels are off the ground. */
  onLeaveGround?(c: BehaviorCtx): void;
  /** The tick the car touches down after at least a few airborne ticks. */
  onLand?(c: BehaviorCtx, impact: number): void;
}

const _a = new Vector3();
const _b = new Vector3();

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Gravel: on loose ground the car turns in harder than its wheels say, so a flick and the throttle
 * start a power slide. Closed loop: it pushes the yaw rate toward ~1.35x the kinematic rate for the
 * current steering angle, so it stays damped through chicanes and fades as the slide develops.
 */
export const gravelBehavior: CarBehavior = {
  update(c) {
    const { v, input } = c;
    if (!c.surface || v.wheelsOnGround < 2) return;
    const loose = c.surface === 'dirt' || c.surface === 'grass' || c.surface === 'sand' || c.surface === 'snow';
    const amount = loose ? 1 : 0.35;
    const speedF = clamp((v.forwardSpeed - 8) / 14, 0, 1);
    if (speedF <= 0 || input.accel < 0.25) return;
    const p = v.params;
    const wheelbase = p.rearAxleZ - p.frontAxleZ;
    const target = -((v.forwardSpeed * Math.tan(v.steerAngle)) / wheelbase) * 1.35;
    const slideFade = clamp(1 - Math.abs(v.bodySlip) / 0.55, -0.5, 1);
    const alpha = clamp((target - v.angvel.dot(v.up)) * 5, -4, 4) * amount * input.accel * speedF * slideFade;
    const inertiaY = p.mass * 2.2 * p.inertiaScale;
    v.addTorque(_a.copy(v.up).multiplyScalar(alpha * inertiaY));
  },
};

/** Frost: heavy momentum on ice and snow: it carries speed and rotation, and the studs bite when you steer. */
export const frostBehavior: CarBehavior = {
  update(c) {
    const { v, input } = c;
    if (!c.surface || v.wheelsOnGround < 2) return;
    if (c.surface === 'ice' || c.surface === 'snow') {
      const k = c.surface === 'ice' ? 1 : 0.5;
      // cancel part of the rolling/drag losses: it keeps gliding instead of scrubbing speed off
      _a.copy(v.linvel).setY(0);
      const sp = _a.length();
      if (sp > 1) v.addForce(_a.multiplyScalar((v.params.mass * 0.9 * k) / sp));
      // studs dig in when you actually steer: small restoring yaw damping while input is present
      if (Math.abs(input.steer) > 0.1) {
        _b.copy(v.angvel).multiplyScalar(-v.params.mass * 0.9 * k);
        v.addTorque(_b.setX(0).setZ(0));
      }
    }
  },
};

/** Dune: light and bouncy: pops off lips and rebounds on touchdown, and flies on floaty arcs (airGravityScale). */
export const duneBehavior: CarBehavior = {
  onLeaveGround(c) {
    const { v } = c;
    const sp = v.forwardSpeed;
    if (sp < 18) return;
    // a spring-launch off ramps and crests, proportional to speed (only the up component along the car's up axis)
    v.kick(_a.copy(v.up).multiplyScalar(clamp((sp - 18) * 0.03, 0, 1.6)));
  },
  onLand(c, impact) {
    const { v } = c;
    if (impact < 6) return;
    v.kick(_a.copy(v.up).multiplyScalar(clamp(impact * 0.1, 0, 2.2)));
  },
};
