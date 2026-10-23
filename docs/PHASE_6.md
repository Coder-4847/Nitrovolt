# Phase 6 — The 100-Level Campaign

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| Level generator | `src/tracks/LevelGenerator.ts` | Seeded random walk over the block grid, one **phrase** at a time (straight run, corner, chicane, hill, jump, boost pad, special pad, set piece, checkpoint). Rules it enforces: the track never crosses or touches itself; boost pads only lead into straights, climbs or jumps (no corner until the boost and a braking run are over); every corner gets a **braking straight** sized from the expected speed and the surface; jumps get a bounded approach (a corner scrubs speed when the road before is fast), a gap sized from **measured flight distances** (cleared even 15 % slower than expected) and an in-line run-out; crests and landings at speed get straight road until the car is settled; set pieces get what they need (turbo2 run-up before a loop, height before a spiral, grip for wall-rides). Backtracks when it boxes itself in. Pure and deterministic. |
| Lap circuits | `generateCircuit` | Closed rectangles of four banked or sweeping corners whose sides are solved so the loop closes exactly on its lap line, with one feature per long side (pad, chicane pair or hill). 2 laps in seasons 1-2, 3 laps later. |
| Grid footprint | `src/tracks/Footprint.ts` | Each block's columns and height band, measured once from a scratch build; `Occupancy` rejects any block within ~10 m vertically of an earlier block in the same column, or sitting right beside a much earlier block at a similar height (that would let players hop across and skip track). |
| Campaign plan | `src/tracks/CampaignPlan.ts` | Per slot: car, theme, main ground and patches, which special pads and set pieces are unlocked yet, jump frequency, length, checkpoint count, road widths, hairpins, laps. Difficulty rises through the campaign and through each season. Season 1: Volt only, tarmac, mechanics introduced one by one (cruise from 11, half-pipe 9, wall-ride 13, fragile 15, loop 17, spiral 21). Season 2: mostly Frost on snow and ice, Volt on cleared roads; no-brake, no-steer, slow-mo. Season 3: mostly Dune on sand, Gravel on dirt, wider roads, more and bigger jumps; low gravity and reactor. Season 4: all four cars, longest tracks, engine-off and every set piece. |
| Validation bot | `src/tracks/Validate.ts` | Drives a level with the path bot (car-aware) and fails it on any respawn (fell off, flipped), getting stuck, or running out of time; tries three driving styles from the car's natural pace to careful. Collects top / average speed, air time, jumps, hard landings, wall hits and surface shares. The successful run is recorded as a ghost, then **re-simulated to verify it is exact**. In `src/` so the Phase 7 editor can validate player levels in the browser. |
| Campaign build | `scripts/make-campaign.ts` (`npm run campaign`) | Keeps the 7 hand-made levels in their slots (re-validated), generates the other 93: up to 80 seeds per slot (relaxing length and jump frequency after 25 failures); accepts a level only if the bot finishes cleanly inside the season's time window (18-50 s, 24-70 s, 26-80 s, 30-95 s), does not keep hitting walls and is not mostly airborne. Writes `src/data/levels/<id>.json`, the author ghosts, `src/data/campaign.json` (slot placement), `src/data/level-meta.json` and **`docs/LEVEL_REPORT.md`**. `ONLY=s2-05,s3-11 npm run campaign` remakes just those slots. Deterministic: the same code produces the same 100 levels. |
| Medal times | `MEDAL_FACTORS` | Author = the bot's time (its ghost proves it is reachable). Gold / silver / bronze = author x 1.10 / 1.25 / 1.50 in season 1, tightening to 1.06 / 1.14 / 1.30 in season 4. Hand-made levels use the same margins. |
| Names | `src/tracks/LevelNames.ts` | Deterministic, unique, themed per season ("Glitch Rush", "Powder Switchback", "Sidewinder Loop", "Turbine Causeway"). |
| Data loading | `src/data/index.ts`, `campaign.ts` | Every file in `src/data/levels/` is loaded (eager glob) and ordered by `campaign.json`; author ghosts stay lazy chunks (2-30 KB each, 1.9 MB total on disk, fetched only when shown). |
| Menus | `App.ts`, `LevelSelectScreen.ts` | Thumbnails are built a few per frame slot and skipped once their card is gone; behind a full-screen list the 3D backdrop refreshes at 10 fps so a 25-card season fills quickly. |
| Dev tools | `scripts/gen-try.ts`, `gen-sweep.ts`, `jump-lab.ts`, `p6-campaign.mjs` | Try seeds for one slot (with the block where a failed run left the road), success rate per season, flight distance per car / ramp / speed, campaign map screenshots. |
| Tests | `tests/generator.test.ts`, updated others | 142 total. Generator determinism; layouts in every season are valid, never overlap, keep corners away from pads and run-outs after landings; circuits close; flight interpolation. The campaign has 100 distinct valid levels in the right slots, unique names, the season's theme, Volt-only season 1, mixed cars in season 4, medal margins and time windows respected. Every level has a current author ghost (fingerprint check); full bot drives and exact ghost replays run on a sample (all 7 hand-made + every 8th generated; `FULL=1 npm test` runs all 100). |

## Results (from `docs/LEVEL_REPORT.md`)

- 100 levels, all validated, all 100 author ghosts verified exact. 93 generated with 258 seeds in total (2.8 per slot).
- Rejected candidates: 155 fell off or flipped, 5 too long, 3 boxed in, 1 too short, 1 too slow.
- Cars: Volt 44, Frost 21, Dune 18, Gravel 17. Lap levels: 9.
- Average author time 26 s (season 1), 47 s, 45 s, 47 s (season 4); average length 970 m to 1335 m.
- Specials used across the campaign: turbo 23 levels, cruise 24, fragile 13, turbo2 12, no-brake 11, no-steer 9, slow-mo 8, low gravity 6, reactor 4, engine-off 4. Set pieces: jumps 63 levels, platforms 8, half-pipes 7, spirals 4, loops 3, wall-rides 3.

## How to test

```bash
npm test                    # 142 tests (FULL=1 npm test drives all 100 levels)
npm run campaign            # rebuild all 100 levels + report (~2-10 min); deterministic
npx tsx scripts/gen-try.ts 2 7     # seeds for season 3 slot 8, with failure locations
npx tsx scripts/jump-lab.ts        # flight distances behind the jump sizing
npm run dev                 # Campaign: four full seasons; Free Play lists all 100
```

In the game: Settings > Accessibility > *Unlock every level* to browse everything; each level's Leaderboard row has an **Author** replay (the validation run).

## Design decisions

- **Phrases, not single blocks.** Pieces that belong together (a pad and its straight, a jump with run-up and run-out, a corner and its braking zone) are placed as one unit, so the design rules hold by construction and the bot only has to confirm them.
- **The bot is the judge, physics is the ruler.** The generator's speed model is deliberately rough; it gets the layout close, the validation bot decides. Jump gaps come from flight distances measured in the real physics (`scripts/jump-lab.ts`) instead of guesses, which took jump failures from the main rejection reason to rare.
- **Author = bot time.** The author ghost demonstrates every Author medal. The bot is a careful driver (it brakes early, never cuts corners, lifts in slides), so a good human should beat it; Gold and below have season-scaled margins on top.
- **Rejected, not repaired.** A level that fails is thrown away and the next seed tried; about one candidate in three is valid. Cheap (under a second per candidate) and keeps the generator simple.
- **Slot-stable, deterministic output.** Each slot's seeds come from its position, so regenerating after a change only moves levels the change affects, and `ONLY=` remakes single slots.
- **Hand-made levels keep their slots** (first level of each season, plus Ring Road, Boost Lab and Stunt Park in season 1) and are re-validated by the same pipeline.

## Known issues / not yet done

- Layouts lean straight-heavy: braking zones, boost run-outs and jump run-outs add straight road, and corner pieces are all 90 degrees. Variety in shape is the most obvious thing to improve (more corner angles, S-bends, elevation changes in corners); the editor (Phase 7) will make hand-polishing easy.
- The bot often needed its careful styles on loose ground (style 2-3 in the report), which makes those Author times comparatively generous; a smarter bot (racing lines, trail braking) would set tighter authors.
- Difficulty is shaped by rules (length, specials, jumps, widths) and verified only for finishability, not measured against humans.
- No themed scenery set pieces or decorative blocks are placed by the generator (scenery comes from the Phase 5 scenery planner).
- Wall-ride and loop set pieces are rare (Volt only, need long run-ups).
- The test runner caches transformed modules by content, so after the level files change, `node_modules/.vitest-cache` must be cleared (`npm run campaign` does it).
