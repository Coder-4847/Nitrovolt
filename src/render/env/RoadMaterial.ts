import { Color, MeshStandardMaterial, Vector3, Vector4 } from 'three';
import { edgeTextTexture, roadLogoTexture } from './Signage';
import { SURFACES, SurfaceId } from '../../physics/Surface';
import { ThemeDef } from './Theme';

const SURF: Record<SurfaceId, number> = { tarmac: 0, dirt: 1, grass: 2, ice: 3, snow: 4, sand: 5, wood: 6, plastic: 7, tech: 8 };
/** Surfaces that get painted edge lines and kerbs. */
const PAINTED = new Set<SurfaceId>(['tarmac', 'tech', 'wood', 'plastic']);
/** Render albedo where it differs from the physics table's identification colour (real asphalt is darker). */
const ALBEDO: Partial<Record<SurfaceId, number>> = { tarmac: 0x5c6269, tech: 0x7e848c, plastic: 0xc05a86, dirt: 0xb8663e, snow: 0xe8eef4, ice: 0xa9d4ec };

/** Painted markings tied to the track: the start box and logo, checkpoint lines and the chequered finish. */
export interface RoadDecals {
  start: { position: Vector3; forward: Vector3; right: Vector3 };
  /** Up to 8 lines: xyz = position on the road, w = 1 for the finish (chequered), 0 for a checkpoint. */
  lines: Array<{ position: Vector3; forward: Vector3; finish: boolean }>;
}
const MAX_LINES = 8;

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
export function roadMaterial(surface: SurfaceId, theme: ThemeDef, decals?: RoadDecals): MeshStandardMaterial {
  const base = new Color(ALBEDO[surface] ?? SURFACES[surface].color).multiply(new Color(theme.road.tint));
  const mat = new MeshStandardMaterial({
    color: base,
    roughness: surface === 'ice' ? 0.15 : surface === 'plastic' ? 0.35 : surface === 'tech' ? 0.55 : surface === 'tarmac' ? 0.72 : 0.9,
    metalness: surface === 'tech' ? 0.15 : 0.0,
  });
  const painted = PAINTED.has(surface);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLine = { value: new Color(theme.road.line) };
    sh.uniforms.uKerbA = { value: new Color(theme.road.kerbA) };
    sh.uniforms.uKerbB = { value: new Color(theme.road.kerbB) };
    sh.uniforms.uEdgeText = { value: edgeTextTexture() };
    sh.uniforms.uLogo = { value: roadLogoTexture(theme.accent) };
    const st = decals?.start;
    sh.uniforms.uStartP = { value: st ? st.position.clone() : new Vector3(0, -1e5, 0) };
    sh.uniforms.uStartF = { value: st ? st.forward.clone() : new Vector3(0, 0, -1) };
    sh.uniforms.uStartR = { value: st ? st.right.clone() : new Vector3(1, 0, 0) };
    const lines = (decals?.lines ?? []).slice(0, MAX_LINES);
    sh.uniforms.uLineP = { value: Array.from({ length: MAX_LINES }, (_, i) => lines[i] ? new Vector4(lines[i]!.position.x, lines[i]!.position.y, lines[i]!.position.z, lines[i]!.finish ? 1 : 0) : new Vector4(0, -1e5, 0, 0)) };
    sh.uniforms.uLineF = { value: Array.from({ length: MAX_LINES }, (_, i) => lines[i]?.forward.clone() ?? new Vector3(0, 0, -1)) };
    sh.defines = { ...(sh.defines ?? {}), SURF: SURF[surface], PAINTED: painted ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lateral; varying vec2 vLat; varying vec3 vRW; varying float vS;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLat = lateral; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vS = uv.y * 4.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vLat; varying vec3 vRW; varying float vS;
        uniform vec3 uLine, uKerbA, uKerbB;
        uniform sampler2D uEdgeText, uLogo;
        uniform vec3 uStartP, uStartF, uStartR;
        uniform vec4 uLineP[${MAX_LINES}]; uniform vec3 uLineF[${MAX_LINES}];
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
          // painted rink lines under the snow: red near the edges, blue in between (faded where worn)
          float lr = onTop * (1.0 - raa(0.12, abs(edge - 3.2)));
          float lb = onTop * (1.0 - raa(0.1, abs(centre - 0.42)));
          float fade = 0.55 + 0.35 * n2;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.2, 0.22), lr * fade);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.25, 0.4, 0.85), lb * fade * 0.8);
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
            float kerb = 1.0 - raa(1.1, edge);
            float kb = fract(vS / 2.0);
            float blk = mix(0.5, raa(0.5, kb) * (1.0 - raa(0.98, kb)), rdetail(vec2(vS / 2.0)));
            vec3 kc = mix(uKerbA, uKerbB, blk);
            diffuseColor.rgb = mix(diffuseColor.rgb, kc, kerb);
            float line = raa(1.3, edge) * (1.0 - raa(1.55, edge));
            // faint joints where the 32 m road blocks meet
            float joint = (1.0 - raa(0.05, abs(fract(vS / 32.0 + 0.5) - 0.5) * 32.0)) * rdetail(vec2(vS * 2.0));
            diffuseColor.rgb *= 1.0 - 0.12 * joint;
            diffuseColor.rgb = mix(diffuseColor.rgb, uLine, line * 0.9);
            rough -= 0.3 * (line + kerb);
            // sponsor text along both edges, inside the line (reads along the road)
            if (wid > 10.0 && edge > 1.35 && edge < 2.55) {
              // glyph tops face the road centre, so the text reads from the car on both sides
              vec2 tuv = vec2(-vS / 30.0, (edge - 1.35) / 1.2);
              if (lat > wid * 0.5) tuv = vec2(-vS / 30.0, 1.0 - tuv.y);
              float paint = texture2D(uEdgeText, tuv).a * 0.4 * rdetail(vec2(vS / 30.0 * 16.0));
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), paint);
            }
          }
        #else
          if (onTop > 0.5) diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 1.4, edge);
        #endif
        if (onTop > 0.5) {
          // start: a painted grid box around the car and the logo across the road ahead of it
          vec3 d = vRW - uStartP;
          float along = dot(d, uStartF), across = dot(d, uStartR);
          if (abs(dot(d, cross(uStartR, uStartF))) < 3.0) {
            float e = max(abs(across) - 1.5, abs(along + 0.2) - 2.6);
            float box = (1.0 - raa(0.1, abs(e))) * step(-2.3, along + 0.2);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96), box * 0.9);
            if (along > 9.0 && along < 23.0 && abs(across) < wid * 0.5 - 1.6) {
              vec4 logo = texture2D(uLogo, vec2(0.5 + across / (wid - 3.2), (along - 9.0) / 14.0));
              diffuseColor.rgb = mix(diffuseColor.rgb, logo.rgb, logo.a * 0.92);
            }
          }
          // checkpoint lines and the chequered finish
          for (int i = 0; i < ${MAX_LINES}; i++) {
            vec3 q = vRW - uLineP[i].xyz;
            float a = dot(q, uLineF[i]);
            if (abs(a) < 0.8 && length(q) < wid) {
              vec3 r = normalize(cross(uLineF[i], vec3(0.0, 1.0, 0.0)));
              float x = dot(q, r);
              float chk = mod(floor(x / 0.8) + floor((a + 0.8) / 0.8), 2.0);
              vec3 c = uLineP[i].w > 0.5 ? mix(vec3(0.06), vec3(0.95), chk) : vec3(0.95);
              float m = uLineP[i].w > 0.5 ? 1.0 : (1.0 - raa(0.3, abs(a)));
              diffuseColor.rgb = mix(diffuseColor.rgb, c, m * 0.92);
            }
          }
        }
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + rough, 0.08, 1.0);');
  };
  mat.customProgramCacheKey = () => `road:${surface}:${theme.id}`;
  return mat;
}
