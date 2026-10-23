# 1.1.0: visual overhaul and rendering fixes

Player feedback on 1.0.0: the neon look was unwanted, the map "kept glitching", and a black box covered the
screen when turning. This release replaces the look with a clean, modern daylight style (near-future,
not neon) and removes every rendering path that could produce those artefacts.

## Bugs found and fixed

| Symptom | Cause | Fix |
| --- | --- | --- |
| Black box over the screen, mostly while turning | The bloom chain rendered into a half-float target. One invalid pixel (NaN / Inf, which some GPUs produce from specular highlights or shader maths on the car paint and glass as the view swings round) is smeared by the bloom blur and its mip chain into a dark square. SwiftShader never produces such pixels, so the headless tests could not see it. | The post-processing chain (bloom, colour split, grain) is gone. The scene renders straight to the canvas with native MSAA and tone mapping in the materials, so a stray pixel stays one pixel. Shader maths that could go invalid (`pow` of a possibly negative base in the sky and water) is clamped. |
| Chase camera behind a barrier in tight corners, so a wall fills the screen | No camera collision | The camera is pulled in front of any track surface between it and the car, using a ray query against the physics colliders (read-only, ~free, never touches the simulation). |
| Smoke or a ghost car filling the view | Tyre smoke sprites grew without limit right at the lens; ghosts drove through the camera | Particles fade out within 3.5 m of the camera and their sprite size is capped; ghosts fade out within 9 m. |
| Map "glitching": shimmering buildings and road | Building windows were per-cell random noise with no filtering, so distant facades sparkled as the camera moved; road aggregate, kerb blocks and the snow sparkle aliased the same way | Every procedural pattern (facades, road detail, kerbs, lines, planks, panels, ground) is filtered by its on-screen size and fades to its average before it can alias. |
| Sky patches flickering | The sky dome was projected exactly onto the far plane (z = w), which some GPUs clip | The sky is drawn first with no depth test, so it can never be clipped. |
| Shadows crawling as the car moves | The sun's shadow camera followed the car continuously | The shadow camera is snapped to whole shadow-map texels in light space. |
| Checkpoint gates tinting the screen | Additive "holographic" curtains with fog mixed toward the fog colour (wrong for additive blending) | Gates are a thin timing line plus a faint glass panel that fades out up close; normal blending. |
| Hard dark edges at speed | The speed vignette reached 90 % opacity | Much lighter (max 60 % of a soft gradient) and switchable in Settings > Speed vignette. |

A z-fighting probe (every mesh rendered in a unique flat colour, counting isolated pixels) found no
coplanar surfaces worth fixing (at most 14 stray pixels in a 130 000-pixel frame).

## New look

- **Themes** (`src/render/env/Theme.ts`): five daylight palettes. The city season (id still `neon` in
  level files for compatibility) is now **Metro**: a glass-and-concrete city in afternoon light. Season
  names: Metro, Alpine, Desert Canyon, Coast & Harbour. Season-one level names use city words
  (e.g. "Gallery Skyway", "Downtown Express"); names are not part of the level fingerprint, so records and
  ghosts are unaffected.
- **Rendering**: neutral tone mapping, MSAA, sky-based environment reflections, PCF shadows with a wider
  filter on High / Ultra.
- **Sky**: soft gradient with horizon haze, sun glow and two cloud layers; no stars or moon.
- **Ground**: mown grass, city pavement with parks, snow, sand dunes or animated water.
- **Road**: real asphalt tones, a worn racing line, anti-aliased white edge lines and kerbs in the theme
  colour; no glowing seams.
- **Barriers**: painted concrete with a coloured band along the top, a dark kick line and expansion joints
  (`src/render/env/WallMaterial.ts`).
- **Gantries and pads**: painted steel in the theme's gate colours; special-block pads are painted panels
  with a faint backlight on the markings (still colour-coded for gameplay).
- **Scenery**: glass curtain-wall towers and stone / concrete buildings with procedural facades, rooftop
  plant rooms and street trees in the city; grandstands with roofs, light towers and trees in the stadium.
- **Cars** (`src/render/cars/`): rebuilt from lofted cross-sections (`loft()` in `parts.ts`) instead of
  boxes: a low electric coupe (Volt), a rally hatchback (Gravel), an electric pickup (Frost) and a
  tube-frame buggy (Dune). New tyres (lathe profile), spoked rims, brake discs and callipers, LED light
  bars, brake lights. Boost shows a short electric glow (Volt, Frost) or flame (Gravel, Dune).
  Default liveries and the paint / accent presets are automotive colours.
- **Interface**: neutral graphite panels, one blue accent, no glows or italics; restyled HUD, menus,
  touch controls, editor icons, app icon and favicon.

## How to test

- `npm test`, `npm run build`, then the browser checks in `docs/RELEASE_CHECKLIST.md`.
- `npm run dev`, open `/?debug=1&autodrive=1&level=sprint01` and watch a full lap: no shimmering facades,
  no dark boxes, the camera stays in front of walls on `s2-08`.
- Drive a level twice so the PB ghost appears and follow it closely: it fades out instead of covering
  the view.

## Known issues

- The black box could not be reproduced in the headless software renderer, so the fix removes the
  mechanism (bloom over a half-float target) rather than a confirmed single cause. If it still shows up,
  please report the device and browser.
- Night scenes are gone. All themes are daylight.
