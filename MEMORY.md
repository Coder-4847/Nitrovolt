# NITROVOLT: project memory

A handover file so a new session (human or AI) can pick up without the old chat. Read this first, then `README.md`
and `docs/UPDATE_1_3.md`.

Last updated: 2026-10-29. Version **1.4.0** on `ccr-c6af22eb-81oeu3` (the 1.3 history is below it). Read
`docs/UPDATE_1_4.md` for what 1.4 changed.

---

## 1. What it is

NITROVOLT is an original browser time-attack racer, Trackmania-like in feel:
- short, fast, hand-built tracks;
- instant restart and exact ghosts;
- a pure time system: personal best against a target time, no medals, stars or unlocks;
- car switches mid-run, wall turns, loops and jumps.

Everything is generated in code: cars, tracks, terrain, scenery, sky, textures, sound and music. The only bundled
assets are two fonts, plus screenshots of the game itself in `public/art/`.

**Branding rule:** no Trackmania, Ubisoft or Nadeo logos, names or copied assets. We copy the feel and layout,
never the branding.

- Live: https://coder-4847.github.io/Nitrovolt/
- Repo: `coder-4847/Nitrovolt` (GitHub shows `Coder-4847`).
- Working branch for 1.4: **`ccr-c6af22eb-81oeu3`** (earlier work was on `claude/adoring-wright-8tz8fj`). Develop and
  push only on the branch the session names, and don't open a PR unless asked. `main` is behind.

## 2. Working rules agreed with the user

- **Commit trailers** go at the end of every commit message:
  ```
  Co-Authored-By: <the model named in the session's attribution note> <noreply@anthropic.com>
  Claude-Session: <session url>
  ```
  Never put model names or IDs in code, docs or committed files. The trailer above is the only exception.
- **Deploy:** push the branch, then run the workflow `pages.yml` by hand (workflow_dispatch) with
  `ref = <the branch>`. The workflow also runs on pushes to `main`. It runs tests, builds with
  `BASE_PATH=/Nitrovolt/` and publishes `dist/`.
- **Temp files** go in the session scratchpad, not the repo. Dev tools worth keeping go in `scripts/dev/`. Scripts
  outside the repo can't import `three`.
- **Stopping servers:** use `kill $(lsof -t -i:PORT)`, never `pkill -f`.
- **Cloud container quirks:**
  - github.io is not reachable from the container (curl returns 000), so check deploys via the Actions run status.
  - Chromium is `/opt/pw-browsers/chromium` (a symlink). It needs the swiftshader flags used in the scripts.
  - Software GL runs the game at about 1 fps, so browser tests need generous waits.
- **The user's style:** they send big feature lists with reference screenshots and expect "extreme effort". They
  sometimes say "don't start yet", then send pictures and say "start building". Show screenshots of the results.

## 3. Commands

```bash
npm run dev                     # vite on :5173 (tests/scripts use http://127.0.0.1:5173/)
npm test                        # vitest: 114 tests, about 12 s (FULL=1: per-level checks on every level)
npm run build                   # tsc --noEmit + vite build (BASE_PATH=/Nitrovolt/ for Pages)
npm run levels                  # = npx tsx scripts/make-levels.mts (about 20 s, see section 6)
npx tsc --noEmit -p .           # typecheck (src + tests; scripts are not in tsconfig)
```

Browser regression scripts (Playwright, need the dev server unless noted):

| Script | Checks | Env |
| --- | --- | --- |
| `scripts/phase4-test.mjs` | Full flow: landing, menu, Play hub, world rows, race, pause, settings, finish, replay, ghost, records, save export / import (slow under software GL; run it with nothing else busy) | `OUT=` prefix for shots |
| `scripts/p6-campaign.mjs` | Tiles and thumbnails of the campaign | `OUT=` |
| `scripts/p4-mobile.mjs` | 844×390 touch flow | `OUT=` |
| `scripts/deploy-test.mjs` | Needs a production build on :4173 (see below). PWA, offline race, bot reproduces the c18 target time bit-exactly | `SHOTS=` dir |
| `scripts/menu-shots.mjs <prefix>` | Screenshots of landing, menu, play, campaign | |
| `scripts/level-shots.mjs <prefix> <id:sec,sec>...` | In-race screenshots while the bot drives (`NOBOT=1`: you stand still, the ghost drives; `DEBUGUI=1` keeps the debug panels) | `W`, `H`, `Q`, `WAIT` |
| `scripts/dev/landing-shots.mjs <prefix>` | Landing sections (`W=390 H=844` for phone) | |
| `scripts/car-shots.mjs`, `scripts/make-art.mjs` | Car pictures and world postcards in `public/art/` | uses `dev/car-solo.html`, `dev/cars.html` |

To serve the production build for `deploy-test.mjs`:
`BASE_PATH=/Nitrovolt/ npm run build && BASE_PATH=/Nitrovolt/ npx vite preview --port 4173 --host 127.0.0.1`.
Unit tests and the build passed at 1.4.0; see the end of the session notes for which browser scripts were re-run.

Labs (tsx): `brake-lab.ts`, `vib-lab.ts`, `cam-lab.ts`, `jump-lab.mts`, `bot-trace.mts`, `track-map.mts`,
`scripts/dev/terrain-check.mts` (terrain above road?), `sample-dump.mts <id> <i>`, `wallride-speed.mts`,
`wallride-trace.mts`. Level tools in `scripts/levels/`: `try.mts` (layout, lint, bot time; nothing written),
`plan.mts <id>` (cell and heading of every block), `styles.mts <id>` (how each bot style ends), `debug.mts <id>`
(drive log; `AIR=1` takeoffs and landings, `OFF=1` off-road, `STYLE=`, `FROM`/`TO`), and `TRACE=<style> FORCE=1 npx tsx
scripts/track-map.mts <prefix> <ids>` (maps with the bot's path: red off-road, yellow airborne).

Dev URL flags: `?debug=1` (tuning panel, debug HUD, `window.__nv` = App), `?level=<id>`, `?autodrive=1`,
`?car=<id>`, `?track=flat|greybox`, `?quality=low|medium|high|ultra`.
In debug mode, `__nv.fastForward(seconds)` and `__nv.simulation` / `race` / `gfx` / `screens` / `mode` are useful.

## 4. Architecture (src/)

| Folder | Key files |
| --- | --- |
| `physics/` | `Vehicle.ts`: own raycast-suspension car, tyre model, ABS, yaw stability, off-road. `VehicleParams.ts`: params and descriptors (stadium car = VOLT). `cars/{gravel,frost,dune}.ts` derive from VOLT. `Simulation.ts`: deterministic 100 Hz step; checkpoints, respawn, car gates, `PHYSICS_VERSION='p7.0'`. `RapierWorld.ts`: Rapier for collision queries only, plus the terrain heightfield collider. `Surface.ts`, `Effects.ts`: surfaces and special pads. `CarBehavior.ts` |
| `tracks/` | `TrackSchema.ts`: `CELL=32`, `LEVEL_H=8`, widths std 24 / wide 32 / narrow 16, level JSON format. `BlockLibrary.ts`: every block. `TrackBuilder.ts`: centerline, frames, banking, `trueTangents`, triggers. `ChainLayout.ts`: chain items to grid blocks. `TrackGenerator.ts`: `buildTrack(json)` returns TrackData with meshes, triggers, centerline, `centerFrame`, terrain, killY. `Terrain.ts`. `PathBot.ts`: validation / autodrive bot (per-car pace and style, jump and wall limits). `Validate.ts`: bot run, ghost record and exact check. `GreyboxTrack.ts`, `TestTracks.ts`: dev tracks |
| `core/` | `App.ts`: shell, modes menu / race / replay, backdrop. `RaceSession.ts`: countdown, ghosts, finish. `ReplaySession.ts`. `Ghost.ts`: recorder / player, fingerprints, `carAt(tick)`. `GhostStore.ts`: IndexedDB plus bundled target ghosts (still called `authorGhost`). `Records.ts`, `Settings.ts`, `SaveFile.ts`: export / import, v1 and v2 saves; old user levels ignored. `Run.ts`: timing, `crossedForward`. `input/`: keyboard, gamepad, touch, bindings |
| `render/` | `GameRenderer.ts`, `Showroom.ts`: main-menu podium scene. `CarView.ts`: wheel blur, droop limiting. `CameraRig.ts`. `cars/{volt,gravel,frost,dune,parts}.ts`. `env/`: `Landscape.ts` (terrain mesh and shader, NOISE_GLSL), `SceneryPlan.ts`, `Scenery.ts` (instanced, wind, near/far LOD), `Theme.ts`, `Arena.ts` (distant stadium), `Arches.ts` (checkpoint arches and car-gate portals), `Pillars.ts`, `RoadMaterial.ts`, `Sky.ts`, `Signage.ts`. Also `Quality.ts`, `Thumbnail.ts`, `WheelFx.ts` |
| `ui/` | `Hud.ts` (clock, ghost gap, minimap, car chip, next gate, finish panel), `TouchControls.ts`, `styles.css` (the "1.3" and "1.4" sections at the end hold the menus and the new HUD). `screens/`: `LandingScreen`, `MainMenu`, `PlayScreen`, `LevelSelectScreen`, `LeaderboardScreen` (titled "Records"), `SettingsScreen` (with `setSettingsTab('garage')`), `PauseScreen`, `HelpScreen`, `AboutScreen`, `ScreenManager` (screens may set `backdropShift`), `AppApi` |
| `data/` | `cars.ts`: labels Stadium / Rally / Snow / Desert for ids volt / gravel / frost / dune, liveries, blurbs, camera styles. `campaign.ts`: `WORLDS`, `CAMPAIGN`, `lengthClass`, `nextLevel`, `trackOfTheDay`. `index.ts`: `LEVELS`, `getLevel`, `DEFAULT_LEVEL_ID='c01'`. `levels/*.json`, `ghosts/*.json`, `levels.json` (manifest, all generated) |
| `audio/` | Synth engine and music |

The service worker is built by the plugin in `vite.config.ts` from `src/sw-template.js`. It precaches every built
file, the icons and `public/art/*`. The cache name includes the version and a hash.

localStorage keys: `nitrovolt.settings.v1`, `.records.v2` (v1 was the 1.3 campaign; ignored), `.bindings.v1`, `.audio.v1`, `.quality`, `.lastLevel`,
`.menuCar`, `.tilt` (and a few legacy ones). Ghosts live in IndexedDB.

## 5. Game design state (1.4)

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
- **Worlds / themes** (theme id = world): forest = Summer, sunset = Autumn, snow = Winter, desert, night.
  `stadium` is an alias of forest; old ids map via `ALIASES` in `Theme.ts`.
- **Campaign (1.4):** 25 tracks, five worlds of five (sprint, three standard, marathon), all open. No medals, tiers,
  unlocks or training tracks; each track has a personal best and a target time (`json.target`, the bot's run).
  Time bands are enforced by `tests/campaign.test.ts` (bot time: sprint 30-45 s, standard 60-78 s, marathon
  90-120 s). Every track switches car; the marathons use three or more. Track of the day: a shuffled campaign track
  per UTC day. Records live under `nitrovolt.records.v2`.
- **Menus:**
  - Landing: hero over the showroom, five worlds, four cars, features, controls.
  - Main menu: slanted green list (Play, Continue, Records, Garage, Settings), podium car card with arrows (stored
    in `nitrovolt.menuCar`), "tracks timed" card, footer links (Home, How to play, About).
  - Play hub: tiles for Campaign, Track of the day and Records, over postcards.
  - Level select: world rows of five tiles (map, length class, cars, PB and target).
- **HUD (1.4):** clock bottom centre with the live gap to the ghost and the next car gate above it, times board
  top-left, minimap top-right, split pop-up, car-switch flash, finish panel with splits. Ghost gap and next gate are
  computed in `RaceSession.updateRaceHud` from distance along the centreline.
- **Removed in 1.4:** medals, tiers, unlock rules, training tracks. Removed in 1.3: track editor, user tracks, share
  links, level generator, 100-level seasons campaign.

### Levels (target times at 1.4.0)

| # | Id | World | Name | Cars | Target |
| --- | --- | --- | --- | --- | --- |
| 1 | c01 | Summer | Green Valley | Stadium > Rally | 0:39.503 |
| 2 | c02 | Summer | Lakeside Rally | Rally > Stadium | 1:04.681 |
| 3 | c03 | Summer | Hill Climb | Stadium > Rally > Stadium | 1:12.332 |
| 4 | c04 | Summer | Canopy Run | Rally > Stadium | 1:07.295 |
| 5 | c05 | Summer | Grand Valley | Stadium > Rally > Desert | 1:39.634 |
| 6 | c06 | Autumn | Falling Leaves | Rally > Stadium | 0:41.699 |
| 7 | c07 | Autumn | Harvest Run | Rally > Desert > Rally | 1:13.350 |
| 8 | c08 | Autumn | Misty Gorge | Stadium > Rally | 1:05.038 |
| 9 | c09 | Autumn | Switchback Pass | Rally > Stadium > Rally | 1:03.002 |
| 10 | c10 | Autumn | Amber Endurance | Rally > Stadium > Snow | 1:37.474 |
| 11 | c11 | Winter | Powder Sprint | Snow > Rally | 0:40.992 |
| 12 | c12 | Winter | Frozen Lake | Snow > Stadium | 1:15.494 |
| 13 | c13 | Winter | Avalanche Alley | Stadium > Snow > Stadium | 1:01.619 |
| 14 | c14 | Winter | Glacier Run | Snow > Rally > Snow | 1:02.743 |
| 15 | c15 | Winter | Blizzard Marathon | Stadium > Snow > Rally | 1:41.448 |
| 16 | c16 | Desert | Dune Dash | Desert > Stadium | 0:34.781 |
| 17 | c17 | Desert | Canyon Run | Desert > Rally > Desert | 1:04.628 |
| 18 | c18 | Desert | Mesa Jumps | Rally > Desert | 1:05.639 |
| 19 | c19 | Desert | Oasis Highway | Stadium > Desert > Stadium | 1:03.224 |
| 20 | c20 | Desert | Sahara Marathon | Desert > Rally > Stadium > Desert | 1:35.013 |
| 21 | c21 | Night | Neon Sprint | Stadium > Rally | 0:38.029 |
| 22 | c22 | Night | Downtown Drift | Rally > Stadium | 1:00.024 |
| 23 | c23 | Night | Skyline Stunts | Stadium > Desert > Stadium | 1:06.758 |
| 24 | c24 | Night | Midnight Mountain | Snow > Stadium > Snow | 1:09.985 |
| 25 | c25 | Night | Grand Final | Stadium > Rally > Snow > Desert > Stadium | 1:37.003 |

The full table, with lengths, speeds, air time and wall hits, is in `docs/LEVEL_REPORT.md`.

## 6. How to change levels

1. Edit the definitions in `scripts/levels/campaign.ts`. They use the DSL in `scripts/levels/dsl.ts`:
   - `start()`, `cp()`, `finish()`, `lap()`, `gate('gravel')`;
   - `road(n, opt)`: n cells of 32 m; `zig(n, opt, wide)` (campaign.ts): n alternating chicanes;
   - `jump(ramp, gap, opt, landing)`;
   - `turbo(...)`;
   - `B('blockId', opt)` for any block, with opt `{ s: surface, w: walls, v: variant, gap, dy }`.

   Each level has `{ id, name, theme, car, items, hints?, blurb }`; the theme is its world. `scripts/levels/lab.ts` is
   a scratch place for trying layouts.
2. Iterate with `npx tsx scripts/levels/try.mts [ids]` (nothing is written): it reports overlaps, jump lint, the bot's
   time and why a level fails. Use `plan.mts`, `styles.mts`, `debug.mts` and the TRACE maps (section 3) to find out why.
3. Run `npm run levels` (`ONLY=c05,c07` builds a subset). It validates each level, records the target ghost, checks
   it replays exactly, sets `target`, and writes the level JSON, ghosts, `levels.json`, `LEVEL_REPORT.md` and
   `scripts/levels/.runs.json`.
4. Run `npm test`. The author-ghost tests fail if a level changed without rebuilding, and `campaign.test.ts` checks
   the time bands and car switches.

Rules learned the hard way (the bot, and a player, need them):
- at least 3 straight cells before a ramp and 1-2 after the landing, and no corner right after a dune landing;
- no turbo pad before a wall turn or a jump; no ice right before a jump;
- the first cars' gates keep the next section's surface in mind (Stadium tarmac, Rally dirt, Snow snow and ice, Desert sand);
- route around your own road, or cross it at least one level (8 m) above.

**Any change to physics, terrain, blocks or the bot means rebuilding all levels** (`npm run levels`), or the bundled
ghosts go stale. When the physics changes on purpose, bump `PHYSICS_VERSION`.

## 7. Known issues / ideas for next time

- The stadium car still reads a bit F1-like. Trees are stylised and somewhat cartoony. The user wanted a TM-like
  look; more realism is possible.
- Performance: about 0.76M triangles at low and 2.5M at high, counting the shadow pass. The near canopy trees
  (1,516 triangles each) dominate. Next steps would be impostors or billboards for far trees, or a third LOD band.
  The dynamic-resolution floor (0.55) is unchanged.
- Under software GL the game runs at about 1 fps. Browser tests space key presses about 4 s apart, and
  `phase4-test` waits up to 90 s for the countdown.
- The target is a bot run: a practised player can beat it, a first run is slower. Ghost gap is distance based, so it is
  rough on jumps.
- The `arch` scenery block is a plain red frame and looks poor next to the gates; it is unused.
- `scripts/dev/wall*.mts` are old wall-turn experiments and can be deleted.
- `main` hasn't been updated with 1.3 or 1.4; they live on working branches. Ask before merging or opening a PR.
- Ideas: crossovers (bridges over your own road), more stunt blocks (wall-ride curves, bigger loops), special pads
  (cruise, slow-mo, low gravity) in the new levels, online leaderboards, and playtesting the bands with humans.

## 8. History

| Version | What |
| --- | --- |
| Phases 1–8 (1.0) | Physics, tracks, cars, menus / medals / ghosts, visuals, 100-level campaign, editor, PWA and deploy (`docs/PHASE_*.md`) |
| 1.1 | Visual overhaul (`docs/VISUAL_OVERHAUL.md`) |
| 1.2 | Stadium arenas, new cars, accurate jumps, landing page (`docs/STADIUM_UPDATE.md`) |
| 1.3 | 32 m grid, terrain, car gates, hand-built campaign, grip and brake fixes, vibration fix, TM-style menus, editor removed (`docs/UPDATE_1_3.md`) |
| 1.4 (this) | Time-only campaign: 25 new tracks in five worlds, no medals, new HUD / ghosts, quicker cars, per-car level bot (`docs/UPDATE_1_4.md`) |

Commits: `fd2cfac` (WIP 1.3), then `c94e4f7` (1.3.0). Final 1.3 fixes: a terrain spike on banked curves, which
improved several author times, and scenery LOD.
