# Release Checklist

Run through this for every public build. Automated items have a command; manual items need a real
device. "Pass" = works as described with no console errors.

## 1. Automated (any machine)

| Check | Command | Pass when |
| --- | --- | --- |
| Types | `npm run typecheck` | no errors |
| Unit + integration tests | `npm test` (`FULL=1 npm test` before a release: drives all 100 levels) | all green |
| Production build | `npm run build` | builds; no chunk over 800 kB except `rapier-*.wasm` |
| Campaign still valid | `npm run campaign` (only if physics, blocks or levels changed) | 100 levels, all ghosts exact; review `docs/LEVEL_REPORT.md` diff |
| Sub-path build + PWA + offline + determinism | `BASE_PATH=/Nitrovolt/ npm run build && BASE_PATH=/Nitrovolt/ npx vite preview --port 4173 --host 127.0.0.1 &` then `node scripts/deploy-test.mjs` | all PASS (menu, manifest + icons, service worker in control, race online and offline, bot reproduces the Sprint 01 author time to the millisecond) |
| Menus / ghosts / replays | dev server + `node scripts/phase4-test.mjs` | all PASS |
| Editor | dev server + `node scripts/p7-editor.mjs`, `node scripts/p7-mobile.mjs` | all PASS |
| Input + touch | dev server + `node scripts/input-test.mjs`, `node scripts/mobile-test.mjs` | as printed |
| Visual spot check | dev server + `node scripts/p5-shots.mjs high` | screenshots look right for all four themes |

If physics changed: bump `PHYSICS_VERSION` in `src/physics/Simulation.ts`, run `npm run campaign`, and
note in the release notes that personal-best ghosts from older versions play back in snapshot mode.

## 2. Manual: desktop

- [ ] Chrome, Firefox, Safari (latest): menu -> campaign -> play Sprint 01 -> finish -> medal -> replay -> exit.
- [ ] Keyboard only: navigate every menu with arrows / Enter / Esc; remap a key and use it.
- [ ] Gamepad (Xbox and PlayStation layouts): drive, Start restarts, Y respawns, D-pad / A / B in menus, remap a button, rumble on a landing.
- [ ] Mouse steering (M).
- [ ] 60 fps on a mid-range laptop at the Auto preset (F3 shows fps, preset, render scale, draw calls).
- [ ] Audio: music in menus and races per theme, music / engine / effects sliders, pause muffles the music, turbo whistle, gear clicks.
- [ ] Ghosts: PB ghost appears after a PB; G cycles PB / author / both / off.
- [ ] Editor: build, test drive, keep author time, bot validate, share link opened in another browser.
- [ ] Settings > Data: export, clear site data, import: records, settings, ghosts and player tracks come back.
- [ ] Settings > Accessibility: HUD size, colour-blind medals, reduced motion, unlock all.

## 3. Manual: mobile

- [ ] Android Chrome and iOS Safari, phone and tablet, landscape (portrait shows the rotate hint).
- [ ] Touch controls: steer, gas, brake, restart, respawn, camera, menu; tilt steering (iOS asks permission).
- [ ] Vibration on landings (Android) and the Settings toggle turning it off.
- [ ] Fullscreen from the pause menu; the screen stays awake during a race.
- [ ] Switching apps pauses the race; coming back resumes from the pause menu.
- [ ] Install: "Add to Home Screen" / install prompt; the icon looks right (maskable on Android); it opens fullscreen in landscape.
- [ ] Offline: open the installed app in airplane mode, play a campaign level and a player track.
- [ ] Auto quality picks Low or Medium and holds a playable frame rate.

## 4. Deploy (GitHub Pages)

1. Repository settings > Pages > Source: **GitHub Actions** (once).
2. Merge to `main` (or run the workflow manually: Actions > Deploy to GitHub Pages > Run workflow). The workflow runs `npm ci`, `npm test`, and `npm run build` with `BASE_PATH=/<repo>/`, then publishes `dist/`.
3. Open `https://<owner>.github.io/<repo>/`, check the version in About, hard-reload once: the update bar ("A new version is ready") appears for returning players.
4. Smoke test the live URL: `URL=https://<owner>.github.io/<repo>/ node scripts/deploy-test.mjs` (the offline part needs the page to have loaded once).

Custom domain / root deploy: set `BASE_PATH=/` in the workflow.

## 5. Versioning

- `package.json` `version` is shown in About and is part of the service-worker cache name.
- Bump it for every public release; write the notes in the GitHub release.

## 6. Known issues for this release (1.0.0)

- Gamepad, tilt and haptics were implemented to spec but not verified on physical hardware during development (only in headless browsers).
- Frame rate was not profiled on real GPUs; the Auto preset and dynamic resolution may need tuning per device class.
- Ghosts recorded in one browser engine can play back in snapshot mode in another (last-bit maths differences).
- Generated campaign layouts lean straight-heavy (see `docs/PHASE_6.md`); the editor makes remixing easy.
- The editor has no multi-select / copy-paste of block groups, and no gamepad control.
