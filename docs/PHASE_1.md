# Phase 1 — Foundation, Physics Core and Input

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| Project | `package.json`, `vite.config.ts`, `tsconfig.json`, `.github/workflows/pages.yml` | Vite + strict TS. `BASE_PATH` env sets Vite `base` (the workflow passes `/<repo>/`). Verified from a `/nitrovolt/` subpath. |
| Fixed loop | `src/core/FixedLoop.ts` | Exact 100 Hz physics, max 8 steps/frame (no spiral of death), render gets an interpolation alpha. |
| Determinism | `src/core/Rng.ts`, `InputFrame.ts`, `InputRecorder.ts` | Seeded mulberry32; quantised `InputFrame {steer, accel, brake, respawn}`; RLE binary recorder + player. |
| Input | `src/core/input/*`, `src/ui/TouchControls.ts`, `src/ui/SettingsMenu.ts` | Keyboard (analog-ramped steering), mouse steer toggle, Gamepad API (analog triggers, deadzone + response curve, rumble), touch zones / tilt, haptics. Remap UI for keyboard + gamepad in the menu (Esc). |
| Physics | `src/physics/*` | Rapier is used **only** for static trimesh ray queries and chassis-vs-track contacts. All vehicle dynamics are custom (see below). |
| Car | `src/physics/VehicleParams.ts` (`VOLT`) | Parameter set + `PARAM_DESCRIPTORS` for the tuning panel. |
| Track | `src/tracks/TrackBuilder.ts`, `MeshBuilder.ts`, `GreyboxTrack.ts`, `TestTracks.ts` | Turtle-based ribbon sweeps (straight, banked arc, pitch arc, gap, analytic loop). The same meshes feed rendering and Rapier colliders. |
| Rendering | `src/render/*` | Chase / far / hood cameras with speed FOV, landing shake, loop-aware roll following; procedural car; sky dome; shadows; speed streaks; quality presets (low to ultra, auto-detected). |
| UI | `src/ui/*` | Speed + run clock HUD, debug overlay (F3 / `?debug=1`), live tuning panel for every car parameter (`?debug=1`). |
| Audio | `src/audio/AudioEngine.ts` | Small WebAudio engine/tyre/wind/thud synth so speed *sounds* right while tuning (the full audio pass is Phase 8). |
| Tests | `tests/*` | 16 tests: RNG, input quantisation + recorder round-trip, bit-exact physics determinism (fresh worlds, same-world restart, recorded-input replay), sanity (ride height, 0-100, brake/reverse, no idle creep), path bot finishes the grey-box course. |

## How to test

```bash
npm install
npm run dev            # http://localhost:5173  (add ?debug=1 for the tuning panel + debug HUD)
npm test               # unit tests
npm run build          # typecheck + production build
```

URL flags (dev): `?debug=1` (tuning + debug HUD + `window.__nv`), `?track=flat` (huge flat pad), `?autodrive=1` (path bot drives; handy for demos and screenshots).

Default controls: **W/S/A/D or arrows**, **Enter** restart, **Backspace** respawn at last checkpoint, **C** camera (chase/far/hood), **M** mouse steering, **F3** debug HUD, **Esc/P** menu (graphics, audio, remapping).
Gamepad: RT/LT, left stick, Start = restart, Y = respawn, A = camera, D-pad steers; rumble on landings/impacts.
Touch: on-screen left/right, GAS, BRAKE, big RESTART + RESPAWN, tilt toggle, landscape hint.

What to try on the grey-box course (you start on a 200 m flat pad, so free-drive there first):
1. Full-throttle launch, flick the steering at 100/200/300 km/h, brake-tap into a drift and counter-steer.
2. Leave the pad: banked curve, gap jump, dirt, ice, chicane, vertical loop, mega jump.
3. Open the tuning panel and drag *grip*, *slide ratio*, *downforce*, *spring K* live.
4. Hold throttle over a jump: the nose follows the flight path (see design notes).

Dev tools in `scripts/` (run with `npx tsx scripts/<name>.ts`): `sim-lab.ts` (accel/brake/skidpad metrics), `steer-lab.ts` (step-steer response), `bot-run.ts` (path bot over the course). Browser smoke tests with the preinstalled Chromium: `shoot.mjs`, `overview.mjs`, `input-test.mjs`, `mobile-test.mjs` (they need `npm run dev` running).

## Vehicle model (one shared core)

Per tick (100 Hz), `Vehicle.step`:

1. **Steering**: speed-sensitive lock `steerMin + (steerMax - steerMin) / (1 + (v/ref)^2)`, slewed to the target. *Counter-steer assist* adds steering only once body slip passes the tyre's peak, so it does not fight normal cornering.
2. **Suspension**: one ray per wheel (against Rapier trimeshes) along the chassis' up axis; progressive spring, separate bump/rebound damping, bump stop, anti-roll bars. The spring load is the tyre's normal load.
3. **Tyres**: slip-angle lateral curve (peak, then fall-off to `slideRatio`), load-sensitive friction budget, per-surface grip multipliers, friction-envelope coupling with drive/brake (`ellipseExp`), brake-induced rear slide (`brakeRearSlide`), drive split front/rear, brake bias, rolling resistance, idle hold on slopes. Each wheel may only remove *its share* of the velocity in one tick; without that, four wheels overshoot and buzz (caught by the idle-creep test).
4. **Aero**: quadratic drag; downforce split front/rear (reduced in the air).
5. **Air control**: see design notes.
6. Forces and torques are summed and applied as one impulse pair; Rapier then steps (chassis box vs walls/ground, CCD on).

Measured with `scripts/sim-lab.ts` (Volt): 0-100 km/h 2.7 s, 0-200 km/h 5.5 s, limiter around 317 km/h, 290 to 0 km/h in 2.7 s / 108 m, peak cornering about 2.3 g' (g' = 19.6 m/s^2). A steering step reaches about 85 % of steady yaw in 0.12 s, with no oscillation on release.

## Design decisions (ambiguities resolved toward "fun / time-attack")

- **Units/axes**: SI units, +X right, +Y up, -Z forward. Gravity is 19.6 m/s^2 (2x) so jumps are punchy and nothing floats.
- **Restart = new chassis body.** Rebuilding the dynamic body on each restart/respawn (static colliders stay) makes a restart bit-identical to a fresh world (tested) and costs microseconds, so retry is instant.
- **Respawn is part of the input stream** (`InputFrame.respawn`), so ghosts replay it. Kill-plane respawns are derived from state and need no input.
- **Quantised input**: steer in 1/1024, pedals in 1/255, applied *before* the sim, so a live run and its replay see the same numbers.
- **Air control uses attitudes, not rates** (with `airLevelAssist` on, speed above 12 m/s): the nose tracks the flight path (gravity feed-forward), accel/brake offset it by up to `airPitchOffset` (about 23 degrees), steering yaws and banks up to `airRollOffset`, and the car self-levels in roll. A held key cannot spin you into a flip. Setting `airLevelAssist` to 0 gives free rate-based rotation (useful for a future trick mode). Found because the path bot flipped over on a jump while holding throttle and steer.
- **Pedals in the air command pitch** (accel = nose down, brake = nose up), so the bot (and players who want to) lift off in the air.
- **Keyboard steering is ramped** (attack slows with speed, faster on direction flips) and keyboard pedals ramp too, in the input layer, before recording.
- **Loop radius 30 m**: at 22 m the loop pulls more than 10 g' and slams the bump stops; 30 m is intense but clean.
- **Volt is deliberately very grippy and stable** (RWD with 30 % front drive, `ellipseExp` 3): hard throttle in a corner does not snap into a spin; drifts come from brake-taps and flicks and are catchable by counter-steer.

## Known issues / not yet done

- Gamepad, tilt steering and haptics are implemented but untested on real hardware (only keyboard, mouse and touch were exercised in headless Chromium). The tilt axis mapping per screen angle may need a flip on some devices.
- Cross-browser bit-exactness: my own maths uses `Math.sin/cos/atan2/pow`, whose last-ulp results can differ between JS engines; Rapier's WASM is deterministic. Same-browser ghosts are exact (tested); cross-browser ghosts get snapshot correction in Phase 4.
- The bundle is about 5 MB (1.8 MB gzip) because `rapier3d-compat` embeds its WASM; Phase 8 splits and lazy-loads it.
- No tyre smoke, skid marks, bloom or SSAO yet (Phase 5). No free/replay camera yet (Phase 4).
- Checkpoints are simple proximity markers used only for respawn; real checkpoint/finish logic, timer, countdown and special blocks arrive in Phase 2.
- Headless screenshots use software GL (about 5 fps), so frame rate was not profiled on real GPUs. Physics cost is about 0.1-0.2 ms per step.
- Only the Volt exists. Gravel, Frost and Dune and their per-car surface tables are Phase 3 (the surface table and `surfaceGrip` hooks are in place).
