import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three';
import { TerrainData } from '../../tracks/TrackTypes';
import { ThemeDef } from './Theme';

/** GLSL value noise / fbm shared by the landscape shaders. */
export const NOISE_GLSL = /* glsl */ `
  float lhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(lhash(i), lhash(i + vec2(1, 0)), u.x), mix(lhash(i + vec2(0, 1)), lhash(i + vec2(1, 1)), u.x), u.y);
  }
  float lfbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * lnoise(p); p = p * 2.07 + 13.1; a *= 0.5; } return s; }
`;

const KIND = { grass: 0, snow: 1, sand: 2 } as const;

/**
 * The ground the track sits in, built from the same height grid the physics collides with: a mown lawn,
 * snowfield or sand, with worn verges along the road, earth and rock on steep banks and fine detail that
 * fades with distance.
 */
export class Landscape {
  readonly mesh: Mesh;
  private readonly mat: MeshStandardMaterial;

  constructor(t: TerrainData, theme: ThemeDef) {
    const { nx, nz, step, x0, z0, heights } = t;
    const pos = new Float32Array(nx * nz * 3);
    const near = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = x0 + i * step;
        pos[k * 3 + 1] = heights[k]!;
        pos[k * 3 + 2] = z0 + j * step;
        near[k] = t.near[k]!;
      }
    }
    // the same split as the physics heightfield: diagonal from (i+1, j) to (i, j+1)
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let o = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = b;
        idx[o++] = b; idx[o++] = c; idx[o++] = d;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aNear', new BufferAttribute(near, 1));
    g.setIndex(new BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();

    const kind = KIND[(t.surface as keyof typeof KIND)] ?? 0;
    const gr = theme.ground;
    this.mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    const uA = new Color(gr.a), uB = new Color(gr.b), uVerge = new Color(gr.verge ?? gr.b), uRock = new Color(gr.rock ?? 0x7a6a58);
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uA = { value: uA };
      sh.uniforms.uB = { value: uB };
      sh.uniforms.uVerge = { value: uVerge };
      sh.uniforms.uRock = { value: uRock };
      sh.uniforms.uKind = { value: kind };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aNear; varying float vNear; varying vec3 vWp; varying vec3 vWn;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvNear = aNear; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform vec3 uA, uB, uVerge, uRock; uniform float uKind; varying float vNear; varying vec3 vWp; varying vec3 vWn;\n${NOISE_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float dist = length(vWp - cameraPosition);
            float detail = exp(-dist * 0.006);
            vec2 p = vWp.xz;
            float n1 = lfbm(p * 0.018);
            float n2 = lfbm(p * 0.21);
            float n3 = lnoise(p * 1.7);
            vec3 col;
            float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
            if (uKind < 0.5) {
              // lawn: broad mowing stripes on the flat field, clumpy patches, darker tufts up close
              float stripe = step(0.5, fract(p.x / 18.0 + p.y / 900.0));
              col = mix(uA, uB, clamp(n1 * 1.25 - 0.2 + stripe * 0.22 * smoothstep(40.0, 4.0, vNear * 0.25), 0.0, 1.0));
              col *= 0.9 + 0.16 * n2 * mix(0.5, 1.0, detail) + 0.07 * (n3 - 0.5) * detail;
              // worn verge beside the road
              float verge = smoothstep(5.5, 1.5, vNear) * (0.55 + 0.45 * n2);
              col = mix(col, uVerge, verge * 0.7);
            } else if (uKind < 1.5) {
              // snow: soft blue shadows in hollows, wind-blown sparkle, a grey slush line by the road
              col = mix(uB, uA, smoothstep(0.25, 0.75, n1 * 0.6 + n2 * 0.4));
              col *= 0.96 + 0.06 * n3 * detail;
              float verge = smoothstep(4.0, 1.0, vNear) * (0.5 + 0.5 * n2);
              col = mix(col, uVerge, verge * 0.55);
            } else {
              // sand: dunes, wind ripples, darker compacted sand by the road
              float rip = sin(p.x * 1.1 + p.y * 0.35 + n2 * 7.0) * 0.5 + 0.5;
              col = mix(uB, uA, clamp(n1 * 1.1, 0.0, 1.0));
              col *= 0.93 + 0.08 * rip * detail + 0.05 * (n3 - 0.5) * detail;
              float verge = smoothstep(5.0, 1.0, vNear) * (0.6 + 0.4 * n2);
              col = mix(col, uVerge, verge * 0.6);
            }
            // banks: earth and rock on steep slopes
            float rock = smoothstep(0.32, 0.55, slope + (n2 - 0.5) * 0.25);
            col = mix(col, uRock * (0.8 + 0.4 * n2), rock);
            diffuseColor.rgb *= col;
          }`);
    };
    this.mat.customProgramCacheKey = () => `landscape${kind}`;
    this.mesh = new Mesh(g, this.mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
