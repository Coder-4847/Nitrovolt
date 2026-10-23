import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { CameraStyle } from '../data/cars';
import { RenderPose } from '../physics/Vehicle';

export type CameraMode = 'chase' | 'far' | 'hood';
export const CAMERA_MODES: CameraMode[] = ['chase', 'far', 'hood'];

const WORLD_UP = new Vector3(0, 1, 0);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential smoothing factor. */
const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

const _v = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();

/** Chase / far / hood cameras with speed-based FOV, landing shake and loop-aware roll following. */
export class CameraRig {
  readonly camera = new PerspectiveCamera(70, 1, 0.2, 4000);
  mode: CameraMode = 'chase';
  /** Per-car camera character (distance, lag, FOV, shake). */
  style: CameraStyle = { distance: 6.4, height: 2.0, speedPull: 1.6, lookAhead: 9, fovBase: 70, fovKick: 30, headingRate: 7, positionRate: 22, shake: 1 };
  /** Reduced-motion: no shake, smaller FOV kick. */
  reducedMotion = false;

  private readonly dir = new Vector3(0, 0, -1);
  private readonly up = new Vector3(0, 1, 0);
  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private fov = 70;
  private shake = 0;
  private clock = 0;
  private ready = false;

  /** Snap to the car on next update (restart / respawn). */
  snap(): void {
    this.ready = false;
  }

  cycle(): CameraMode {
    this.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]!;
    this.snap();
    return this.mode;
  }

  addShake(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(1.2, this.shake + amount * this.style.shake);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, pose: RenderPose, velocity: Vector3, speed: number, boost = 0): void {
    this.clock += dt;
    const car = pose.position;
    const carFwd = _t.set(0, 0, -1).applyQuaternion(pose.quaternion);

    const kick = this.reducedMotion ? 0.4 : 1;
    const st = this.style;
    const fovBase = this.mode === 'hood' ? st.fovBase + 6 : this.mode === 'far' ? st.fovBase - 4 : st.fovBase;
    const fovTarget = fovBase + st.fovKick * kick * smoothstep(12, 88, speed) + 10 * kick * boost;
    if (!this.ready) this.fov = fovTarget;
    this.fov += (fovTarget - this.fov) * damp(5, dt);

    if (this.mode === 'hood') {
      this.camera.position.set(0, 0.5, -0.05).applyQuaternion(pose.quaternion).add(car);
      this.camera.quaternion.copy(pose.quaternion);
      this.applyShake(dt);
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.ready = true;
      return;
    }

    // --- heading: blend car nose with velocity so drifts keep the road ahead in view ---
    const target = carFwd.clone();
    if (speed > 6) {
      _v.copy(velocity).normalize();
      const b = 0.5 * smoothstep(6, 22, speed);
      target.lerp(_v, b).normalize();
    }
    // --- up: stay roughly level normally, fully follow the car on loops / walls ---
    const carUpWorld = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
    const upAngle = Math.acos(MathUtils.clamp(carUpWorld.dot(WORLD_UP), -1, 1));
    const w = 0.3 + 0.7 * smoothstep(0.45, 1.4, upAngle);
    const upTarget = WORLD_UP.clone().multiplyScalar(1 - w).addScaledVector(carUpWorld, w).normalize();

    if (!this.ready) {
      this.dir.copy(target);
      this.up.copy(upTarget);
    } else {
      this.dir.lerp(target, damp(st.headingRate, dt)).normalize();
      this.up.lerp(upTarget, damp(6, dt)).normalize();
    }
    const dirP = this.dir.clone().addScaledVector(this.up, -this.dir.dot(this.up)).normalize();

    const far = this.mode === 'far';
    const dist = (far ? st.distance * 1.65 : st.distance) + st.speedPull * smoothstep(20, 85, speed) + 1.2 * boost;
    const height = far ? st.height * 1.9 : st.height;
    const desired = car.clone().addScaledVector(dirP, -dist).addScaledVector(this.up, height);

    if (!this.ready) this.pos.copy(desired);
    else this.pos.lerp(desired, damp(st.positionRate, dt));
    this.look.copy(car).addScaledVector(dirP, st.lookAhead).addScaledVector(this.up, 0.7);

    this.camera.position.copy(this.pos);
    this.camera.up.copy(this.up);
    this.camera.lookAt(this.look);
    this.applyShake(dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.ready = true;
  }

  /**
   * Something solid is between the car and the camera: put the camera `dist` from `origin` along `dir`
   * (in front of the obstacle). The smoothed position follows, so it eases back out once the view clears.
   */
  constrain(dist: number, origin: Vector3, dir: Vector3): void {
    this.camera.position.copy(origin).addScaledVector(dir, dist);
    this.pos.copy(this.camera.position);
    this.camera.lookAt(this.look);
  }

  private applyShake(dt: number): void {
    if (this.shake < 0.002) {
      this.shake = 0;
      return;
    }
    const a = this.shake * 0.18;
    _q.copy(this.camera.quaternion);
    _v.set(0.7 * Math.sin(this.clock * 53), Math.sin(this.clock * 71 + 1.7), 0).multiplyScalar(a).applyQuaternion(_q);
    this.camera.position.add(_v);
    this.shake *= Math.exp(-9 * dt);
  }
}
