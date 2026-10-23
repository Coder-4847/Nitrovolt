import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { GroundKind, ThemeDef } from './Theme';

const KIND: Record<GroundKind, number> = { grid: 0, neon: 1, snow: 2, sand: 3, water: 4 };

/**
 * Endless ground plane under the track, shaded per theme: stadium grid, neon grid (glowing lines),
 * snow field with sparkle, sand with wind ripples and dunes, or a lit sea. Follows the camera in 50 m steps.
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
        float gridLine(vec2 p, float size) {
          vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
          return 1.0 - min(min(g.x, g.y), 1.0);
        }
        void main(){
          vec3 col;
          vec3 view = normalize(vW - cameraPosition);
          float dist = length(vW.xz - cameraPosition.xz);
          if (uKind < 0.5) {
            col = mix(uA, uB, gridLine(vW.xz, 50.0) * 0.8);
          } else if (uKind < 1.5) {
            float l = gridLine(vW.xz, 32.0);
            float l2 = gridLine(vW.xz, 8.0) * 0.25;
            float fade = exp(-dist * 0.0022);
            col = uA + uB * (l * 1.6 + l2) * fade + uB * 0.04;
          } else if (uKind < 2.5) {
            float n = fbm(vW.xz * 0.02) * 0.6 + fbm(vW.xz * 0.15) * 0.4;
            col = mix(uB, uA, smoothstep(0.25, 0.75, n));
            float sp = step(0.985, hash2(floor(vW.xz * 3.0))) * exp(-dist * 0.02);
            col += vec3(sp) * 0.8;
          } else if (uKind < 3.5) {
            float dune = fbm(vW.xz * 0.006);
            float rip = sin(vW.x * 1.3 + vW.z * 0.4 + fbm(vW.xz * 0.1) * 6.0) * 0.5 + 0.5;
            col = mix(uB, uA, dune * 0.9 + 0.1);
            col *= 0.92 + 0.08 * rip * exp(-dist * 0.01);
          } else {
            // water: animated normals from two wave layers, fresnel sky reflection and a sun glint
            vec2 p = vW.xz;
            float w1 = noise(p * 0.08 + vec2(uTime * 0.12, uTime * 0.05));
            float w2 = noise(p * 0.3 - vec2(uTime * 0.2, -uTime * 0.13));
            vec3 n = normalize(vec3((w1 - 0.5) * 0.5 + (w2 - 0.5) * 0.25, 1.0, (w2 - 0.5) * 0.5));
            vec3 r = reflect(view, n);
            float fres = pow(1.0 - max(dot(-view, n), 0.0), 4.0);
            col = mix(uA, uSky * 0.85, 0.06 + 0.6 * fres);
            float glint = pow(max(dot(r, normalize(uSun)), 0.0), 220.0);
            col += uSunCol * glint * 2.5;
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
