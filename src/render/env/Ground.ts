import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { GroundKind, ThemeDef } from './Theme';

const KIND: Record<GroundKind, number> = { grass: 0, urban: 1, snow: 2, sand: 3, water: 4 };

/**
 * Endless ground plane under the track, shaded per theme: mown grass, city pavement with parks, snow
 * field, sand with wind ripples and dunes, or a lit sea. Fine detail fades out with distance (no shimmer).
 * Follows the camera in 50 m steps; the patterns are in world space so the steps never show.
 */
export class Ground {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      fog: false,
      uniforms: {
        uA: { value: new Color() },
        uB: { value: new Color() },
        uFog: { value: new Color() },
        uSky: { value: new Color() },
        uSun: { value: new Vector3(0, 1, 0) },
        uSunCol: { value: new Color() },
        uKind: { value: 0 },
        uTime: { value: 0 },
        uFar: { value: 1200 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform vec3 uA, uB, uFog, uSky, uSun, uSunCol; uniform float uKind, uTime, uFar; varying vec3 vW;
        float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
        // anti-aliased thin lines every size metres, w wide (fades to their average when sub-pixel)
        float lines(vec2 p, float size, float w) {
          vec2 q = p / size;
          vec2 fw = max(fwidth(q), vec2(1e-4));
          vec2 g = abs(fract(q - 0.5) - 0.5);
          vec2 l = 1.0 - smoothstep(vec2(w / size) - fw, vec2(w / size) + fw, g);
          float line = max(l.x, l.y);
          float avg = clamp(2.0 * w / size, 0.0, 1.0);
          return mix(line, avg, smoothstep(0.25, 1.0, max(fw.x, fw.y) * size / w * 0.25));
        }
        void main(){
          vec3 col;
          vec3 view = normalize(vW - cameraPosition);
          float dist = length(vW.xz - cameraPosition.xz);
          float detail = exp(-dist * 0.004);
          if (uKind < 0.5) {
            // grass: broad mowing stripes plus soft patches
            float n = fbm(vW.xz * 0.012);
            float stripe = smoothstep(0.35, 0.65, abs(fract(vW.x / 24.0) - 0.5) * 2.0);
            col = mix(uA, uB, stripe * 0.6 * detail + n * 0.4);
            col *= 0.94 + 0.12 * fbm(vW.xz * 0.15) * detail;
          } else if (uKind < 1.5) {
            // pavement: slab joints, worn patches and parks
            float n = fbm(vW.xz * 0.006);
            col = uA * (0.9 + 0.16 * fbm(vW.xz * 0.05));
            col = mix(col, uB, lines(vW.xz, 6.0, 0.12) * 0.35 * detail);
            float park = smoothstep(0.58, 0.64, n);
            vec3 green = vec3(0.24, 0.36, 0.2) * (0.85 + 0.3 * fbm(vW.xz * 0.08));
            col = mix(col, green, park);
          } else if (uKind < 2.5) {
            float n = fbm(vW.xz * 0.02) * 0.6 + fbm(vW.xz * 0.15) * 0.4;
            col = mix(uB, uA, smoothstep(0.25, 0.75, n));
          } else if (uKind < 3.5) {
            float dune = fbm(vW.xz * 0.006);
            float rip = sin(vW.x * 1.3 + vW.z * 0.4 + fbm(vW.xz * 0.1) * 6.0) * 0.5 + 0.5;
            col = mix(uB, uA, dune * 0.9 + 0.1);
            col *= 0.94 + 0.06 * rip * exp(-dist * 0.02);
          } else {
            // water: animated normals from two wave layers, fresnel sky reflection and a sun glint
            vec2 p = vW.xz;
            float w1 = noise(p * 0.08 + vec2(uTime * 0.12, uTime * 0.05));
            float w2 = noise(p * 0.3 - vec2(uTime * 0.2, -uTime * 0.13));
            vec3 n = normalize(vec3(((w1 - 0.5) * 0.5 + (w2 - 0.5) * 0.25) * detail, 1.0, (w2 - 0.5) * 0.5 * detail));
            vec3 r = reflect(view, n);
            float fres = pow(1.0 - clamp(dot(-view, n), 0.0, 1.0), 4.0);
            col = mix(uA, uSky * 0.85, 0.06 + 0.6 * fres);
            float glint = pow(clamp(dot(r, normalize(uSun)), 0.0, 1.0), 220.0);
            col += uSunCol * glint * 1.2;
            col = mix(col, uB, 0.15 * w1);
          }
          col = mix(col, uFog, smoothstep(uFar * 0.25, uFar * 1.6, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(new PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), this.mat);
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
  }

  apply(t: ThemeDef, sunDir: Vector3): void {
    const u = this.mat.uniforms;
    (u.uA!.value as Color).setHex(t.ground.a);
    (u.uB!.value as Color).setHex(t.ground.b);
    (u.uFog!.value as Color).setHex(t.fog.color);
    (u.uSky!.value as Color).setHex(t.sky.horizon);
    (u.uSunCol!.value as Color).setHex(t.sky.sunColor);
    (u.uSun!.value as Vector3).copy(sunDir);
    u.uKind!.value = KIND[t.ground.kind];
    u.uFar!.value = t.fog.far;
  }

  update(time: number, camera: Vector3): void {
    this.mat.uniforms.uTime!.value = time;
    this.mesh.position.x = Math.round(camera.x / 50) * 50;
    this.mesh.position.z = Math.round(camera.z / 50) * 50;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
