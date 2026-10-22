import { Quaternion, Vector3 } from 'three';
import { InputFrame } from '../core/InputFrame';
import { RAPIER, RapierWorld } from './RapierWorld';
import { BehaviorCtx, CarBehavior } from './CarBehavior';
import { EffectState } from './Effects';
import { EffectId, SURFACES, SurfaceId } from './Surface';
import { VehicleParams } from './VehicleParams';

/** Heavier-than-earth gravity keeps jumps punchy and nothing floaty. */
export const DEFAULT_GRAVITY = 19.6;

export type SimEvent =
  | { type: 'landing'; intensity: number; /** collider handles of fragile blocks landed on */ fragile: number[] }
  | { type: 'impact'; intensity: number }
  | { type: 'bottomOut'; intensity: number };

export const WHEEL_FL = 0;
export const WHEEL_FR = 1;
export const WHEEL_RL = 2;
export const WHEEL_RR = 3;

export interface WheelState {
  contact: boolean;
  /** Mount -> wheel-centre distance (m). */
  springLen: number;
  /** Wheel steer angle (rad, + = right). */
  steer: number;
  /** Accumulated roll angle for visuals. */
  spin: number;
  load: number;
  surface: SurfaceId;
  /** Special-block effect under this wheel, if any. */
  effect: EffectId | undefined;
  colliderHandle: number;
  /** Tyre slip angle (rad). */
  slipAngle: number;
  /** |tyre force| / available grip, 1 = on the limit. */
  gripUse: number;
  forceLat: number;
  forceLong: number;
  /** True when drive/brake demand exceeded grip (wheelspin / lockup) this tick. */
  slipping: boolean;
  contactPoint: Vector3;
  normal: Vector3;
}

/** The interpolatable part of the vehicle, snapshotted once per physics step. */
export interface RenderPose {
  position: Vector3;
  quaternion: Quaternion;
  springLen: number[];
  steer: number[];
  spin: number[];
}

const newWheel = (): WheelState => ({
  contact: false,
  springLen: 0,
  steer: 0,
  spin: 0,
  load: 0,
  surface: 'tarmac',
  effect: undefined,
  colliderHandle: -1,
  slipAngle: 0,
  gripUse: 0,
  forceLat: 0,
  forceLong: 0,
  slipping: false,
  contactPoint: new Vector3(),
  normal: new Vector3(0, 1, 0),
});

const newPose = (): RenderPose => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  springLen: [0, 0, 0, 0],
  steer: [0, 0, 0, 0],
  spin: [0, 0, 0, 0],
});

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const sign = (v: number): number => (v < 0 ? -1 : 1);

// Scratch vectors (physics is single-threaded; avoids per-tick garbage).
const _r = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _p = new Vector3();
const _f = new Vector3();
const _t = new Vector3();
const _qi = new Quaternion();
const _lv = new Vector3();

/** Minimum forward speed (m/s) used in slip-angle maths so the tyre stays well-behaved near standstill. */
const SLIP_MIN_SPEED = 3.0;

export class Vehicle {
  readonly wheels: WheelState[] = [newWheel(), newWheel(), newWheel(), newWheel()];
  readonly mountLocal: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  prev: RenderPose = newPose();
  curr: RenderPose = newPose();

  // Cached rigid-body state (read after every step).
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();
  readonly linvel = new Vector3();
  readonly angvel = new Vector3();
  /** Car axes in world space. */
  readonly fwd = new Vector3(0, 0, -1);
  readonly up = new Vector3(0, 1, 0);
  readonly right = new Vector3(1, 0, 0);

  forwardSpeed = 0;
  speed = 0;
  steerAngle = 0;
  wheelsOnGround = 0;
  airTime = 0;
  /** Body slip angle (rad): angle between heading and velocity, + = velocity to the right of the nose. */
  bodySlip = 0;
  /** Special-block effects (boost, locks, slow-mo...). */
  readonly effects = new EffectState();
  private readonly touching: EffectId[] = [];
  private readonly effInput: InputFrame = { steer: 0, accel: 0, brake: 0, respawn: false };
  private engineOff = false;
  private stepDt = 0.01;
  private readonly bctx: BehaviorCtx;
  private boostCap = 0;
  /** Last air-control output (debug). */
  dbgAir = { ax: 0, pitchErr: 0, wx: 0, pitchIn: 0 };
  events: SimEvent[] = [];

  private body!: RAPIER.RigidBody;
  private collider!: RAPIER.Collider;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly force = new Vector3();
  private readonly torque = new Vector3();
  private prevSpringLen = [0, 0, 0, 0];
  private wasContact = [false, false, false, false];
  private airTicks = 0;

  constructor(
    private readonly physics: RapierWorld,
    public params: VehicleParams,
    public gravity = DEFAULT_GRAVITY,
    public behavior?: CarBehavior,
  ) {
    this.rebuildMounts();
    this.bctx = { v: this, dt: 0.01, input: this.effInput, surface: null, impact: 0 };
  }

  /** Add a world-space force at the centre of mass this tick (car behaviours). */
  addForce(f: Vector3): void {
    this.force.add(f);
  }

  /** Add a world-space torque this tick (car behaviours). */
  addTorque(t: Vector3): void {
    this.torque.add(t);
  }

  /** Change velocity by `dv` (m/s) this tick (car behaviours: launch kicks, bounce). */
  kick(dv: Vector3): void {
    this.force.addScaledVector(dv, this.params.mass / this.stepDt);
  }

  /** Surface under the most heavily loaded wheel, or null in the air. */
  dominantSurface(): SurfaceId | null {
    let best = -1;
    let s: SurfaceId | null = null;
    for (const w of this.wheels) if (w.contact && w.load > best) { best = w.load; s = w.surface; }
    return s;
  }

  /** Principal inertia in the local frame (pitch X, yaw Y, roll Z). */
  private inertia(): Vector3 {
    const p = this.params;
    const w = p.boxHalf[0] * 2,
      h = p.boxHalf[1] * 2 + 0.3,
      l = p.boxHalf[2] * 2;
    const k = (p.mass / 12) * p.inertiaScale;
    return _lv.set(k * (h * h + l * l), k * (w * w + l * l), k * (w * w + h * h));
  }

  private rebuildMounts(): void {
    const p = this.params;
    this.mountLocal[WHEEL_FL]!.set(-p.halfTrackFront, p.mountY, p.frontAxleZ);
    this.mountLocal[WHEEL_FR]!.set(p.halfTrackFront, p.mountY, p.frontAxleZ);
    this.mountLocal[WHEEL_RL]!.set(-p.halfTrackRear, p.mountY, p.rearAxleZ);
    this.mountLocal[WHEEL_RR]!.set(p.halfTrackRear, p.mountY, p.rearAxleZ);
  }

  /** Call after changing mass/inertia/geometry params at runtime (tuning panel). */
  refreshParams(): void {
    this.rebuildMounts();
    if (!this.collider) return;
    const i = this.inertia();
    this.collider.setMassProperties(
      this.params.mass,
      { x: 0, y: -this.params.boxCenterY, z: 0 },
      { x: i.x, y: i.y, z: i.z },
      { x: 0, y: 0, z: 0, w: 1 },
    );
  }

  /** (Re)create the chassis at a pose with zero velocity. A fresh body guarantees identical restarts. */
  reset(position: Vector3, quaternion: Quaternion, linvel?: Vector3): void {
    const world = this.physics.world;
    if (this.body) world.removeRigidBody(this.body);
    const p = this.params;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w })
      .setCanSleep(false)
      .setGravityScale(0)
      .setCcdEnabled(true)
      .setLinearDamping(0)
      .setAngularDamping(0);
    if (linvel) bodyDesc.setLinvel(linvel.x, linvel.y, linvel.z);
    this.body = world.createRigidBody(bodyDesc);
    const i = this.inertia();
    const colDesc = RAPIER.ColliderDesc.cuboid(p.boxHalf[0], p.boxHalf[1], p.boxHalf[2])
      .setTranslation(0, p.boxCenterY, 0)
      .setMassProperties(p.mass, { x: 0, y: -p.boxCenterY, z: 0 }, { x: i.x, y: i.y, z: i.z }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0)
      .setRestitution(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
    this.collider = world.createCollider(colDesc, this.body);

    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      w.contact = false;
      w.springLen = p.springLenMax;
      w.steer = 0;
      w.spin = 0;
      w.load = 0;
      w.slipAngle = 0;
      w.gripUse = 0;
      w.forceLat = 0;
      w.forceLong = 0;
      w.slipping = false;
      this.prevSpringLen[k] = p.springLenMax;
      this.wasContact[k] = false;
    }
    this.steerAngle = 0;
    this.airTicks = 0;
    this.airTime = 0;
    this.effects.reset();
    this.engineOff = false;
    this.events = [];
    this.readBody();
    this.snapshot(this.curr);
    this.snapshot(this.prev);
  }

  private readBody(): void {
    const b = this.body;
    const t = b.translation();
    const r = b.rotation();
    const lv = b.linvel();
    const av = b.angvel();
    this.position.set(t.x, t.y, t.z);
    this.quaternion.set(r.x, r.y, r.z, r.w).normalize();
    this.linvel.set(lv.x, lv.y, lv.z);
    this.angvel.set(av.x, av.y, av.z);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
    this.forwardSpeed = this.linvel.dot(this.fwd);
    this.speed = this.linvel.length();
  }

  private snapshot(out: RenderPose): void {
    out.position.copy(this.position);
    out.quaternion.copy(this.quaternion);
    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      out.springLen[k] = w.springLen;
      out.steer[k] = w.steer;
      out.spin[k] = w.spin;
    }
  }

  /** Effective inverse-inertia-aware mass at a world-space lever arm `r` for a push along unit `d`. */
  private effectiveMass(r: Vector3, d: Vector3, inertia: Vector3): number {
    _qi.copy(this.quaternion).invert();
    const rl = _w.copy(r).applyQuaternion(_qi);
    const dl = _t.copy(d).applyQuaternion(_qi);
    const cx = rl.y * dl.z - rl.z * dl.y;
    const cy = rl.z * dl.x - rl.x * dl.z;
    const cz = rl.x * dl.y - rl.y * dl.x;
    const inv = 1 / this.params.mass + (cx * cx) / inertia.x + (cy * cy) / inertia.y + (cz * cz) / inertia.z;
    return 1 / inv;
  }

  private addForceAt(f: Vector3, worldPoint: Vector3): void {
    this.force.add(f);
    _r.copy(worldPoint).sub(this.position);
    this.torque.add(_t.copy(_r).cross(f));
  }

  step(input: InputFrame, realDt: number): void {
    // Previous state becomes the interpolation start.
    const tmp = this.prev;
    this.prev = this.curr;
    this.curr = tmp;

    const p = this.params;
    this.events.length = 0;
    this.torque.set(0, 0, 0);
    const inertia = this.inertia().clone();
    const preVel = _v.copy(this.linvel).clone();

    // ---------- contacts + special-block effects ----------
    this.castWheels();
    this.updateBodySlip();
    const mods = this.effects.update(this.touching, realDt, this.forwardSpeed, p.topSpeed);
    const dt = realDt * mods.timeScale; // slow-motion blocks scale the physics step itself
    this.stepDt = dt;
    this.boostCap = mods.boostCap;
    this.engineOff = mods.engineOff;
    const gScale = this.wheelsOnGround === 0 ? p.airGravityScale : 1;
    this.force.set(0, -p.mass * this.gravity * gScale * (mods.gravityScale - mods.lift), 0);
    if (mods.boostAccel > 0) {
      const cap = clamp((mods.boostCap - Math.max(this.forwardSpeed, 0)) / (mods.boostCap * 0.08), 0, 1);
      this.force.addScaledVector(this.fwd, p.mass * mods.boostAccel * cap);
    }

    // effective driver input after locks / cruise control
    const eff = this.effInput;
    eff.steer = mods.noSteer ? 0 : input.steer;
    eff.accel = input.accel;
    eff.brake = mods.noBrake ? 0 : input.brake;
    if (mods.cruiseSpeed !== null) {
      const err = mods.cruiseSpeed - this.forwardSpeed;
      eff.accel = clamp(err * 0.7, 0, 1);
      eff.brake = clamp(-err * 0.5, 0, 1);
    }

    // ---------- steering ----------
    const speed = this.speed;
    const limit = p.steerMin + (p.steerMax - p.steerMin) / (1 + (speed / p.steerRefSpeed) ** 2);
    let target = eff.steer * limit;
    if (p.counterSteerAssist > 0 && this.forwardSpeed > 6) {
      const thresh = p.peakSlipAngle * 1.1;
      const over = Math.max(0, Math.abs(this.bodySlip) - thresh);
      target += sign(this.bodySlip) * over * p.counterSteerAssist;
    }
    target = clamp(target, -p.steerMax, p.steerMax);
    this.steerAngle += clamp(target - this.steerAngle, -p.steerRate * dt, p.steerRate * dt);

    // ---------- suspension ----------
    this.applySuspension(dt);

    // ---------- tyres ----------
    this.applyTyres(eff, dt, inertia);

    // ---------- aero ----------
    this.applyAero();
    this.applyGroundAlign(inertia);
    const bctx = this.bctx;
    bctx.dt = dt;
    bctx.surface = this.dominantSurface();
    this.behavior?.update?.(bctx);

    // ---------- air control ----------
    let landingImpact = 0;
    let fragile: number[] = [];
    if (this.wheelsOnGround === 0) {
      this.airTicks++;
      this.airTime = this.airTicks * realDt;
      if (this.airTicks === 1) this.behavior?.onLeaveGround?.(bctx);
      this.applyAirControl(eff, inertia);
    } else {
      if (this.airTicks >= 3) {
        landingImpact = -this.linvel.dot(this.up);
        bctx.impact = landingImpact;
        this.behavior?.onLand?.(bctx, landingImpact);
        fragile = this.wheels.filter((w) => w.contact && w.effect === 'fragile').map((w) => w.colliderHandle);
      }
      this.airTicks = 0;
      this.airTime = 0;
    }

    // ---------- integrate ----------
    this.body.applyImpulse({ x: this.force.x * dt, y: this.force.y * dt, z: this.force.z * dt }, true);
    this.body.applyTorqueImpulse({ x: this.torque.x * dt, y: this.torque.y * dt, z: this.torque.z * dt }, true);
    this.physics.step(dt);
    this.readBody();

    // ---------- events ----------
    if (landingImpact > 3) this.events.push({ type: 'landing', intensity: landingImpact, fragile });
    // Wall / barrier hits show up as a sudden velocity change that is not along the car's up axis.
    const dv = _t.copy(this.linvel).sub(preVel);
    dv.y += this.gravity * mods.gravityScale * dt; // remove gravity's contribution
    dv.addScaledVector(this.up, -dv.dot(this.up));
    const dvMag = dv.length();
    if (dvMag > 3) this.events.push({ type: 'impact', intensity: dvMag });

    for (let k = 0; k < 4; k++) this.wheels[k]!.steer = k < 2 ? this.steerAngle : 0;
    this.snapshot(this.curr);
  }

  private updateBodySlip(): void {
    _qi.copy(this.quaternion).invert();
    const lv = _w.copy(this.linvel).applyQuaternion(_qi);
    const fwdSpeed = -lv.z;
    this.bodySlip = Math.hypot(lv.x, lv.z) > 4 && fwdSpeed > 0 ? Math.atan2(lv.x, fwdSpeed) : 0;
  }

  private castWheels(): void {
    const p = this.params;
    const rayLen = p.springLenMax + p.wheelRadius;
    this.wheelsOnGround = 0;
    this.touching.length = 0;
    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      _p.copy(this.mountLocal[k]!).applyQuaternion(this.quaternion).add(this.position);
      this.ray.origin.x = _p.x;
      this.ray.origin.y = _p.y;
      this.ray.origin.z = _p.z;
      this.ray.dir.x = -this.up.x;
      this.ray.dir.y = -this.up.y;
      this.ray.dir.z = -this.up.z;
      const hit = this.physics.world.castRayAndGetNormal(this.ray, rayLen, true, undefined, undefined, undefined, this.body);
      w.contact = false;
      if (hit) {
        _f.set(hit.normal.x, hit.normal.y, hit.normal.z);
        if (_f.dot(this.up) < 0) _f.negate(); // ray hit the back face
        if (_f.dot(this.up) > 0.2) {
          w.contact = true;
          w.springLen = hit.timeOfImpact - p.wheelRadius;
          w.normal.copy(_f);
          w.contactPoint.set(_p.x - this.up.x * hit.timeOfImpact, _p.y - this.up.y * hit.timeOfImpact, _p.z - this.up.z * hit.timeOfImpact);
          const info = this.physics.infoOf(hit.collider.handle);
          w.surface = info.surface;
          w.effect = info.effect;
          w.colliderHandle = hit.collider.handle;
          if (info.effect) this.touching.push(info.effect);
          this.wheelsOnGround++;
        }
      }
      if (!w.contact) {
        w.effect = undefined;
        w.springLen = p.springLenMax;
        w.load = 0;
        w.slipAngle = 0;
        w.gripUse = 0;
        w.forceLat = 0;
        w.forceLong = 0;
        w.slipping = false;
      }
    }
  }

  private applySuspension(dt: number): void {
    const p = this.params;
    const comp: number[] = [0, 0, 0, 0];
    const fs: number[] = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      if (!w.contact) {
        this.prevSpringLen[k] = p.springLenMax;
        continue;
      }
      const x = p.springLenMax - w.springLen;
      comp[k] = Math.max(0, x);
      const rate = this.wasContact[k] ? clamp((w.springLen - this.prevSpringLen[k]!) / dt, -12, 12) : 0;
      let f = p.springK * Math.max(0, x) + p.springProgressive * Math.max(0, x) * Math.max(0, x);
      f += (rate < 0 ? p.dampBump : p.dampRebound) * -rate;
      if (w.springLen < p.springLenMin) {
        const pen = p.springLenMin - w.springLen;
        f += p.bumpStopK * pen;
        if (pen > 0.04 && this.events.length < 4) this.events.push({ type: 'bottomOut', intensity: pen });
      }
      fs[k] = f;
      this.prevSpringLen[k] = w.springLen;
    }
    // anti-roll bars
    const arb = (l: number, r: number, k: number): void => {
      if (k <= 0) return;
      const diff = comp[l]! - comp[r]!;
      const wl = this.wheels[l]!;
      const wr = this.wheels[r]!;
      if (wl.contact) fs[l] = fs[l]! + k * diff;
      if (wr.contact) fs[r] = fs[r]! - k * diff;
    };
    arb(WHEEL_FL, WHEEL_FR, p.arbFront);
    arb(WHEEL_RL, WHEEL_RR, p.arbRear);

    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      this.wasContact[k] = w.contact;
      if (!w.contact) continue;
      const f = Math.max(0, fs[k]!);
      w.load = f;
      _f.copy(this.up).multiplyScalar(f);
      _p.copy(this.mountLocal[k]!).applyQuaternion(this.quaternion).add(this.position);
      this.addForceAt(_f, _p);
    }
  }

  private applyTyres(input: InputFrame, dt: number, inertia: Vector3): void {
    const p = this.params;
    const fwdSpeed = this.forwardSpeed;
    const absSpeed = Math.abs(fwdSpeed);
    // each wheel may only remove its share of the velocity in one tick, or four wheels overshoot and buzz
    const share = 1 / Math.max(1, this.wheelsOnGround);

    // ---- drivetrain demand (signed, +forward, total at the wheels) ----
    const accel = input.accel;
    const brake = input.brake;
    const reversing = brake > 0 && accel === 0 && fwdSpeed < 0.8;
    const braking = brake > 0 && !reversing && fwdSpeed > 0.8;
    let drive = 0;
    if (accel > 0) {
      const cap = Math.max(p.topSpeed, this.boostCap);
      const topLimiter = clamp((cap - Math.max(fwdSpeed, 0)) / (cap * 0.08), 0, 1);
      drive = Math.min(p.maxDriveForce, p.maxPower / Math.max(fwdSpeed, 3)) * accel * topLimiter;
    } else if (reversing) {
      const lim = clamp((p.maxReverseSpeed + Math.min(fwdSpeed, 0)) / p.maxReverseSpeed, 0, 1);
      drive = -p.maxDriveForce * p.reverseForceScale * brake * lim;
    }
    if (this.engineOff) drive = 0;
    const brakeTotal = braking ? p.brakeForce * brake : 0;
    const engineBrake = accel === 0 && !reversing && !this.engineOff ? p.engineBrake : 0;

    for (let k = 0; k < 4; k++) {
      const w = this.wheels[k]!;
      if (!w.contact || w.load <= 0) {
        // visual freewheel spin
        w.spin += (fwdSpeed / p.wheelRadius) * dt;
        continue;
      }
      const front = k < 2;
      const n = w.normal;
      const surfProps = SURFACES[w.surface];

      // wheel basis on the contact plane
      const sa = front ? this.steerAngle : 0;
      _f.set(Math.sin(sa), 0, -Math.cos(sa)).applyQuaternion(this.quaternion);
      _f.addScaledVector(n, -_f.dot(n)).normalize(); // wheel forward
      const wf = _f.clone();
      const wr = _t.copy(wf).cross(n).normalize(); // wheel right
      const wrC = wr.clone();

      // velocity of the contact patch
      _r.copy(w.contactPoint).sub(this.position);
      _v.copy(this.angvel).cross(_r).add(this.linvel);
      const vf = _v.dot(wf);
      const vl = _v.dot(wrC);

      // friction budget
      const mu0 = (front ? p.gripFront : p.gripRear) * surfProps.grip * p.surfaceGrip[w.surface];
      // per-surface tyre model: loose ground peaks later and gently, ice falls off a cliff
      const peakSlip = p.peakSlipAngle * surfProps.peakSlip;
      const slideKeep = Math.min(1, p.slideRatio * surfProps.slideKeep);
      const loadRatio = Math.max(w.load, 1) / p.nominalLoad;
      let fmax = mu0 * p.nominalLoad * Math.pow(loadRatio, 1 - p.loadSensitivity);
      let fmaxLat = fmax;
      if (!front) fmaxLat *= 1 - p.brakeRearSlide * brake * (braking || accel > 0 ? 1 : 0.5);
      const fmaxLong = fmax * p.longGripScale;

      // longitudinal demand on this wheel
      const driveShare = front ? 1 - p.driveRearBias : p.driveRearBias;
      let fx = (drive * driveShare) / 2;
      const meffLong = this.effectiveMass(_r, wf, inertia);
      // braking opposes motion, never reverses it within a tick
      const brakeShare = front ? p.brakeFrontBias : 1 - p.brakeFrontBias;
      const brakeAbs = Math.min((brakeTotal * brakeShare) / 2 + (engineBrake * driveShare) / 2, (absSpeed < 0.01 ? 0 : Math.abs(vf)) * meffLong * share / dt);
      const rolling = Math.min(surfProps.rolling * p.surfaceRolling[w.surface] * w.load, Math.abs(vf) * meffLong * share / dt);
      fx -= sign(vf) * (brakeAbs + rolling);
      // hold the car on slopes when completely idle
      if (accel === 0 && brake === 0 && absSpeed < 1.0) {
        fx -= clamp((vf * meffLong * share) / dt, -0.6 * fmaxLong, 0.6 * fmaxLong);
      }
      const fxCmd = fx;
      fx = clamp(fx, -fmaxLong, fmaxLong);
      w.slipping = Math.abs(fxCmd) > fmaxLong * 1.001;

      // lateral: slip-angle curve scaled by what's left of the friction ellipse
      const alpha = Math.atan2(vl, Math.max(Math.abs(vf), SLIP_MIN_SPEED));
      const s = Math.abs(alpha) / peakSlip;
      let curve: number;
      if (s <= 1) curve = Math.sin(s * Math.PI * 0.5);
      else {
        const t = clamp((s - 1) / p.slideRange, 0, 1);
        curve = 1 + (slideKeep - 1) * (t * t * (3 - 2 * t));
      }
      const ratio = Math.min(1, Math.abs(fx) / Math.max(fmaxLong, 1));
      const latBudget = fmaxLat * Math.pow(Math.max(0, 1 - Math.pow(ratio, p.ellipseExp)), 1 / p.ellipseExp);
      let fy = -sign(vl) * curve * latBudget;
      const meffLat = this.effectiveMass(_r, wrC, inertia);
      const latCap = (Math.abs(vl) * meffLat * share) / dt;
      fy = clamp(fy, -latCap, latCap);

      w.slipAngle = alpha;
      w.forceLat = fy;
      w.forceLong = fx;
      w.gripUse = Math.hypot(fx / Math.max(fmaxLong, 1), fy / Math.max(fmaxLat, 1));

      // apply at the contact patch, shifted to the configured force height
      _f.copy(wf).multiplyScalar(fx).addScaledVector(wrC, fy);
      _p.copy(w.contactPoint);
      const localY = _r.copy(_p).sub(this.position).dot(this.up);
      _p.addScaledVector(this.up, p.forceApplyY - localY);
      this.addForceAt(_f, _p);

      // visuals: wheelspin when the drive demand saturates, lock when braking saturates
      const extra = w.slipping ? sign(fxCmd) * Math.min(25, (Math.abs(fxCmd) / fmaxLong - 1) * 40 + 4) : 0;
      w.spin += ((vf + extra) / p.wheelRadius) * dt;
    }
  }

  /**
   * With only 1-3 wheels touching (a banked entry, a landing on one corner, a loop transition) pull the
   * chassis up-axis toward the average contact normal so the free wheels find the surface again.
   */
  private applyGroundAlign(inertia: Vector3): void {
    const k = this.params.groundAlign;
    const n = this.wheelsOnGround;
    if (k <= 0 || n === 0 || n === 4) return;
    _f.set(0, 0, 0);
    for (const w of this.wheels) if (w.contact) _f.add(w.normal);
    if (_f.lengthSq() < 1e-6) return;
    _f.normalize();
    const err = _p.copy(this.up).cross(_f); // world axis, magnitude = sin(angle between up and normal)
    _qi.copy(this.quaternion).invert();
    const el = err.applyQuaternion(_qi);
    const wl = _w.copy(this.angvel).applyQuaternion(_qi);
    const scale = (4 - n) / 3;
    const kd = 2 * Math.sqrt(k) * 0.9;
    const tx = (k * el.x - kd * wl.x) * scale * inertia.x;
    const tz = (k * el.z - kd * wl.z) * scale * inertia.z;
    this.torque.add(_t.set(tx, 0, tz).applyQuaternion(this.quaternion));
  }

  private applyAero(): void {
    const p = this.params;
    const v2 = this.linvel.lengthSq();
    if (v2 < 1e-6) return;
    const speed = Math.sqrt(v2);
    // drag at COM
    _f.copy(this.linvel).multiplyScalar(-p.dragCoef * speed);
    this.force.add(_f);
    // downforce, split front/rear; reduced in the air so jumps stay long and floaty-free
    const grounded = this.wheelsOnGround / 4;
    const df = p.downforceCoef * v2 * (0.45 + 0.55 * grounded);
    _f.copy(this.up).multiplyScalar(-df * p.aeroFrontBalance);
    _p.set(0, 0, p.frontAxleZ).applyQuaternion(this.quaternion).add(this.position);
    this.addForceAt(_f, _p);
    _f.copy(this.up).multiplyScalar(-df * (1 - p.aeroFrontBalance));
    _p.set(0, 0, p.rearAxleZ).applyQuaternion(this.quaternion).add(this.position);
    this.addForceAt(_f, _p);
  }

  private applyAirControl(input: InputFrame, inertia: Vector3): void {
    const p = this.params;
    _qi.copy(this.quaternion).invert();
    const wl = _w.copy(this.angvel).applyQuaternion(_qi); // local angular velocity

    // Targets: + X = nose up, + Y = turn left, + Z = roll left.
    const pitchIn = input.brake - input.accel;
    const tx = pitchIn * p.airPitchRate;
    const ty = -input.steer * p.airYawRate;
    const tz = -input.steer * p.airRollRate;
    const maxA = p.airControlAccel;
    const gain = 14;

    let ax: number;
    if (this.speed > 12 && p.airLevelAssist > 0) {
      // Attitude control relative to the flight path: the nose follows the trajectory, and the
      // pitch keys shift it by up to +/- airPitchOffset. Holding a pedal over a jump cannot
      // run away into a flip, and landings come in aligned with the path.
      const vl = _lv.copy(this.linvel).applyQuaternion(_qi).normalize();
      const pitchErr = Math.atan2(vl.y, -vl.z) + pitchIn * p.airPitchOffset;
      this.dbgAir.pitchErr = pitchErr;
      // feed-forward: gravity turns the velocity vector down at about g*cos(gamma)/v rad/s
      const gamma = Math.atan2(this.linvel.y, Math.hypot(this.linvel.x, this.linvel.z));
      const ff = (-this.gravity * Math.cos(gamma)) / this.speed;
      const k = p.airLevelAssist;
      ax = clamp(k * 20 * pitchErr + k * 8 * (ff - wl.x), -maxA, maxA);
    } else if (pitchIn !== 0) {
      ax = clamp((tx - wl.x) * gain, -maxA, maxA); // slow / assist off: free rate control
    } else {
      ax = -wl.x * p.airDamping;
    }
    this.dbgAir.ax = ax;
    this.dbgAir.wx = wl.x;
    this.dbgAir.pitchIn = pitchIn;
    const ay = input.steer !== 0 ? clamp((ty - wl.y) * gain, -maxA, maxA) : -wl.y * p.airDamping;
    let az: number;
    if (this.speed > 12 && p.airLevelAssist > 0) {
      // Roll is an attitude, not a rate: the car self-levels to upright and steering banks it by
      // up to +/- airRollOffset. (+ roll = right side down, wrapped so an inverted car rights itself.)
      const roll = Math.atan2(-this.right.y, this.up.y);
      const target = input.steer * p.airRollOffset;
      let e = target - roll;
      e = Math.atan2(Math.sin(e), Math.cos(e));
      const k = p.airLevelAssist;
      az = clamp(-k * 20 * e - k * 8 * wl.z, -maxA, maxA);
    } else {
      az = input.steer !== 0 ? clamp((tz - wl.z) * gain, -maxA, maxA) : -wl.z * p.airDamping;
    }

    // local torque -> world torque
    const tq = _t.set(ax * inertia.x, ay * inertia.y, az * inertia.z).applyQuaternion(this.quaternion);
    this.torque.add(tq);
  }

  /** Interpolated pose for rendering: alpha in [0,1) between prev and curr physics steps. */
  interpolate(alpha: number, out: RenderPose): void {
    const a = this.prev;
    const b = this.curr;
    out.position.lerpVectors(a.position, b.position, alpha);
    out.quaternion.slerpQuaternions(a.quaternion, b.quaternion, alpha);
    for (let k = 0; k < 4; k++) {
      out.springLen[k] = a.springLen[k]! + (b.springLen[k]! - a.springLen[k]!) * alpha;
      out.steer[k] = a.steer[k]! + (b.steer[k]! - a.steer[k]!) * alpha;
      out.spin[k] = a.spin[k]! + (b.spin[k]! - a.spin[k]!) * alpha;
    }
  }

  dispose(): void {
    if (this.body) this.physics.world.removeRigidBody(this.body);
  }

  /** Cheap deterministic hash of the full dynamic state, used by determinism tests. */
  stateHash(): number[] {
    return [
      this.position.x, this.position.y, this.position.z,
      this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w,
      this.linvel.x, this.linvel.y, this.linvel.z,
      this.angvel.x, this.angvel.y, this.angvel.z,
      this.steerAngle,
    ];
  }
}
