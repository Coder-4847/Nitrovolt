import { AdditiveBlending, BufferAttribute, BufferGeometry, LineSegments, ShaderMaterial, Vector3 } from 'three';
import { Rng } from '../core/Rng';

/** Hot streaks thrown off on wall hits, scrapes and hard landings. Pooled line segments, additive. */
export class Sparks {
  readonly mesh: LineSegments;
  private readonly max: number;
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly verts: Float32Array;
  private readonly heat: Float32Array;
  private readonly geo = new BufferGeometry();
  private head = 0;
  private live = 0;
  private readonly rng = new Rng(4242);

  constructor(max = 360) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1e9);
    this.life = new Float32Array(max).fill(1);
    this.verts = new Float32Array(max * 6);
    this.heat = new Float32Array(max * 2);
    this.geo.setAttribute('position', new BufferAttribute(this.verts, 3));
    this.geo.setAttribute('aHeat', new BufferAttribute(this.heat, 1));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `attribute float aHeat; varying float vH; void main(){ vH = aHeat; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vH; void main(){
        vec3 c = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.55), vH);
        gl_FragColor = vec4(c * (0.5 + vH * 0.6), vH);
        #include <colorspace_fragment>
      }`,
    });
    this.mesh = new LineSegments(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  /** A burst at `at`, thrown along `dir` (plus the car's velocity) with spread. */
  burst(at: Vector3, carVel: Vector3, dir: Vector3, count: number, power = 1): void {
    const r = this.rng;
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const s = (4 + r.next() * 9) * power;
      this.p.set([at.x + r.range(-0.4, 0.4), at.y + r.range(-0.1, 0.25), at.z + r.range(-0.4, 0.4)], i * 3);
      this.v.set([
        carVel.x * 0.6 + dir.x * s + r.range(-3, 3),
        carVel.y * 0.3 + Math.abs(dir.y) * s + r.range(1, 5),
        carVel.z * 0.6 + dir.z * s + r.range(-3, 3),
      ], i * 3);
      this.age[i] = 0;
      this.life[i] = r.range(0.25, 0.7);
    }
    this.live = 1;
  }

  update(dt: number): void {
    if (!this.live) return;
    let any = 0;
    for (let i = 0; i < this.max; i++) {
      const a = (this.age[i]! += dt);
      const t = a / this.life[i]!;
      const o = i * 3;
      if (t >= 1) {
        this.verts.fill(0, i * 6, i * 6 + 6);
        this.heat[i * 2] = this.heat[i * 2 + 1] = 0;
        continue;
      }
      any = 1;
      this.v[o + 1]! -= 22 * dt;
      const drag = Math.exp(-1.2 * dt);
      this.v[o]! *= drag; this.v[o + 2]! *= drag;
      this.p[o]! += this.v[o]! * dt; this.p[o + 1]! += this.v[o + 1]! * dt; this.p[o + 2]! += this.v[o + 2]! * dt;
      const tail = 0.022;
      this.verts.set([this.p[o]!, this.p[o + 1]!, this.p[o + 2]!, this.p[o]! - this.v[o]! * tail, this.p[o + 1]! - this.v[o + 1]! * tail, this.p[o + 2]! - this.v[o + 2]! * tail], i * 6);
      this.heat[i * 2] = 1 - t;
      this.heat[i * 2 + 1] = (1 - t) * 0.3;
    }
    this.live = any;
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.aHeat!.needsUpdate = true;
  }

  clear(): void {
    this.age.fill(1e9);
    this.verts.fill(0);
    this.heat.fill(0);
    this.geo.attributes.position!.needsUpdate = true;
    this.live = 0;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
  }
}
