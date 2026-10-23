# NITROVOLT: project memory

A handover file so a new session (human or AI) can pick up without the old chat. Read this first, then `README.md`
and `docs/UPDATE_1_3.md`.

Last updated: 2026-10-23. Version **1.3.0**, commit `c94e4f7` on `claude/adoring-wright-8tz8fj`. The deploy (Pages
run 5) succeeded.

---

## 1. What it is

NITROVOLT is an original browser time-attack racer, Trackmania-like in feel:
- short, fast, hand-built tracks;
- instant restart and exact ghosts;
- medals (Author, Gold, Silver, Bronze);
- car switches mid-run, wall turns, loops and jumps.

Everything is generated in code: cars, tracks, terrain, scenery, sky, textures, sound and music. The only bundled
assets are two fonts, plus screenshots of the game itself in `public/art/`.

**Branding rule:** no Trackmania, Ubisoft or Nadeo logos, names or copied assets. We copy the feel and layout,
never the branding.

- Live: https://coder-4847.github.io/Nitrovolt/
- Repo: `coder-4847/Nitrovolt` (GitHub shows `Coder-4847`).
- Working branch: **`claude/adoring-wright-8tz8fj`**. Develop and push only here, and don't open a PR unless asked.
  `main` is behind.

## 2. Working rules agreed with the user

- **Commit trailers** go at the end of every commit message:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <session url>
  ```
  Never put model names or IDs in code, docs or committed files. The trailer above is the only exception.
- **Deploy:** push the branch, then run the workflow `pages.yml` by hand (workflow_dispatch) with
  `ref = claude/adoring-wright-8tz8fj`. The workflow also runs on pushes to `main`. It runs tests, builds with
  `BASE_PATH=/Nitrovolt/` and publishes `dist/`.
- **Temp files** go in the session scratchpad, not the repo. Dev tools worth keeping go in `scripts/dev/`. Scripts
  outside the repo can't import `three`.
- **Stopping servers:** use `kill $(lsof -t -i:PORT)`, never `pkill -f`.
- **Cloud container quirks:**
  - github.io is not reachable from the container (curl returns 000), so check deploys via the Actions run status.
  - Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. It needs the swiftshader flags used in
    the scripts.
  - Software GL runs the game at about 1 fps, so browser tests need generous waits.
- **The user's style:** they send big feature lists with reference screenshots and expect "extreme effort". They
  sometimes say "don't start yet", then send pictures and say "start building". Show screenshots of the results.

## 3. Commands

```bash
npm run dev                     # vite on :5173 (tests/scripts use http://127.0.0.1:5173/)
npm test                        # vitest: 118 tests, about 16 s (FULL=1: per-level checks on every level)
npm run build                   # tsc --noEmit + vite build (BASE_PATH=/Nitrovolt/ for Pages)
npm run levels                  # = npx tsx scripts/make-levels.mts (about 30 s, see section 6)
npx tsc --noEmit -p .           # typecheck (src + tests; scripts are not in tsconfig)
```

Browser regression scripts (Playwright, need the dev server unless noted):

| Script | Checks | Env |
| --- | --- | --- |
| `scripts/phase4-test.mjs` | Full flow: landing, menu, Play hub, tiers, race, pause, settings, finish, replay, ghost, records, training, save export / import | `OUT=` prefix for shots |
| `scripts/p6-campaign.mjs` | Tiles and thumbnails of campaign and training | `OUT=` |
| `scripts/p4-mobile.mjs` | 844×390 touch flow | `OUT=` |
| `scripts/deploy-test.mjs` | Needs a production build on :4173 (see below). PWA, offline race, bot reproduces the c18 author time bit-exactly | `SHOTS=` dir |
| `scripts/menu-shots.mjs <prefix>` | Screenshots of landing, menu, play, campaign | |
| `scripts/dev/landing-shots.mjs <prefix>` | Landing sections (`W=390 H=844` for phone) | |
| `scripts/car-shots.mjs`, `scripts/make-art.mjs` | Car pictures and world postcards in `public/art/` | uses `dev/car-solo.html`, `dev/cars.html` |

To serve the production build for `deploy-test.mjs`:
`BASE_PATH=/Nitrovolt/ npm run build && BASE_PATH=/Nitrovolt/ npx vite preview --port 4173 --host 127.0.0.1`.
All last-known results were passing at 1.3.0.

Labs (tsx): `brake-lab.ts`, `vib-lab.ts`, `cam-lab.ts`, `jump-lab.mts`, `bot-trace.mts`, `track-map.mts`,
`scripts/dev/terrain-check.mts` (terrain above road?), `sample-dump.mts <id> <i>`, `wallride-speed.mts`,
`wallride-trace.mts`.

Dev URL flags: `?debug=1` (tuning panel, debug HUD, `window.__nv` = App), `?level=<id>`, `?autodrive=1`,
`?car=<id>`, `?track=flat|greybox`, `?quality=low|medium|high|ultra`.
In debug mode, `__nv.fastForward(seconds)` and `__nv.simulation` / `race` / `gfx` / `screens` / `mode` are useful.

## 4. Architecture (src/)

| Folder | Key files |
| --- | --- |
| `physics/` | `Vehicle.ts`: own raycast-suspension car, tyre model, ABS, yaw stability, off-road. `VehicleParams.ts`: params and descriptors (stadium car = VOLT). `cars/{gravel,frost,dune}.ts` derive from VOLT. `Simulation.ts`: deterministic 100 Hz step; checkpoints, respawn, car gates, `PHYSICS_VERSION='p6.0'`. `RapierWorld.ts`: Rapier for collision queries only, plus the terrain heightfield collider. `Surface.ts`, `Effects.ts`: surfaces and special pads. `CarBehavior.ts` |
| `tracks/` | `TrackSchema.ts`: `CELL=32`, `LEVEL_H=8`, widths std 24 / wide 32 / narrow 16, level JSON format. `BlockLibrary.ts`: every block. `TrackBuilder.ts`: centerline, frames, banking, `trueTangents`, triggers. `ChainLayout.ts`: chain items to grid blocks. `TrackGenerator.ts`: `buildTrack(json)` returns TrackData with meshes, triggers, centerline, `centerFrame`, terrain, killY. `Terrain.ts`. `PathBot.ts`: validation / autodrive bot. `Validate.ts`: bot run, ghost record and exact check. `GreyboxTrack.ts`, `TestTracks.ts`: dev tracks |
| `core/` | `App.ts`: shell, modes menu / race / replay, backdrop. `RaceSession.ts`: countdown, ghosts, finish. `ReplaySession.ts`. `Ghost.ts`: recorder / player, fingerprints, `carAt(tick)`. `GhostStore.ts`: IndexedDB plus bundled author ghosts. `Records.ts`, `Settings.ts`, `SaveFile.ts`: export / import, v1 and v2 saves; old user levels ignored. `Run.ts`: timing, `crossedForward`. `input/`: keyboard, gamepad, touch, bindings |
| `render/` | `GameRenderer.ts`, `Showroom.ts`: main-menu podium scene. `CarView.ts`: wheel blur, droop limiting. `CameraRig.ts`. `cars/{volt,gravel,frost,dune,parts}.ts`. `env/`: `Landscape.ts` (terrain mesh and shader, NOISE_GLSL), `SceneryPlan.ts`, `Scenery.ts` (instanced, wind, near/far LOD), `Theme.ts`, `Arena.ts` (distant stadium), `Arches.ts` (checkpoint arches and car-gate portals), `Pillars.ts`, `RoadMaterial.ts`, `Sky.ts`, `Signage.ts`. Also `Quality.ts`, `Thumbnail.ts`, `WheelFx.ts` |
| `ui/` | `Hud.ts`, `TouchControls.ts`, `styles.css` (the "1.3" section at the end holds the new menus). `screens/`: `LandingScreen`, `MainMenu`, `PlayScreen`, `LevelSelectScreen`, `LeaderboardScreen` (titled "Records"), `SettingsScreen` (with `setSettingsTab('garage')`), `PauseScreen`, `HelpScreen`, `AboutScreen`, `ScreenManager` (screens may set `backdropShift`), `AppApi` |
| `data/` | `cars.ts`: labels Stadium / Rally / Snow / Desert for ids volt / gravel / frost / dune, liveries, blurbs, camera styles. `campaign.ts`: tiers, unlocks, `trackOfTheDay`. `index.ts`: `LEVELS`, `getLevel`, `DEFAULT_LEVEL_ID='c01'`. `levels/*.json`, `ghosts/*.json`, `levels.json` (manifest, all generated) |
| `audio/` | Synth engine and music |

The service worker is built by the plugin in `vite.config.ts` from `src/sw-template.js`. It precaches every built
file, the icons and `public/art/*`. The cache name includes the version and a hash.

localStorage keys: `nitrovolt.settings.v1`, `.records.v1`, `.bindings.v1`, `.audio.v1`, `.quality`, `.lastLevel`,
`.menuCar`, `.tilt` (and a few legacy ones). Ghosts live in IndexedDB.

## 5. Game design state (1.3)

- **Cars:**
  - Stadium (volt): open-wheeler, best grip and speed;
  - Rally (gravel): 80s hatch, for dirt;
  - Snow (frost): mini pickup, for snow and ice;
  - Desert (dune): muscle coupe, floaty, big air.
- **Physics fixes in 1.3:**
  - more grip (volt 2.45 / 2.4 front / rear, gravel 1.78 / 1.74, frost 1.68 / 1.63, dune 1.9 / 1.86);
  - `brakeGripUse` 0.7 (ABS);
  - `yawStability` (volt 0.6, gravel 0.25, frost 0.4, dune 0.35);
  - `brakeRearSlide` reduced (0.04 / 0.1 / 0.06 / 0.08);
  - off-road: grip ×0.8 and extra rolling 0.14.
- **Car gates:** blocks `gateVolt`, `gateGravel`, `gateFrost`, `gateDune` (trigger kind `'car'`).
  - The sim switches car with `Vehicle.setCar(params, behavior)` and emits `{type:'car'}`.
  - A checkpoint stores the car for respawn; restart restores the start car.
  - The physics fingerprint covers all cars plus `sim.startParams`.
- **Terrain:** a heightfield per track, shared by physics and the drawn landscape (same triangle split).
  - It stays a kerb (0.15 m) under the road.
  - Embankments reach up to 10 m; pits under jump gaps are 14 m deep.
  - Special pieces (loops, spirals) stay clear of terrain.
  - Hills fade near the stadium ring (`ARENA_INSET` 210, `TERRAIN_MARGIN` 300).
  - `TerrainData.near` holds the road distance per vertex, which scenery clearance uses.
- **Wall turns:** the road rolls about its inner edge, and the bank eases in over half the turn. A faster roll-in
  threw cars off.
  - The bot treats samples with `u.y < 0.8` as banked and carries at least 48 m/s near walls.
  - `wallRide4L/R` needs a steering driver; it holds at 30–60 m/s with steering.
- **Blocks:**
  - Basics: straight1/2/4, start, checkpoint, finish, lapFinish.
  - Corners: curves R16 / R48 / R80, banked 48 / 80, wallTurnL/R (U, R48, 78°), wallTurn90L/R (R80, 72°),
    chicanes (+wide).
  - Height: slopes 1 / 2, steep.
  - Jumps: kicker, jumpRamp, jumpRampLong, jumpRampBig; landing1 / Long / XL.
  - Other: platforms, loop, halfpipe2, wallRide4L/R, spiralDownL/R, the four gates, scenery (pylon, arch, tower).
- **Worlds / themes:** forest, snow, desert, sunset, night. `stadium` is an alias of forest; old ids map via
  `ALIASES` in `Theme.ts`.
- **Campaign:** 25 tracks in 5 tiers (0 White, 1 Green, 2 Blue, 3 Red, 4 Black), plus 8 training tracks.
  - Bronze on 4 tracks of a tier (`TIER_UNLOCK`) opens the next tier. Training is always open.
  - The settings option `unlockAll` opens everything.
  - Track of the day: a shuffled campaign track per UTC day.
- **Medal factors** (gold / silver / bronze × author time): training 1.1 / 1.3 / 1.6, White 1.08 / 1.25 / 1.55,
  Green 1.07 / 1.22 / 1.5, Blue 1.06 / 1.2 / 1.45, Red 1.05 / 1.18 / 1.4, Black 1.045 / 1.15 / 1.35.
- **Menus:**
  - Landing: hero over the showroom, five worlds, four cars, features, controls.
  - Main menu: slanted green list (Play, Continue, Records, Garage, Settings), podium car card with arrows (stored
    in `nitrovolt.menuCar`), medal tally, footer links (Home, How to play, About).
  - Play hub: tiles for Campaign, Training, Track of the day and Records, over postcards.
  - Level select: tier rows of tiles.
- **Removed in 1.3:** track editor, user tracks, share links, level generator, 100-level seasons campaign.

### Levels (author times after the 1.3.0 terrain fix)

| Id | Tier | Name | World | Start car | Notes | Author |
| --- | --- | --- | --- | --- | --- | --- |
| c01 | White | Opening Lap | forest | volt | jump | 30.104 |
| c02 | White | Pine Run | snow | frost | kicker | 40.833 |
| c03 | White | Red Dust | desert | dune | jumps | 35.356 |
| c04 | White | Golden Hour | sunset | volt | wall turn | 32.068 |
| c05 | White | Rally Woods | forest | gravel | kicker | 34.917 |
| c06 | Green | Loop Lane | night | volt | loop, wall turn | 33.264 |
| c07 | Green | Two Faces | forest | volt | gates: rally, then stadium | 39.098 |
| c08 | Green | Ice Lake | snow | frost | | 51.036 |
| c09 | Green | Mesa Hop | desert | dune | 3 jumps | 37.183 |
| c10 | Green | Halfpipe | sunset | volt | wall-ride, wall turn | 33.231 |
| c11 | Blue | Snow Patrol | snow | volt | gates: snow, then stadium | 44.358 |
| c12 | Blue | Spiral | forest | volt | | 44.994 |
| c13 | Blue | Sand Rally | desert | dune | gates: rally, then desert | 36.224 |
| c14 | Blue | Night Shift | night | volt | loop, wall turn | 32.371 |
| c15 | Blue | Four Seasons | sunset | volt | gates: all four cars | 44.590 |
| c16 | Red | Skyline | night | volt | jumps, wall turn | 35.255 |
| c17 | Red | Avalanche | snow | frost | gates: rally, then snow | 56.687 |
| c18 | Red | Mirage | desert | dune | gate: stadium; big jump | 37.753 |
| c19 | Red | Corkscrew | forest | volt | loop, wall-ride | 34.935 |
| c20 | Red | Endurance | sunset | volt | 2 laps; gates | 53.126 |
| c21 | Black | Gauntlet | night | volt | loop, wall turns | 34.804 |
| c22 | Black | Whiteout | snow | frost | gates | 65.528 |
| c23 | Black | Sandstorm | desert | dune | gate: stadium | 46.183 |
| c24 | Black | Vortex | sunset | volt | loop, 3 wall turns | 44.167 |
| c25 | Black | Grand Final | forest | volt | everything; all four cars | 64.291 |
| t01 | Training | Basics | forest | volt | | 27.765 |
| t02 | Training | Air Time | forest | volt | jumps | 32.299 |
| t03 | Training | Wall Ride | sunset | volt | wall turns | 28.678 |
| t04 | Training | Loop | night | volt | loop | 27.542 |
| t05 | Training | Dirt Road | forest | gravel | | 35.226 |
| t06 | Training | Snowfield | snow | frost | | 47.532 |
| t07 | Training | Dunes | desert | dune | | 29.790 |
| t08 | Training | Car Switch | sunset | volt | gates: rally, snow | 31.615 |

The full table, with medals, speeds, air time and wall hits, is in `docs/LEVEL_REPORT.md`.

## 6. How to change levels

1. Edit the definitions in `scripts/levels/campaign.ts` or `training.ts`. They use the DSL in `scripts/levels/dsl.ts`:
   - `start()`, `cp()`, `finish()`, `lap()`, `gate('gravel')`;
   - `road(n, opt)`: n cells of 32 m;
   - `jump(ramp, gap, opt, landing)`;
   - `turbo(...)`;
   - `B('blockId', opt)` for any block, with opt `{ s: surface, w: walls, v: variant, gap, dy }`.

   Each level has `{ id, name, theme, car, tier, laps?, items, hints?, blurb }`. `scripts/levels/lab.ts` is a
   scratch place for trying layouts.
2. Run `npm run levels` (`ONLY=c05,c07` builds a subset). It validates each level, records the author ghost,
   checks it replays exactly, sets medals, and writes the level JSON, ghosts, `levels.json`, `LEVEL_REPORT.md` and
   `scripts/levels/.runs.json`.
3. A level fails if the bot respawns, gets stuck, or spends more than 60 off-road ticks ("left the road"). An overlap
   check also runs, excluding a lap's closure. The fix is usually a better layout, or bot `hints` (maxSpeed,
   lookTime, steerSlew, lateralBudget).
4. Run `npm test`. The author-ghost tests fail if a level changed without rebuilding.

**Any change to physics, terrain or blocks means rebuilding all levels** (`npm run levels`), or the bundled ghosts
go stale. When the physics changes on purpose, bump `PHYSICS_VERSION`.

## 7. Known issues / ideas for next time

- The stadium car still reads a bit F1-like. Trees are stylised and somewhat cartoony. The user wanted a TM-like
  look; more realism is possible.
- Performance: about 0.76M triangles at low and 2.5M at high, counting the shadow pass. The near canopy trees
  (1,516 triangles each) dominate. Next steps would be impostors or billboards for far trees, or a third LOD band.
  The dynamic-resolution floor (0.55) is unchanged.
- Under software GL the game runs at about 1 fps. Browser tests space key presses about 4 s apart, and
  `phase4-test` waits up to 90 s for the countdown.
- In a race, the HUD title shows "Track · Car label", e.g. "Opening Lap · Stadium".
- `scripts/dev/wall*.mts` are old wall-turn experiments and can be deleted.
- `main` hasn't been updated with 1.3; it lives on the working branch. Ask before merging or opening a PR.
- The user asked for big, varied, fun levels with wall rides and loops. Future work: more tracks per tier, more
  stunt blocks (wall-ride curves, bigger loops, inverted sections), and the TM-style top-left live leaderboard in
  the HUD.

## 8. History

| Version | What |
| --- | --- |
| Phases 1–8 (1.0) | Physics, tracks, cars, menus / medals / ghosts, visuals, 100-level campaign, editor, PWA and deploy (`docs/PHASE_*.md`) |
| 1.1 | Visual overhaul (`docs/VISUAL_OVERHAUL.md`) |
| 1.2 | Stadium arenas, new cars, accurate jumps, landing page (`docs/STADIUM_UPDATE.md`) |
| 1.3 (this) | 32 m grid, terrain, car gates, hand-built campaign, grip and brake fixes, vibration fix, TM-style menus, editor removed (`docs/UPDATE_1_3.md`) |

Commits: `fd2cfac` (WIP 1.3), then `c94e4f7` (1.3.0). Final 1.3 fixes: a terrain spike on banked curves, which
improved several author times, and scenery LOD.
