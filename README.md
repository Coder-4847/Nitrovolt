# NITROVOLT

A browser time-attack racer: instant restarts, short punchy tracks, ghosts, medals, jumps and a built-in level editor.
Everything is generated in code, with no external assets. It is an original game and not affiliated with any other racing title.

**Status:** Phase 4 of 8 complete (main menu, 4x25 campaign with unlocks, medals, exact ghosts, replay viewer with free camera, local leaderboard, settings with accessibility, save export/import). See [`docs/PHASE_1.md`](docs/PHASE_1.md), [`docs/PHASE_2.md`](docs/PHASE_2.md), [`docs/PHASE_3.md`](docs/PHASE_3.md), [`docs/PHASE_4.md`](docs/PHASE_4.md).

## Run

```bash
npm install
npm run dev        # dev server
npm test           # deterministic-core unit tests
npm run build      # typecheck + static build in dist/
```

The game opens on the main menu. Levels can also be started directly with `?level=sprint01 | gravel01 | frost01 | dune01 | circuit01 | boostlab | stunt01`. Each level declares its car (Volt, Gravel, Frost, Dune).
Dev flags: `?debug=1` (tuning panel + debug HUD), `?track=flat|greybox`, `?car=<id>`, `?autodrive=1`.

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

`.github/workflows/pages.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist/` to GitHub Pages on pushes to `main`
(enable *Settings > Pages > Source: GitHub Actions*).
