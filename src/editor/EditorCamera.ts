import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

/** Orbit / pan / zoom camera around a ground target, with a straight-down top view. */
export class EditorCamera {
  readonly camera = new PerspectiveCamera(55, 16 / 9, 0.5, 6000);
  readonly target = new Vector3(0, 0, -40);
  yaw = 0.5;
  pitch = 0.75;
  dist = 150;
  top = false;

  orbit(dx: number, dy: number): void {
    this.yaw -= dx * 0.006;
    this.pitch = MathUtils.clamp(this.pitch + dy * 0.005, 0.12, 1.5);
  }

  /** Pan in screen space (pixels). */
  pan(dx: number, dy: number): void {
    const k = this.dist * 0.0018;
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
  }

  /** Move the target along the ground (keyboard), metres per second scaled by zoom. */
  move(fx: number, fz: number, dt: number): void {
    const v = this.dist * 1.1 * dt;
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, fx * v).addScaledVector(fwd, fz * v);
  }

  zoom(factor: number): void {
    this.dist = MathUtils.clamp(this.dist * factor, 18, 1400);
  }

  update(): void {
    const pitch = this.top ? 1.5699 : this.pitch;
    const c = Math.cos(pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * c * this.dist,
      this.target.y + Math.sin(pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * c * this.dist,
    );
    this.camera.lookAt(this.target);
  }

  snapshot(): { target: [number, number, number]; yaw: number; pitch: number; dist: number; top: boolean } {
    return { target: this.target.toArray() as [number, number, number], yaw: this.yaw, pitch: this.pitch, dist: this.dist, top: this.top };
  }

  restore(s: ReturnType<EditorCamera['snapshot']>): void {
    this.target.set(...s.target);
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.dist = s.dist;
    this.top = s.top;
  }
}
