# NITROVOLT

A browser time-attack racer: instant restarts, short punchy tracks, ghosts, medals, jumps and a built-in level editor.
Everything is generated in code, with no external assets. It is an original game and not affiliated with any other racing title.

**Status:** Phase 6 of 8 complete: a full 100-level campaign (4 seasons x 25) of hand-made and generated levels, every one validated by the bot with a verified author ghost; see [`docs/LEVEL_REPORT.md`](docs/LEVEL_REPORT.md). Phase notes: [`docs/PHASE_1.md`](docs/PHASE_1.md), [`docs/PHASE_2.md`](docs/PHASE_2.md), [`docs/PHASE_3.md`](docs/PHASE_3.md), [`docs/PHASE_4.md`](docs/PHASE_4.md), [`docs/PHASE_5.md`](docs/PHASE_5.md), [`docs/PHASE_6.md`](docs/PHASE_6.md).

## Run

```bash
npm install
npm run dev        # dev server
npm test           # deterministic-core unit tests
npm run build      # typecheck + static build in dist/
npm run campaign   # regenerate + validate the 100 campaign levels and docs/LEVEL_REPORT.md
```

The game opens on the main menu. Levels can also be started directly with `?level=sprint01 | gravel01 | frost01 | dune01 | circuit01 | boostlab | stunt01`. Each level declares its car (Volt, Gravel, Frost, Dune).
Dev flags: `?debug=1` (tuning panel + debug HUD), `?track=flat|greybox`, `?car=<id>`, `?autodrive=1`, `?quality=low|medium|high|ultra`.

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
