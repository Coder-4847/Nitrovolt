import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { ThemeDef } from './Theme';

/**
 * Procedural daytime sky dome: zenith-to-horizon gradient with a soft haze band, the sun with a gentle glow
 * and two layers of drifting clouds, all from one shader. Follows the camera and is drawn first, behind
 * everything (no depth test, so it can never be clipped at the far plane).
 */
export class Sky {
  readonly mesh: Mesh;
  readonly sunDir = new Vector3(0.45, 0.6, 0.35).normalize();
  private readonly mat: ShaderMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uNadir: { value: new Color() },
        uSunCol: { value: new Color() },
        uCloudCol: { value: new Color() },
        uSun: { value: this.sunDir },
        uSunSize: { value: 0.6 },
        uSunGlow: { value: 0.3 },
        uClouds: { value: 0.3 },
        uStars: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uNadir, uSunCol, uCloudCol, uSun;
        uniform float uSunSize, uSunGlow, uClouds, uStars, uTime;
        varying vec3 vDir;
        float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float up = clamp(h, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, sqrt(up) * (2.0 - sqrt(up)) * 0.85 + up * 0.15);
          // brighter, whiter haze right at the horizon, then the ground colour below it
          col = mix(col, mix(uHorizon, vec3(1.0), 0.25), exp(-abs(h) * 28.0) * 0.5);
          col = mix(col, uNadir, smoothstep(0.0, -0.12, h));
          float s = max(dot(d, uSun), 0.0);
          // night: a field of stars, fewer near the haze at the horizon
          if (uStars > 0.0 && h > 0.0) {
            vec2 sp = vec2(atan(d.z, d.x) * 180.0, asin(clamp(h, 0.0, 1.0)) * 360.0);
            vec2 cell = floor(sp);
            float r = hash2(cell);
            vec2 o = fract(sp) - vec2(hash2(cell + 3.1), hash2(cell + 7.7));
            float star = step(0.985, r) * smoothstep(0.12, 0.0, length(o)) * (0.5 + 0.5 * hash2(cell + 1.3));
            col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.02, 0.25, h);
          }
          // clouds: a broad soft layer and a finer one, lit toward the sun
          if (uClouds > 0.0 && h > 0.01) {
            vec2 uv = d.xz / (h + 0.1);
            float c1 = smoothstep(0.55 - uClouds * 0.25, 0.9, fbm(uv * 0.9 + vec2(uTime * 0.004, uTime * 0.0015)));
            float c2 = smoothstep(0.6 - uClouds * 0.2, 0.95, fbm(uv * 2.6 + vec2(-uTime * 0.006, uTime * 0.003) + 13.0)) * 0.6;
            float c = clamp(c1 + c2 * (1.0 - c1), 0.0, 1.0);
            float lit = 0.82 + 0.25 * s * s * s;
            vec3 cc = mix(uCloudCol * 0.78, uCloudCol, c1) * lit;
            col = mix(col, cc, c * smoothstep(0.01, 0.2, h) * 0.9);
          }
          col += uSunCol * (smoothstep(0.99955 - uSunSize * 0.0003, 0.9998, s) * 2.0 + pow(s, 12.0) * uSunGlow + pow(s, 500.0) * 0.6);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(1000, 32, 16), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  apply(t: ThemeDef): void {
    const u = this.mat.uniforms;
    (u.uZenith!.value as Color).setHex(t.sky.zenith);
    (u.uHorizon!.value as Color).setHex(t.sky.horizon);
    (u.uNadir!.value as Color).setHex(t.sky.nadir);
    (u.uSunCol!.value as Color).setHex(t.sky.sunColor);
    (u.uCloudCol!.value as Color).setHex(t.sky.cloudColor);
    this.sunDir.set(...t.sky.sunDir).normalize();
    u.uSunSize!.value = t.sky.sunSize;
    u.uSunGlow!.value = t.sky.sunGlow;
    u.uClouds!.value = t.sky.clouds;
    u.uStars!.value = t.sky.stars ? 1 : 0;
  }

  update(time: number): void {
    this.mat.uniforms.uTime!.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
