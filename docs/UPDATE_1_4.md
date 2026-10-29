# 1.4: the time-attack campaign

1.4 turns NITROVOLT into a pure time-attack game. The medal and tier system is gone, every track is open from the
start, and the campaign is rebuilt as 25 new hand-made tracks in five worlds.

## The campaign

Five worlds, five tracks each, in play order. Every world runs the same rhythm: a sprint, three standard tracks and a
marathon.

| World | Sprint (30-45 s) | Standard (1:00-1:15) | Marathon (1:30-2:00) |
| --- | --- | --- | --- |
| Summer | 01 Green Valley | 02 Lakeside Rally, 03 Hill Climb, 04 Canopy Run | 05 Grand Valley |
| Autumn | 06 Falling Leaves | 07 Harvest Run, 08 Misty Gorge, 09 Switchback Pass | 10 Amber Endurance |
| Winter | 11 Powder Sprint | 12 Frozen Lake, 13 Avalanche Alley, 14 Glacier Run | 15 Blizzard Marathon |
| Desert | 16 Dune Dash | 17 Canyon Run, 18 Mesa Jumps, 19 Oasis Highway | 20 Sahara Marathon |
| Night | 21 Neon Sprint | 22 Downtown Drift, 23 Skyline Stunts, 24 Midnight Mountain | 25 Grand Final |

- The times are the validation bot's run, which is also the **target ghost**. A first-time player is a little slower.
  The exact times, lengths and cars are in [`LEVEL_REPORT.md`](LEVEL_REPORT.md). A test (`tests/campaign.test.ts`)
  keeps the five-fifteen-five split.
- **Car switches on every track.** Each track changes car at least once; the five marathons use three or more cars
  (the Grand Final uses all four); several tracks switch and then switch back (Hill Climb, Harvest Run, Switchback
  Pass, Avalanche Alley, Glacier Run, Canyon Run, Oasis Highway, Skyline Stunts, Midnight Mountain).
- Each track is built to use the road well: straights for speed, zigzags (chains of chicanes), hairpins, banked turns,
  climbs and descents, rollers, jumps, wall turns and tilted wall rides, loops and spirals.
- The old training tracks, the four-tier campaign and the unlock rules are removed. The track of the day remains.

## Time, not medals

- No medals, stars, points or unlocks. Each track has a **personal best** and a **target time**; the select screens
  show both, and the PB turns green when it beats the target.
- The finish panel shows your time, the delta to your PB and to the target, and a split table with a delta at every
  checkpoint.
- The Records screen lists every timed track with its best, the target and the difference, plus buttons to watch
  your run, the target ghost, or race it again.
- Old saves still import: records are plain times, so nothing is lost. The `unlockAll` and colour-blind-medal
  settings are gone.

## HUD and ghosts

- **Live gap to the ghost** above the clock (blue = ahead, red = behind), measured along the road at your speed.
- **Minimap**: the driving line coloured by the car used on each stretch, with checkpoints, gates and the finish, and
  a dot each for you, your PB ghost and the target ghost.
- **Car chip and next gate**: the car you are in, and "Rally car gate 120 m" as a gate approaches. Passing a gate
  flashes the new car in its colour.
- **Ghosts** are lit holograms: each part keeps its own brightness (body light, tyres dark), they fade near the
  camera, and a small PB / TARGET tag floats above them. PB and target ghosts follow every car switch.
- The race HUD, touch layout and replay bar were updated to match; the minimap and board shrink on phones.

## Cars

The stadium, rally, snow and desert cars now have more drive force and power (0-100 km/h in about 2.0 s for the
stadium and desert cars, 2.5 s for the others), a faster steering slew, and quicker keyboard steering and pedal
ramps. `PHYSICS_VERSION` is `p7.0`.

## Building blocks

New blocks: `hairpinL/R` (180 degrees, radius 32), `bankChicaneL/R` (banked S-bends) and `spiralUpL/R` (climbing
spirals). `scripts/levels/` holds the definitions.

## The validation bot

The bot that drives and validates every track learned to cope with multi-car tracks:

- each car has its own pace (`CAR_SPEED_CAP`) and steering style (`CAR_STYLE`), scaled by the style it is run in;
- it carries at most 50 m/s into a jump and no more than 60 m/s through a banked wall section;
- it does not steer in the air.

`scripts/levels/` also has `try.mts` (build, lint and drive layouts without writing anything), `debug.mts`,
`styles.mts`, `plan.mts` (the cell and heading of every block) and a bot-trace overlay in `scripts/track-map.mts`.

## Autumn

The sunset world became Autumn: red, orange and gold foliage, olive grass and golden light. Older level files that say
`sunset`, `autumn`, `summer` or `winter` still resolve to a world.

## Checks

- `npm test`: 114 tests, including the campaign structure (25 tracks, five worlds, the time bands, car switches).
- `npm run levels` rebuilds every track, ghost and the report. Any change to physics, blocks or the bot means
  rebuilding all levels.
- `scripts/phase4-test.mjs`: the menu, race, finish, replay, ghost and save flow in a real browser.
