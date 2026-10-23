import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';

/** Pooled soft-disc point sprites (dust, spray, smoke). One draw call, CPU-updated ring buffer. */
export class Particles {
  readonly points: Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size0: Float32Array;
  private readonly grow: Float32Array;
  private readonly a0: Float32Array;
  private readonly rise: Float32Array;
  private head = 0;
  private readonly geo: BufferGeometry;
  private readonly mat: ShaderMaterial;

  constructor(max = 1400) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1e9);
    this.life = new Float32Array(max).fill(1);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.rise = new Float32Array(max);
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new BufferAttribute(this.col, 4));
    this.geo.setAttribute('aSize', new BufferAttribute(this.size, 1));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute vec4 aColor; attribute float aSize; uniform float uScale;
        varying vec4 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = -mv.z;
          // smoke right at the lens would cover the screen: fade it out close up, and cap the sprite size
          vColor = vec4(aColor.rgb, aColor.a * smoothstep(0.8, 3.5, depth));
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aSize * uScale / max(depth, 0.1), 320.0);
        }`,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = (1.0 - smoothstep(0.05, 0.5, d)) * vColor.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Pixels per metre at distance 1 (viewport height / (2 tan(fov/2))). */
  setScale(pxPerMetre: number): void {
    this.mat.uniforms.uScale!.value = pxPerMetre;
  }

  emit(
    x: number, y: number, z: number, vx: number, vy: number, vz: number,
    life: number, size: number, grow: number, r: number, g: number, b: number, alpha: number, rise = 0,
  ): void {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size0[i] = size;
    this.grow[i] = grow;
    this.a0[i] = alpha;
    this.rise[i] = rise;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b;
  }

  update(dt: number): void {
    const damp = Math.exp(-1.6 * dt);
    for (let i = 0; i < this.max; i++) {
      const age = this.age[i]! + dt;
      this.age[i] = age;
      const life = this.life[i]!;
      if (age >= life) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      const t = age / life;
      this.vel[i * 3]! *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * damp + this.rise[i]! * dt;
      this.vel[i * 3 + 2]! *= damp;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.size[i] = this.size0[i]! * (1 + this.grow[i]! * t);
      this.col[i * 4 + 3] = this.a0[i]! * (1 - t) * Math.min(1, age * 14);
    }
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.aColor!.needsUpdate = true;
    this.geo.attributes.aSize!.needsUpdate = true;
  }

  clear(): void {
    this.age.fill(1e9);
    this.size.fill(0);
    this.col.fill(0);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
