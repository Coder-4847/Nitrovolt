# NITROVOLT

A browser time-attack racer: big hand-built tracks through forest, snow and desert, car switches mid-run, wall turns,
loops and jumps, instant restarts, exact ghosts and medals. Everything is generated in code (cars, tracks, terrain,
scenery, sky, textures, engine sounds and music), with no external assets.
It is an original game and not affiliated with any other racing title.

**Status: 1.3.0.** Handover notes for new sessions: [`MEMORY.md`](MEMORY.md). Installable and playable offline (PWA), deployable as a static site.

## Features

- **Four cars, one physics core**: a custom 100 Hz raycast-suspension vehicle with a per-surface tyre model; Volt (stadium), Gravel (rally), Frost (snow / ice), Dune (sand). Rapier handles only collision queries.
- **Hand-built campaign**: 25 tracks in five tiers (White to Black) plus 8 training tracks, every one validated by a bot that also records its author ghost ([`docs/LEVEL_REPORT.md`](docs/LEVEL_REPORT.md)). Bronze on 4 tracks of a tier opens the next. A track of the day for everyone.
- **Car gates**: drive through a portal and finish the section in another car; ghosts stay exact through every switch.
- **Real terrain**: a heightfield under and around every track (embankments, pits under jumps, hills), the same one for physics and rendering; off-road costs grip.
- **Medals and exact ghosts**: Author / Gold / Silver / Bronze; ghosts are the recorded input stream re-simulated bit-exactly (PB and author ghosts, replay viewer with free camera).
- **Stunts and special blocks**: wall turns, loops, half-pipes, wall-rides, spirals and jumps; turbo, turbo 2, reactor, no-steer, no-brake, cruise, engine off, slow motion, low gravity, fragile.
- **Look and sound**: five worlds (forest, snow, desert, sunset, night) with woods, pines, cacti and mesas beside the road and a stadium on the horizon; painted roads; four cars (open-wheel stadium car, rally hatch, snow pickup, desert muscle coupe) with liveries and a rear speed plate; a showroom main menu; a generative soundtrack and a synthesised engine per car.
- **Every input**: keyboard (remappable), mouse steering, gamepad (analog, rumble), touch with tilt steering; full keyboard / gamepad menu navigation.
- **Accessibility**: HUD size, colour-blind medal palette (medals also differ by shape), reduced motion, unlock everything, countdown length.
- **Performance**: quality presets with an automatic benchmark and dynamic resolution; physics loads on demand; distant scenery uses lighter geometry.

## Run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # 118 unit / integration tests (FULL=1 runs the per-level checks on every level)
npm run build      # typecheck + static build in dist/ (BASE_PATH=/sub/path/ for a sub-path)
npm run preview    # serve dist/
npm run levels     # build + validate every level from scripts/levels/, record author ghosts, write docs/LEVEL_REPORT.md
npm run icons      # regenerate the PWA icons in public/icons/
```

Dev flags: `?debug=1` (tuning panel + debug HUD + `window.__nv`), `?level=<id>`, `?track=flat|greybox`, `?car=<id>`, `?autodrive=1`, `?quality=low|medium|high|ultra`.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Accelerate / brake-reverse | W S / Up Down | RT / LT | GAS / BRAKE |
| Steer | A D / Left Right (or mouse, `M`) | Left stick, D-pad | arrows or tilt |
| Restart | Enter | Start | RESTART |
| Respawn | Backspace | Y | RESPAWN |
| Camera | C | A | camera button |
| Pause menu / back | Esc / P | Back (B in menus) | menu button |
| Ghost cycle | G | | |
| Replay (finish screen) | V | | |
| Menu navigation | arrows, Enter, Esc | D-pad / stick, A, B | tap |

## Deploy

`.github/workflows/pages.yml` tests, builds with `BASE_PATH=/<repo>/` and publishes `dist/` to GitHub Pages on pushes to `main`
or when run by hand (enable *Settings > Pages > Source: GitHub Actions* once). The build is fully static, and a service worker
precaches the game for offline play, so no server is needed. See
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) before publishing.

## Project layout

| Folder | What |
| --- | --- |
| `src/physics` | Vehicle model, surfaces and effects, deterministic simulation, Rapier wrapper |
| `src/tracks` | Block library, track builder, terrain, level format, validation bot |
| `src/core` | App shell, race / replay sessions, input, ghosts, records, settings, save file |
| `src/render` | Renderer, themes, scenery, cars, effects |
| `src/ui` | HUD and screens |
| `src/audio` | Engine, effects and music synthesis |
| `src/data` | Cars, campaign tiers, the levels and their author ghosts |
| `scripts` | Level definitions and builder, labs, headless browser tests |
| `docs` | Phase notes 1-8, level report, release checklist |

Phase notes: [`1`](docs/PHASE_1.md) physics & input · [`2`](docs/PHASE_2.md) tracks & timing · [`3`](docs/PHASE_3.md) cars & surfaces ·
[`4`](docs/PHASE_4.md) menus, medals, ghosts · [`5`](docs/PHASE_5.md) visuals · [`6`](docs/PHASE_6.md) campaign · [`7`](docs/PHASE_7.md) editor ·
[`8`](docs/PHASE_8.md) polish & release. · [`1.1`](docs/VISUAL_OVERHAUL.md) visual overhaul & rendering fixes · [`1.2`](docs/STADIUM_UPDATE.md) stadium arenas, new cars, accurate jumps, landing page · [`1.3`](docs/UPDATE_1_3.md) terrain and worlds, car gates, hand-built campaign, physics fixes, new menus (editor removed).

NITROVOLT is its own game: names, logos, cars and menus are original designs, not copies of any other title's branding.

## Licence notes

Uses three.js (MIT) and Rapier (Apache-2.0). All game content is generated by this code.
