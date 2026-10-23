import { BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Vector3 } from 'three';
import { SURFACES } from '../physics/Surface';
import { Vehicle } from '../physics/Vehicle';

/** Seconds a mark stays before fading out. */
const LIFE = 30;
const _a = new Vector3();
const _b = new Vector3();
const _side = new Vector3();
const _dir = new Vector3();
const _c = new Color();

/**
 * Tyre marks: black rubber on hard surfaces when sliding, darker ruts on loose ground whenever the car
 * drives over it. A pooled ring buffer of quads in one draw call; old segments are overwritten and fade.
 */
export class SkidMarks {
  readonly mesh: Mesh;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly born: Float32Array;
  private readonly geo = new BufferGeometry();
  private readonly mat: ShaderMaterial;
  private head = 0;
  private time = 0;
  private readonly last: Array<Vector3 | null> = [null, null, null, null];
  private readonly lastStrength = [0, 0, 0, 0];
  width = 0.3;

  constructor(maxSegments: number, fog: { color: number; near: number; far: number }) {
    this.max = maxSegments;
    this.pos = new Float32Array(maxSegments * 4 * 3);
    this.col = new Float32Array(maxSegments * 4 * 4);
    this.born = new Float32Array(maxSegments * 4).fill(-1e9);
    const idx = new Uint32Array(maxSegments * 6);
    for (let i = 0; i < maxSegments; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new BufferAttribute(this.col, 4));
    this.geo.setAttribute('aBorn', new BufferAttribute(this.born, 1));
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: true,
      uniforms: { uTime: { value: 0 }, fogColor: { value: new Color(fog.color) }, fogNear: { value: fog.near }, fogFar: { value: fog.far } },
      vertexShader: `
        attribute vec4 aColor; attribute float aBorn; uniform float uTime; varying vec4 vC;
        #include <fog_pars_vertex>
        void main() {
          float age = uTime - aBorn;
          vC = vec4(aColor.rgb, aColor.a * (1.0 - smoothstep(${(LIFE * 0.6).toFixed(1)}, ${LIFE.toFixed(1)}, age)));
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        varying vec4 vC;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vC;
          #include <fog_fragment>
        }`,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  update(dt: number, v: Vehicle): void {
    this.time += dt;
    this.mat.uniforms.uTime!.value = this.time;
    let dirty = false;
    for (let k = 0; k < 4; k++) {
      const w = v.wheels[k]!;
      const surf = SURFACES[w.surface];
      let strength = 0;
      if (w.contact && v.speed > 2.5) {
        const sliding = w.slipping || Math.abs(w.slipAngle) > 0.14 || w.gripUse > 1.0;
        if (surf.loose) strength = sliding ? 0.55 : 0.3;
        else if (sliding) strength = Math.min(0.75, 0.35 + Math.abs(w.slipAngle) * 1.5);
        if (w.effect && w.effect !== 'fragile') strength = 0;
      }
      if (strength <= 0) {
        this.last[k] = null;
        continue;
      }
      const p = _a.copy(w.contactPoint).addScaledVector(w.normal, 0.025);
      const prev = this.last[k];
      if (!prev) {
        this.last[k] = p.clone();
        this.lastStrength[k] = strength;
        continue;
      }
      const d = prev.distanceTo(p);
      if (d < 0.35) continue;
      if (d > 4) {
        prev.copy(p);
        continue;
      }
      _dir.subVectors(p, prev).normalize();
      _side.crossVectors(_dir, w.normal).normalize().multiplyScalar(this.width / 2);
      if (surf.loose) _c.setHex(surf.color).multiplyScalar(0.55);
      else _c.setRGB(0.02, 0.02, 0.025);
      this.segment(prev, p, _side, _c, this.lastStrength[k]!, strength);
      prev.copy(p);
      this.lastStrength[k] = strength;
      dirty = true;
    }
    if (dirty) {
      this.geo.attributes.position!.needsUpdate = true;
      this.geo.attributes.aColor!.needsUpdate = true;
      this.geo.attributes.aBorn!.needsUpdate = true;
    }
  }

  private segment(a: Vector3, b: Vector3, side: Vector3, c: Color, sa: number, sb: number): void {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const P = this.pos, C = this.col;
    _b.copy(a).sub(side); P.set([_b.x, _b.y, _b.z], i * 12);
    _b.copy(a).add(side); P.set([_b.x, _b.y, _b.z], i * 12 + 3);
    _b.copy(b).add(side); P.set([_b.x, _b.y, _b.z], i * 12 + 6);
    _b.copy(b).sub(side); P.set([_b.x, _b.y, _b.z], i * 12 + 9);
    for (let k = 0; k < 4; k++) {
      C.set([c.r, c.g, c.b, k < 2 ? sa : sb], (i * 4 + k) * 4);
      this.born[i * 4 + k] = this.time;
    }
  }

  clear(): void {
    this.born.fill(-1e9);
    this.col.fill(0);
    this.last.fill(null);
    this.geo.attributes.aColor!.needsUpdate = true;
    this.geo.attributes.aBorn!.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
