import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { ThemeDef } from './Theme';

/**
 * Procedural sky dome: three-stop gradient, sun or moon with glow, a star field (night) and drifting
 * clouds, all from one shader. Follows the camera and always draws at the far plane.
 */
export class Sky {
  readonly mesh: Mesh;
  readonly sunDir = new Vector3(0.45, 0.6, 0.35).normalize();
  private readonly mat: ShaderMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
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
        uStars: { value: 0 },
        uMoon: { value: 0 },
        uClouds: { value: 0.3 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w;
        }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uNadir, uSunCol, uCloudCol, uSun;
        uniform float uSunSize, uSunGlow, uStars, uMoon, uClouds, uTime;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
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
          vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
          col = mix(col, uNadir, smoothstep(0.0, -0.18, h));
          float s = max(dot(d, uSun), 0.0);
          // stars: sparse hashed cells on the direction, twinkling a little
          if (uStars > 0.0 && h > 0.0) {
            vec3 cell = floor(d * 260.0);
            float r = hash(cell);
            float tw = 0.65 + 0.35 * sin(uTime * 2.0 + r * 40.0);
            float star = step(0.9965, r) * tw * smoothstep(0.0, 0.25, h);
            col += vec3(0.9, 0.95, 1.0) * star * uStars * 1.4;
            // a faint band of haze across the sky
            col += vec3(0.18, 0.1, 0.32) * uStars * exp(-pow(d.z * 2.2 + d.y * 0.8, 2.0)) * 0.35;
          }
          // clouds: fbm on a plane above the camera
          if (uClouds > 0.0 && h > 0.02) {
            vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
            float c = smoothstep(0.52 - uClouds * 0.22, 0.85, fbm(uv));
            float lit = 0.75 + 0.35 * pow(s, 3.0);
            col = mix(col, uCloudCol * lit, c * smoothstep(0.02, 0.25, h) * 0.85);
          }
          if (uMoon > 0.5) {
            float disc = smoothstep(0.9993 - uSunSize * 0.0004, 0.9996 - uSunSize * 0.0002, s);
            col = mix(col, uSunCol * 1.6, disc);
            col += uSunCol * pow(s, 60.0) * uSunGlow;
          } else {
            col += uSunCol * (smoothstep(0.99955 - uSunSize * 0.0003, 0.9998, s) * 3.0 + pow(s, 10.0) * uSunGlow + pow(s, 600.0) * 1.5);
          }
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
    u.uStars!.value = t.sky.stars;
    u.uMoon!.value = t.sky.moon ? 1 : 0;
    u.uClouds!.value = t.sky.clouds;
  }

  update(time: number): void {
    this.mat.uniforms.uTime!.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
