# Phase 4 — Menus, Campaign, Medals, Ghosts and Replays

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| App shell | `src/core/App.ts`, `RaceSession.ts`, `ReplaySession.ts` | Replaces the old `Game.ts`. `App` owns renderer, input, audio, HUD and the screen stack and switches between a menu backdrop, a **race session** and a **replay session**. Dev flags (`?level=`, `?track=flat\|greybox`, `?autodrive=1`, `?debug=1`) still jump straight into a race (no countdown for `track` / `autodrive`), and `window.__nv` keeps working for the scripts. |
| Screens | `src/ui/screens/*` | Main menu (Continue / Campaign / Free Play / Leaderboard / Settings), campaign map, free-play list, leaderboard, pause menu, settings. `ScreenManager` gives keyboard **and gamepad** navigation (arrows / D-pad / stick move focus spatially, Enter / A activates, Esc / B goes back; sliders and dropdowns use left/right). Touch works through normal taps; the on-screen driving controls hide while a menu is open. |
| Campaign | `src/data/campaign.ts` | 4 seasons x 25 = **100 slots** with progressive unlocks. A level opens when the previous one in its season has **Bronze**; a season opens when enough medal points were earned in earlier seasons (gates 0 / 25 % / 50 % / 75 % of the points that exist). Only the 7 built-in levels are placed so far (the rest show "Coming soon" and are filled by the Phase 6 generator; the rules already work for 100). The accessibility option *Unlock every level* skips the gates. |
| Level cards | `LevelSelectScreen`, `src/render/Thumbnail.ts` | Generated top-down thumbnail (surface colours, height shading, checkpoints), car, medal and PB time, lock reason ("Earn Bronze on Sprint 01"). Thumbnails are built one per idle slot so a 25-card page never stalls. |
| Medals | `src/core/Medals.ts`, `src/ui/medals.ts`, finish panel in `Hud.ts` | Author / Gold / Silver / Bronze per level, from the PB time. Each tier has its own **shape** (◆ ★ ● ■) so it never relies on colour. Earning a *higher tier than before* plays a pop-and-ring animation and a rising jingle (longer and brighter per tier); the panel also lists levels the finish **unlocked**. Best time, splits and date are saved in localStorage. |
| Finish panel | `Hud.showFinish` | Retry (Enter) · Next level (N) · Replay (V) · Menu (Esc), as buttons and keys. |
| Ghosts | `src/core/Ghost.ts`, `GhostStore.ts` | A ghost is the **input stream** (varint / zigzag delta codec, a few KB) plus a position snapshot every 0.5 s. It is replayed by re-simulating the inputs in a private physics world, so it matches the real run exactly; the snapshots verify that and are the fallback (Hermite interpolation) if the level or physics fingerprint differs or another browser's maths drifts. PB ghosts live in **IndexedDB** (memory fallback); **author ghosts** are recorded by the validation bot (`npm run levels`) and shipped as lazy chunks (2-27 KB each). Show PB / author / both / off in Settings or press **G**. Ghost cars are translucent unlit copies of the car (cyan PB, green author). |
| Determinism | `Simulation.restart`, `Run.ts` | Every restart runs **100 neutral pre-roll ticks** while the car settles on the grid; the countdown (instant / 1.2 s / 3 s) is UI-only. The state at GO is therefore identical whatever countdown you use, which is what makes ghosts and records comparable. The run clock counts ticks since GO. |
| Replay viewer | `ReplaySession.ts`, `src/render/ReplayCameras.ts` | Play / pause (K), speed 0.1x-4x ([ ]), skip ±3 s (J / L), restart (R), scrub bar (drag previews the recorded path, release re-simulates exactly), cameras **chase / far / hood / orbit / free** (V). Orbit: drag, wheel / pinch. Free: WASD + Q/E, Shift = fast, drag to look, wheel = speed. Replays your last run (from the finish panel), your PB or the author run (from the leaderboard). |
| Leaderboard | `LeaderboardScreen` | Local: every finished level with PB, medal, time to the next medal, date and Replay / Author / Race buttons; totals (levels finished, medal points, summed best times, medal counts). |
| Settings | `SettingsScreen`, `src/core/Settings.ts` | Tabs: **Gameplay** (countdown, ghosts), **Graphics** (quality, speed lines, FPS counter), **Audio** (master / engine / effects), **Controls** (mouse steering, gamepad dead zone and curve, full keyboard and gamepad remapping), **Garage** (paint and accent for each car), **Accessibility** (HUD size 0.8-1.6x, colour-blind medal palette, reduced motion, unlock all), **Data**. |
| Save file | `src/core/SaveFile.ts` | Export everything (all `nitrovolt.*` localStorage keys + PB ghosts) as one JSON file; import validates and replaces the save, then reloads. Erase-records button (two-step confirm). |
| Tests | `tests/ghost.test.ts`, `campaign.test.ts`, `save.test.ts`, `run.test.ts` | 100 total (was 68). Highlights: ghost replay is bit-exact for every car, across a respawn and through serialisation; stale fingerprints fall back to snapshots; the bundled author ghosts are valid and replay exactly; the countdown length cannot change the state at GO; campaign unlock rules; save round trip and rejection of bad files. |
| Browser checks | `scripts/phase4-test.mjs`, `scripts/p4-mobile.mjs` | Headless Chromium end-to-end: menu, campaign tabs and locks, countdown, pause, settings, bot finish (medal + unlocks), replay with all cameras and scrubbing, exit back to the finish panel, ghost shows **+0.000** splits against an identical run, keyboard navigation, leaderboard, export, wipe, import. Plus a 844x390 touch pass. |

## How to test

```bash
npm run dev        # http://localhost:5173  -> main menu
npm test           # 100 tests
npm run build
npx vite --port 5173 --host 127.0.0.1 &   # then:
node scripts/phase4-test.mjs               # end-to-end walk-through, screenshots in /tmp/claude-0/shots
npm run levels     # re-run the validation bot: rewrites level JSON, medal times and author ghosts
```

By hand:
1. **Continue** opens the first level you have not bronzed. Finish Sprint 01 under the Bronze time: Ring Road unlocks and the finish panel says so.
2. Beat your own PB: the medal animation plays only when the tier improves. Retry (Enter) and race your **cyan ghost**; press **G** to cycle PB / author / both / off.
3. On the finish panel press **V** for the replay; **V** again cycles cameras, drag the bar to scrub, **Esc** returns to the finish panel.
4. **Settings > Data > Export**, clear site data, **Import**: records, settings and ghosts come back.
5. Menus work with arrows + Enter + Esc, a gamepad (D-pad, A, B) or touch.

## Design decisions

- **Ghosts are inputs, not paths.** Replaying inputs costs a few KB per run instead of ~100 KB of positions, looks perfect (wheels, suspension, effects) and doubles as the replay viewer's data. Snapshots are the safety net, not the primary format.
- **Grid pre-roll instead of a physics countdown.** An earlier design recorded the countdown length with each ghost; a fixed pre-roll plus a UI-only countdown removes that whole class of mismatch and lets the player change the countdown freely.
- **Ghost versioning by fingerprint.** `PHYSICS_VERSION` + the car parameters and the level's blocks are hashed into every ghost; a retune or a level edit demotes old ghosts to snapshot playback instead of showing a wrong car. Bump `PHYSICS_VERSION` whenever simulated results change, then run `npm run levels` (a test fails if the bundled author ghosts stop replaying exactly).
- **Replay scrubbing re-simulates.** Seeking re-runs the inputs from the grid (about 0.2 s for a 25 s run); while dragging, the recorded snapshot path is shown instead so the bar stays responsive.
- **Replay keeps the race alive underneath** when opened from the finish panel, so Exit returns to the same finish screen (Retry still works).
- **Medal and unlock rules lean toward flow:** Bronze unlocks the next level (fast progress for newcomers), season gates are fractions of the points that exist, so they stay meaningful while only a few levels are built.
- **Medal times are still provisional** (bot time x 1.0 / 1.08 / 1.2 / 1.45); with the bot as the author, Author is a genuinely hard target. Phase 6 will derive them per level from the validation bot's report.

## Known issues / not yet done

- Only 7 of the 100 campaign slots hold a level (Phase 6). Season 2-4 gates therefore depend on few levels today.
- Gamepad menu navigation and rebinding are implemented but, like the rest of the pad support, untested on real hardware; likewise haptics.
- Cross-browser: a ghost recorded in one browser engine may fall back to snapshot playback in another (the maths functions can differ in the last bit); same-browser replays are exact. A snapshot-mode replay has no suspension / wheel animation.
- Replay events (checkpoint splits) after a seek are not rebuilt in the split list; scrubbing clears it.
- No online leaderboards or ghost sharing (the save file is the only way to move data between devices).
- The "Level select" in the pause menu leaves the race (no confirmation); the attempt in progress is lost.
- The bundle is still about 5 MB (Rapier's embedded WASM); splitting is a Phase 8 task. Ghost and thumbnail data are already lazy.
- Menu music and a dedicated menu soundtrack are Phase 8; menu sounds are simple synth blips.
