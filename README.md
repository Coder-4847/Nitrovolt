# NITROVOLT

A browser time-attack racer: instant restarts, short punchy tracks, ghosts, medals, jumps and a built-in level editor.
Everything is generated in code, with no external assets. It is an original game and not affiliated with any other racing title.

**Status:** Phase 3 of 8 complete (four cars with distinct handling, per-surface tyre model, car-specific models / camera / particles / audio, a test track per car, livery picker). See [`docs/PHASE_1.md`](docs/PHASE_1.md), [`docs/PHASE_2.md`](docs/PHASE_2.md), [`docs/PHASE_3.md`](docs/PHASE_3.md).

## Run

```bash
npm install
npm run dev        # dev server
npm test           # deterministic-core unit tests
npm run build      # typecheck + static build in dist/
```

Levels: `?level=sprint01 | gravel01 | frost01 | dune01 | circuit01 | boostlab | stunt01` (also switchable in the menu). Each level declares its car (Volt, Gravel, Frost, Dune).
Dev flags: `?debug=1` (tuning panel + debug HUD), `?track=flat|greybox`, `?car=<id>`, `?autodrive=1`.

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
