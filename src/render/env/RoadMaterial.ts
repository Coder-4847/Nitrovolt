import { Color, MeshStandardMaterial } from 'three';
import { SURFACES, SurfaceId } from '../../physics/Surface';
import { ThemeDef } from './Theme';

const SURF: Record<SurfaceId, number> = { tarmac: 0, dirt: 1, grass: 2, ice: 3, snow: 4, sand: 5, wood: 6, plastic: 7, tech: 8 };
/** Surfaces that get painted edge lines and kerbs. */
const PAINTED = new Set<SurfaceId>(['tarmac', 'tech', 'wood', 'plastic']);
/** Render albedo where it differs from the physics table's identification colour (real asphalt is darker). */
const ALBEDO: Partial<Record<SurfaceId, number>> = { tarmac: 0x4f5359, tech: 0x7a8088, plastic: 0xc05a86 };

const NOISE = /* glsl */ `
  float rhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(rhash(i), rhash(i + vec2(1, 0)), u.x), mix(rhash(i + vec2(0, 1)), rhash(i + vec2(1, 1)), u.x), u.y);
  }
  float rfbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * rnoise(p); p *= 2.07; a *= 0.5; } return s; }
  // 1 where a pattern of this world-space frequency is still larger than a pixel, fading to 0 below that
  float rdetail(vec2 p) { vec2 w = fwidth(p); return 1.0 - smoothstep(0.35, 1.0, max(w.x, w.y)); }
  // anti-aliased step
  float raa(float edge, float x) { float w = max(fwidth(x), 1e-4); return smoothstep(edge - w, edge + w, x); }
`;

/**
 * Driving-surface material: the surface's albedo with procedural detail (aggregate, ruts, mown stripes,
 * ripples, cracks, planks, panels) plus edge lines and kerbs, all computed in the shader from world
 * position and the lateral coordinate the mesh builder writes (no textures, no seams). Every pattern is
 * filtered by its screen-space size so distant road stays calm instead of shimmering.
 */
export function roadMaterial(surface: SurfaceId, theme: ThemeDef): MeshStandardMaterial {
  const base = new Color(ALBEDO[surface] ?? SURFACES[surface].color).multiply(new Color(theme.road.tint));
  const mat = new MeshStandardMaterial({
    color: base,
    roughness: surface === 'ice' ? 0.15 : surface === 'plastic' ? 0.35 : surface === 'tech' ? 0.55 : 0.9,
    metalness: surface === 'tech' ? 0.15 : 0.0,
  });
  const painted = PAINTED.has(surface);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLine = { value: new Color(theme.road.line) };
    sh.uniforms.uKerbA = { value: new Color(theme.road.kerbA) };
    sh.uniforms.uKerbB = { value: new Color(theme.road.kerbB) };
    sh.defines = { ...(sh.defines ?? {}), SURF: SURF[surface], PAINTED: painted ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lateral; varying vec2 vLat; varying vec3 vRW; varying float vS;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLat = lateral; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vS = uv.y * 4.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vLat; varying vec3 vRW; varying float vS;
        uniform vec3 uLine, uKerbA, uKerbB;
        ${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 wp = vRW.xz;
        float onTop = step(0.0, vLat.x);
        float lat = vLat.x;
        float wid = max(vLat.y, 0.001);
        float edge = min(lat, wid - lat);
        float centre = abs(lat - wid * 0.5) / (wid * 0.5);
        float d1 = rdetail(wp * 3.1);
        float n1 = mix(0.5, rnoise(wp * 3.1), d1);
        float n2 = rfbm(wp * 0.35);
        float rough = 0.0;
        #if SURF == 0
          diffuseColor.rgb *= 0.9 + 0.12 * n1 + 0.12 * (n2 - 0.5);
          // darker, smoother racing line worn in by tyres
          float worn = onTop * (1.0 - smoothstep(0.15, 0.5, abs(centre - 0.35)));
          diffuseColor.rgb *= 1.0 - 0.1 * worn;
          rough = 0.06 * (n1 - 0.5) - 0.1 * worn;
        #elif SURF == 1
          diffuseColor.rgb *= 0.78 + 0.32 * n2 + 0.08 * n1;
          float rut = onTop * (smoothstep(0.12, 0.0, abs(centre - 0.45)) + smoothstep(0.1, 0.0, abs(centre - 0.0)) * 0.3);
          diffuseColor.rgb *= 1.0 - 0.18 * rut;
        #elif SURF == 2
          float stripe = step(0.5, fract(vS / 6.0));
          diffuseColor.rgb *= 0.84 + 0.12 * stripe + 0.12 * n2 + 0.06 * n1;
        #elif SURF == 3
          float crack = smoothstep(0.03, 0.0, abs(rnoise(wp * 0.45) - 0.5)) + smoothstep(0.02, 0.0, abs(rnoise(wp * 1.3 + 7.0) - 0.5)) * 0.6;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.97, 1.0), crack * 0.55);
          diffuseColor.rgb *= 0.92 + 0.12 * n2;
          rough = 0.25 * crack;
        #elif SURF == 4
          diffuseColor.rgb *= 0.9 + 0.1 * n2;
          float rut4 = onTop * smoothstep(0.12, 0.0, abs(centre - 0.42));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.86, 0.92), rut4);
        #elif SURF == 5
          float rip = sin(dot(wp, vec2(1.7, 0.6)) + n2 * 6.0) * 0.5 + 0.5;
          diffuseColor.rgb *= 0.88 + 0.1 * rip + 0.1 * n2;
        #elif SURF == 6
          float plank = fract(vS / 0.8);
          float dp = rdetail(vec2(vS / 0.8));
          diffuseColor.rgb *= 0.82 + 0.16 * mix(0.5, rhash(vec2(floor(vS / 0.8), 3.0)), dp) + 0.06 * rnoise(vec2(lat * 6.0, vS * 0.5));
          diffuseColor.rgb *= 1.0 - 0.35 * smoothstep(0.05, 0.0, plank) * onTop * dp;
        #elif SURF == 7
          diffuseColor.rgb *= 0.95 + 0.05 * n1;
        #elif SURF == 8
          vec2 pan = abs(fract(vec2(lat, vS) / 4.0) - 0.5);
          float seam = smoothstep(0.47, 0.5, max(pan.x, pan.y)) * onTop * rdetail(vec2(lat, vS) / 4.0 * 12.0);
          diffuseColor.rgb *= 0.94 + 0.06 * n2 - 0.2 * seam;
        #endif
        #if PAINTED == 1
          if (onTop > 0.5) {
            float kerb = 1.0 - raa(0.8, edge);
            float kb = fract(vS / 2.0);
            float blk = mix(0.5, raa(0.5, kb) * (1.0 - raa(0.98, kb)), rdetail(vec2(vS / 2.0)));
            vec3 kc = mix(uKerbA, uKerbB, blk);
            diffuseColor.rgb = mix(diffuseColor.rgb, kc, kerb);
            float line = raa(0.95, edge) * (1.0 - raa(1.15, edge));
            diffuseColor.rgb = mix(diffuseColor.rgb, uLine, line * 0.9);
            rough -= 0.3 * (line + kerb);
          }
        #else
          if (onTop > 0.5) diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 1.4, edge);
        #endif
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + rough, 0.08, 1.0);');
  };
  mat.customProgramCacheKey = () => `road:${surface}:${theme.id}`;
  return mat;
}
