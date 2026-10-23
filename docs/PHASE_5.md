# Phase 5 — Visual Overhaul

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| Season themes | `src/render/env/Theme.ts` | Pure data per theme: sky, fog, lights, exposure, reflections, ground, road palette, walls, gates, scenery kit, bloom, night flag. **Neon City Night** (season 1), **Alpine Snow** (2), **Desert Canyon** (3), **Coast & Industry** (4), plus a daylight **Stadium** for the dev tracks. The level JSON's `theme` picks one; old names (`grey`, `rally`) still resolve. The built-in levels now use their season's theme. |
| Sky | `src/render/env/Sky.ts` | One shader: three-stop gradient, sun disc + glow or a moon, a twinkling star field and haze band at night, drifting fbm clouds lit toward the sun. A small copy is baked into a **PMREM environment map** per theme, so car paint, glass and metal reflect the right sky. |
| Ground | `src/render/env/Ground.ts` | Endless plane, shaded per theme: stadium grid, neon grid (glowing lines that fade with distance), snow field with sparkle, sand dunes with wind ripples, or an animated sea with Fresnel sky reflection and sun glint. |
| Scenery | `src/render/env/SceneryPlan.ts`, `Scenery.ts` | Placement is a pure, seeded function of the track (unit-tested): a jittered grid around the driving line with a **20 m clearance corridor** (30 m for tall props), taller further away, clumped by value noise, plus a ring of far silhouettes. Kits: city (buildings with night windows lit per floor and instance in the shader, rooftop neon, billboards facing the road, blinking beacons, skyline), alpine (pine forests, rocks, cabins, snow-capped mountains), desert (banded mesas, rocks, cacti), coast (quays with container stacks and cranes, wind turbines with spinning rotors, chimneys), stadium (stands, light towers). **One InstancedMesh per prop kind**: about a dozen draw calls for 1-3k props. |
| Track look | `src/render/env/RoadMaterial.ts`, `MeshBuilder.ts`, `TrackView.ts` | The mesh builder now writes a render-only **lateral coordinate** on the driving surface (colliders untouched, ghosts still exact). The road shader uses it plus world position for kerbs (alternating, theme colours), edge lines and per-surface detail: tarmac aggregate and racing-line wear, dirt patches and ruts, mown grass stripes, ice cracks with lower roughness, snow sparkle and ruts, sand ripples, wood planks, tech panels with glowing seams (neon). Walls get seamless diagonal hazard stripes in theme colours (emissive at night); gantries take the theme's gate colours. |
| Gates | `src/render/env/Gates.ts` | Holographic curtains on every checkpoint / finish line (scan lines, edge glow, chequered band on the finish) that **flash** when crossed, in races and replays. |
| Post-processing | `src/render/PostFx.ts` | `EffectComposer`: scene into a half-float MSAA target, **Unreal bloom** (per-theme strength / threshold), a grade pass (vignette, speed and boost colour split toward the edges, faint grain), then ACES tone mapping and sRGB output. Off on Low (plain render with native AA). Reduced motion turns the colour split off. |
| Car | `src/render/CarView.ts`, `cars/parts.ts` | Clear-coated metallic paint and glass (`MeshPhysicalMaterial`) reflecting the environment map. Generic **head / tail / brake lights** placed from each body's bounding box (brake lights brighten with the applied brake), **exhaust flames** that grow and flicker with the boost level, and a **headlight beam** (one spot light) on night levels from High up. |
| Effects | `src/render/SkidMarks.ts`, `Sparks.ts`, `WheelFx.ts` | **Skid marks**: pooled ring buffer of quads in one draw call; black rubber when sliding on hard ground, darker ruts whenever you drive on loose ground; they fade after 30 s and are cleared on restart. **Sparks**: pooled additive streaks with gravity on wall impacts, chassis scrapes (bottom-outs) and hard landings. Dust particle pool size follows the preset. |
| Quality | `src/render/Quality.ts`, Settings > Graphics | Presets now also scale post-processing, MSAA, scenery density (0.35x-1.35x), particles, skid-mark segments and headlight beams. **Auto** (the default) starts from a device guess, then benchmarks ~3 s of the menu backdrop and steps the preset down (p75 frame > 24 ms) or up once (< 9 ms; phones never climb past Medium). **Dynamic resolution** (on by default) lowers the render scale to 0.55x in 0.1 steps to hold ~60 fps and recovers with hysteresis. `?quality=low|medium|high|ultra` forces a level (dev / screenshots). The debug overlay (F3) shows preset, render scale, draw calls and triangles. |
| Misc | `Thumbnail.ts`, `App.ts` | Level thumbnails are tinted by theme; the menu backdrop orbit is wider so the themed scenery reads. |
| Tests | `tests/visuals.test.ts` | 9 new (109 total): scenery is deterministic, scales with density and never enters the corridor on any built-in level for any kit; every level uses a season theme and old names resolve; the road's lateral data is present and bounded; the benchmark and the resolution governor make the right calls. |

## How to test

```bash
npm run dev                         # main menu shows the neon city behind it
npm test                            # 109 tests
npx vite --port 5173 --host 127.0.0.1 &
node scripts/p5-shots.mjs high      # chase + close-up of every theme -> /tmp/claude-0/shots/p5_*.png
node scripts/phase4-test.mjs        # menus / ghosts / replays still work end to end
```

What to look at:
1. **Sprint 01 / Ring Road / Boost Lab / Stunt Park** (Neon): lit windows, rooftop neon, magenta kerbs, glowing edge lines, bloom on lights and pads, stars and moon, headlight beam on High+.
2. **Ice Pass** (Alpine): mountains, pine forests, snow ruts behind the truck, icy patches with cracks.
3. **Dune Run** (Desert): banded mesas, dunes and ripples, sand ruts.
4. **Dirt Road** (Coast): sea with sun glint, quays with containers and cranes, turning wind turbines.
5. Hit a wall (sparks), brake (brake lights), drift on tarmac (rubber marks), take a turbo pad (exhaust flames, colour split).
6. Settings > Graphics: switch Low / Medium / High / Ultra / Auto live; toggle dynamic resolution; F3 for draw calls.

## Design decisions

- **Look from shaders and instancing, not assets.** Everything stays procedural (rule of the project) and cheap: road detail, windows, sky, ground and water are computed per pixel; props are a few instanced unit meshes with per-instance colour.
- **Render-only data never touches physics.** The road's lateral coordinate is a separate attribute; collider vertices are byte-identical, so all bundled author ghosts still replay exactly (the ghost test passes unchanged).
- **Scenery planning is pure.** `planScenery` takes only the centerline, a seed and a density, so it is deterministic, testable in Node, and the clearance rule (nothing within 20 m of the driving line) is enforced by a test rather than by eye. The level editor (Phase 7) can call it for previews.
- **Bloom is a theme property.** Night levels bloom hard (lights, neon, windows), day levels barely (sun glint, pads), so the same assets read correctly everywhere.
- **Auto quality measures, then adapts.** A one-off benchmark picks the preset; dynamic resolution handles the moment-to-moment load (big scenery views, many particles) without changing the preset mid-run.
- **Car lights are generic.** Placed from each body's bounding box instead of per-model, so new cars or liveries get them for free.

## Known issues / not yet done

- Frame rate was not profiled on real GPUs (headless software GL runs at ~4-8 fps for every preset). Draw calls measured: ~60 (Low) to ~150 (High/Ultra) per frame including post passes; triangles 25k-165k. The thresholds of the benchmark and the resolution governor may need a pass on real phones.
- No SSAO / screen-space reflections: judged too expensive for mobile; the clear-coat + environment map carries most of the "shine". Motion blur is approximated by speed lines and the colour split.
- Scenery is a flat ground layer: it can float slightly over the sea or sink into dunes where the ground shader suggests relief that is not geometry. Elevated roads are never above props (the corridor is checked in plan view).
- Night headlights are one spot light; on Medium and Low there is no beam (the lamps still glow).
- The menu backdrop does not animate a car driving; it orbits the parked car.
- Skid marks are flat quads on the contact plane; on very tight banking changes they can clip slightly into the road for a frame.
- The bundle grew by ~80 KB (three.js post-processing addons); code-splitting is still a Phase 8 task.
