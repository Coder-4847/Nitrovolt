import { Color, MeshStandardMaterial } from 'three';
import { ledBoardTexture } from './Signage';
import { ThemeDef } from './Theme';

/**
 * Barrier material: a dark barrier in the theme's base colour with a light band along the top, an LED ad
 * strip along the middle, a thin dark kick line at the foot and joints every 4 m. Driven by the per-vertex height the
 * mesh builder writes for walls (`lateral` = height, -wall height); everything is anti-aliased.
 */
export function wallMaterial(theme: ThemeDef): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: theme.wall.base, roughness: 0.62, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBand = { value: new Color(theme.wall.band) };
    sh.uniforms.uLed = { value: ledBoardTexture(theme.accent) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lateral; varying vec2 vLat; varying float vS; varying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLat = lateral; vS = uv.y * 4.0; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vLat; varying float vS; varying vec3 vWP; varying vec3 vWN; uniform vec3 uBand; uniform sampler2D uLed;
        float waa(float edge, float x) { float w = max(fwidth(x), 1e-4); return smoothstep(edge - w, edge + w, x); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 ledGlow = vec3(0.0);
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
          // LED strip between 0.25 m and 0.25 m below the band
          float y0 = 0.22, y1 = hh - 0.4;
          if (y > y0 && y < y1) {
            // run the board text left-to-right for whoever looks at this face: compare the direction the road
            // distance grows in (screen-space gradient) with the face's horizontal tangent
            vec3 gS = dFdx(vS) * dFdx(vWP) + dFdy(vS) * dFdy(vWP);
            float dir = dot(cross(vec3(0.0, 1.0, 0.0), vWN), gS) < 0.0 ? -1.0 : 1.0;
            vec3 led = texture2D(uLed, vec2(dir * vS / 64.0, (y - y0) / (y1 - y0))).rgb;
            diffuseColor.rgb = led * 0.35;
            ledGlow = led * 0.9;
          }
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ledGlow;');
  };
  mat.customProgramCacheKey = () => `wall:${theme.id}`;
  return mat;
}
