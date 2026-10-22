# NITROVOLT

A browser time-attack racer: instant restarts, short punchy tracks, ghosts, medals, jumps and a built-in level editor.
Everything is generated in code, with no external assets. It is an original game and not affiliated with any other racing title.

**Status:** Phase 2 of 8 complete (block-based tracks from JSON, countdown / checkpoints / laps / ms timing, special blocks, splits HUD). See [`docs/PHASE_1.md`](docs/PHASE_1.md) and [`docs/PHASE_2.md`](docs/PHASE_2.md).

## Run

```bash
npm install
npm run dev        # dev server
npm test           # deterministic-core unit tests
npm run build      # typecheck + static build in dist/
```

Levels: `?level=sprint01 | circuit01 | boostlab | stunt01` (also switchable in the menu).
Dev flags: `?debug=1` (tuning panel + debug HUD), `?track=flat|greybox`, `?autodrive=1`.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Accelerate / brake-reverse | W S / Up Down | RT / LT | GAS / BRAKE |
| Steer | A D / Left Right (or mouse, `M`) | Left stick, D-pad | arrows or tilt |
| Restart | Enter | Start | RESTART |
| Respawn | Backspace | Y | RESPAWN |
| Camera | C | A | camera button |
| Menu / remap | Esc / P | Back | menu button |

## Deploy

`.github/workflows/pages.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist/` to GitHub Pages on pushes to `main`
(enable *Settings > Pages > Source: GitHub Actions*).
