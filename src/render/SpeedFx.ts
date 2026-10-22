import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, MathUtils, Vector3 } from 'three';
import { Rng } from '../core/Rng';

const smoothstep = (a: number, b: number, x: number): number => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Wind streaks that rush past the camera; the main "readable speed" cue besides FOV. */
export class SpeedFx {
  readonly mesh: LineSegments;
  private readonly count: number;
  private readonly offs: Float32Array; // x, y (camera plane), depth
  private readonly attr: BufferAttribute;
  private readonly mat: LineBasicMaterial;
  private readonly rng = new Rng(1234);

  constructor(count: number) {
    this.count = count;
    this.offs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.respawn(i, true);
    const geo = new BufferGeometry();
    this.attr = new BufferAttribute(new Float32Array(count * 6), 3);
    geo.setAttribute('position', this.attr);
    this.mat = new LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.mesh = new LineSegments(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  private respawn(i: number, anywhere: boolean): void {
    const ang = this.rng.range(0, Math.PI * 2);
    const rad = this.rng.range(2.6, 13);
    this.offs[i * 3] = Math.cos(ang) * rad * 1.5;
    this.offs[i * 3 + 1] = Math.sin(ang) * rad;
    this.offs[i * 3 + 2] = anywhere ? this.rng.range(-4, 70) : this.rng.range(55, 75);
  }

  update(dt: number, camPos: Vector3, camRight: Vector3, camUp: Vector3, camFwd: Vector3, velocity: Vector3, speed: number, enabled: boolean, boost = 0): void {
    const strength = enabled ? Math.max(smoothstep(32, 85, speed), boost * 0.95) : 0;
    this.mat.opacity = strength * 0.5;
    this.mesh.visible = strength > 0.01;
    if (!this.mesh.visible) return;
    const vdir = velocity.clone().normalize();
    const len = MathUtils.clamp(speed * 0.04, 0.8, 4.2);
    const pos = this.attr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      this.offs[i * 3 + 2]! -= speed * dt;
      if (this.offs[i * 3 + 2]! < -6) this.respawn(i, false);
      const x = this.offs[i * 3]!, y = this.offs[i * 3 + 1]!, d = this.offs[i * 3 + 2]!;
      const px = camPos.x + camRight.x * x + camUp.x * y + camFwd.x * d;
      const py = camPos.y + camRight.y * x + camUp.y * y + camFwd.y * d;
      const pz = camPos.z + camRight.z * x + camUp.z * y + camFwd.z * d;
      pos[i * 6] = px;
      pos[i * 6 + 1] = py;
      pos[i * 6 + 2] = pz;
      pos[i * 6 + 3] = px + vdir.x * len;
      pos[i * 6 + 4] = py + vdir.y * len;
      pos[i * 6 + 5] = pz + vdir.z * len;
    }
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
