import { Color, MeshStandardMaterial } from 'three';
import { ThemeDef } from './Theme';

/**
 * Barrier material: smooth painted concrete in the theme's base colour, a coloured band along the top,
 * a thin dark kick line at the foot and expansion joints every 4 m. Driven by the per-vertex height the
 * mesh builder writes for walls (`lateral` = height, -wall height); everything is anti-aliased.
 */
export function wallMaterial(theme: ThemeDef): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: theme.wall.base, roughness: 0.62, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBand = { value: new Color(theme.wall.band) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lateral; varying vec2 vLat; varying float vS;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLat = lateral; vS = uv.y * 4.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vLat; varying float vS; uniform vec3 uBand;
        float waa(float edge, float x) { float w = max(fwidth(x), 1e-4); return smoothstep(edge - w, edge + w, x); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vLat.y < -0.1) {
          float hh = -vLat.y;
          float y = vLat.x;
          float band = waa(hh - 0.32, y);
          float foot = 1.0 - waa(0.06, y);
          diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band);
          diffuseColor.rgb *= 1.0 - 0.55 * foot;
          float j = abs(fract(vS / 4.0) - 0.5) * 4.0;
          float jw = max(fwidth(vS / 4.0) * 4.0, 1e-4);
          float joint = (1.0 - smoothstep(0.02, 0.02 + jw, j)) * (1.0 - smoothstep(0.3, 1.0, jw * 8.0));
          diffuseColor.rgb *= 1.0 - 0.35 * joint;
        }`);
  };
  mat.customProgramCacheKey = () => `wall:${theme.id}`;
  return mat;
}
