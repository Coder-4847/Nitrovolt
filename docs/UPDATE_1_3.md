# 1.3: Worlds, car gates and a hand-built campaign

1.3 rebuilds the game around big tracks that run through real landscapes, with the stadium far off on the horizon.
The 100 generated levels and the track editor are gone. In their place is a 25-track campaign built by hand, plus 8
training tracks, with car switches, wall turns and loops throughout.

## Tracks and terrain

- **Grid doubled**: a cell is now 32 m and a level step 8 m. Roads are 24 m wide (32 m wide, 16 m narrow). Corners
  have 16 / 48 / 80 m radii, and the jumps, landings, loops and wall-rides were all rescaled to match.
- **Terrain** (`src/tracks/Terrain.ts`): a deterministic heightfield built per track. The same grid is the Rapier
  heightfield collider and the drawn landscape, split along the same triangle diagonal, so what you see is what you
  hit. Its rules:
  - it stays a kerb (0.15 m) under the road;
  - it builds embankments up to 10 m so roads don't float;
  - it drops into 14 m pits under jump gaps;
  - it keeps clear of loops and spirals;
  - it rolls into hills away from the track, flattening again near the distant stadium.
- **Off-road**: grass, snow and sand beside the road cost grip (×0.8) and add rolling drag. Cutting a corner across
  the field is possible, but rarely faster.
- **Wall turns**: 180° (R48, 78° bank) and 90° (R80, 72°) turns that roll about their inner edge, easing the bank in
  over half the turn. A car at speed stays on the wall; a slow car slides down to the inner edge.
- **Car gates**: drive through a portal and the rest of the section is in another car (Stadium, Rally, Snow or
  Desert, each with its own colour). A respawn puts you back in the car you had at the checkpoint, and a restart
  gives you back the start car. Ghosts and replays switch models at the same tick, and the physics fingerprint
  covers every car, so ghosts stay exact through any number of switches.

## Campaign

- 25 tracks in five tiers (White, Green, Blue, Red, Black), defined in a small DSL in `scripts/levels/`.
- Bronze on 4 tracks of a tier opens the next tier. Training is always open.
- **Track of the day**: a different campaign track every day (UTC), the same for everyone. It walks through all 25
  in a shuffled order before any repeats.
- `npx tsx scripts/make-levels.mts` (`npm run levels`) builds every level, drives it with the validation bot, records
  the author ghost, checks the ghost replays exactly, and writes [`LEVEL_REPORT.md`](LEVEL_REPORT.md). A level
  fails if the bot respawns, gets stuck, or spends more than 0.6 s off the road.
- Medal times are multiples of the author time, tighter in later tiers:

  | Tier | Gold | Silver | Bronze |
  | --- | --- | --- | --- |
  | Training | ×1.10 | ×1.30 | ×1.60 |
  | White | ×1.08 | ×1.25 | ×1.55 |
  | Green | ×1.07 | ×1.22 | ×1.50 |
  | Blue | ×1.06 | ×1.20 | ×1.45 |
  | Red | ×1.05 | ×1.18 | ×1.40 |
  | Black | ×1.045 | ×1.15 | ×1.35 |

## Physics (engine version p6.0)

- **More cornering grip** on every car (Stadium 2.45 / 2.4 front / rear).
- **Brake taps no longer spin the car**:
  - the service brake is ABS-limited to 70 % of the tyre's grip;
  - the rear-slide coupling on braking is much smaller;
  - a new yaw-stability term damps yaw that the steering isn't asking for.

  A 200 ms brake tap mid-corner used to rotate the car 47–90°. It now holds the line (`scripts/brake-lab.ts`).
- **The car no longer vibrates at speed.** At high spin rates the wheel rims are drawn as blurred discs instead of
  strobing spokes, suspension droop is rate-limited, and the FOV kick is gentler.

## Environments and graphics

- **Five worlds**:
  - Forest: broadleaf woods, poplars and verges with tufts and flowers;
  - Snow: snow-laden pines and an ice-blue rink;
  - Desert: cacti, shrubs, barrels and mesas;
  - Sunset: cherry blossom;
  - Night: floodlights and stars.

  Old theme names still map onto them.
- **Scenery** is planned on the terrain, with a clearance per kind (tufts at the kerb, trees a few metres back),
  and sways in the wind. Props more than 45 m from the road use lighter geometry and cast no shadow, which cut the
  triangle count by about a third.
- **Stadium** stands are scaled up and set well beyond the track. Pillars stand on the terrain.
- **Roads**: darker tarmac, wider kerbs, block joints and painted lines; rink lines on snow.

## Cars

- Smaller on screen, with a camera that sits further back (distance 5.9 m, height 1.95 m for the stadium car).
- **Stadium**: a chunky open-wheeler with a shovel nose, sidepods, LED tail lights and a speed plate.
- **Rally**: an 80s rally hatch.
- **Snow**: a mini pickup on studded tyres.
- **Desert**: a lifted muscle coupe.
- Default liveries are red and white.

## Menus

- **Main menu**:
  - a showroom behind it: the menu car on a lit podium in a snowy stadium, with a driver beside it;
  - a slanted green list (Play, Continue, Records, Garage, Settings);
  - a card for the podium car with arrows to switch cars, and the medal tally.
- **Play**: four tiles (Campaign with progress per tier, Training, Track of the day, Records), each over an in-game
  picture of its world.
- **Campaign**: one row of tiles per tier, each with a map thumbnail, its cars, medal and personal best.
- **Landing page**: a hero over the showroom, the five worlds, the four cars, features and controls. The menu
  pictures (`public/art/`) are screenshots of the game (`scripts/make-art.mjs`) and are precached for offline play.

## Removed

- The track editor, user tracks and share links. Old saves still import; their user tracks are ignored.
- The level generator and the four-season, 100-level campaign.

## Checks

- `npm test`: 118 unit and integration tests. They cover tier unlocks, the track of the day, terrain against the
  physics heightfield, terrain staying under the road, exact ghosts through car gates, wall-ride holding,
  scenery clearance and the new grid.
- `scripts/deploy-test.mjs` (production build under a sub-path): PWA, offline race, and the bot reproducing c18's
  author time bit for bit across a car switch.
- `scripts/phase4-test.mjs`, `scripts/p6-campaign.mjs`, `scripts/p4-mobile.mjs`: the menu flow, race, finish,
  replay, ghosts and save export / import, on desktop and on a phone.

## Fixed during the update

- **Terrain spikes on banked curves.** On the outer side of a banked curve, a grid point could fall in the wedge
  between two road segments. It was then treated as beside the road, not under it, and pushed up to the banked
  outer edge's height: up to 2 m through the road. Fixing it took several seconds off some author times, because
  the bot had been clipping those spikes.
