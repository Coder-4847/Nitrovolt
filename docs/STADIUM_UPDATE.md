# 1.2.0: stadium arenas, new cars, accurate jumps, race HUD and landing page

Player feedback on 1.1.0: the look should match modern stadium time-attack racers (reference screenshots
of open-wheel cars in big arenas), all cars should be far more detailed, the UI needed a big step up with a
proper landing page, and jumps were inaccurate ("the ramps were ~50 m apart and I jumped ~125 m").

All artwork is original: the NITROVOLT wordmark, signage and liveries are drawn in code. No third-party
logos, brands or assets are copied.

## Jumps

**Cause.** Jump ramps had 19-21 degree lips (they had to rise a whole 4 m grid level within one cell). At
this game's gravity a 21 degree lip throws a car 85-110 m at 160-190 km/h, while the landings ended about
48 m after the lip. Even the validation bot flew past most landings.

**Fix.**
- Ramps are shallow: kicker 4.8 degrees, jump ramp 8.8, long ramp 9.8. Their lip sits below the grid level
  above them; the chain layout treats that level as the exit (a gap always follows a ramp).
- Landings are S-curves (level at the top, steepening, flat at the bottom) and there is a new three-cell
  **extra-long landing** (48 m, 8 m drop) that catches the whole band of flat-out speeds.
- The generator picks ramp and gap from re-measured flight tables (`scripts/jump-lab.ts`): the car must
  clear the gap 15 % slower than expected and, at the expected speed, come down on the landing. The
  speed model is calibrated to the bot's real lip speed.
- The validation bot now rejects a level if any ramp jump comes down beyond its landing.
- Hand-made levels re-laid where needed (Sprint 01 lost the turbo pad straight after its landing, which
  boosted cars into the chicane).
- All 100 levels regenerated and re-validated; author ghosts re-recorded (`PHYSICS_VERSION` p5.0, so old
  personal ghosts are retired; records are kept).

**Check.** `npx tsx scripts/jump-check.ts` drives every campaign jump with the throttle floored for the
last 30 m before the lip: **84 of 88 jumps land on the landing block** (was 13 of 90); the rest land on the
straight road just after it, one snow-car approach loses the car.

## Look

- **Arenas** (`src/render/env/Arena.ts`): every level sits in a stadium bowl: roofed grandstands with seat
  rows, aisles and a sparse crowd (procedural shader), an LED board running round the podium wall, flags
  waving along the roof, video screens on pylons and light towers. Seasons: **Summer**, **Winter** (snow
  on the stands, pines, mountains), **Canyon** (sand terraces, pines, cacti, mesas) and **Sunset**.
- **Arches** (`Arches.ts`) at the start, every checkpoint and the finish, with LED strips and START /
  CHECKPOINT / FINISH sign boards (replacing the plain gantry boxes).
- **Pillars** under raised road (`Pillars.ts`).
- **Road**: stadium tarmac, painted NITROVOLT / GRAND PRIX text along both edges, a painted start box and
  logo, white checkpoint lines and a chequered finish line; clay-coloured dirt; barriers carry LED ad
  strips that read the right way round on both sides.
- **Cars** (`src/render/cars/`): an open-wheel stadium racer (Volt), a rally hatch (Gravel), a caged snow
  buggy (Frost) and a desert trophy truck (Dune), all built from lofted bodies with livery artwork (paint,
  twin stripe, accent sweep, race number, carbon underside), wings, wishbones, cages, lamps, and a
  **digital speed display on the back** like a race car. Liveries still follow Settings > Garage.
- **Camera**: closer and lower chase cameras.

## UI

- **Landing page** (`src/ui/screens/LandingScreen.ts`): a full-screen hero over the live stadium with Play
  now / Main menu / Track editor, then features, the four cars with ratings, the four seasons with track
  thumbnails, controls and a footer. Esc goes to the main menu; Home on the menu brings it back.
- **Main menu**: logo and a stacked menu of slanted race-style items on the left, an "Up next" card with
  the next track, campaign progress and medals on the right.
- **Race HUD**: the big condensed clock at the bottom, a checkpoint split pop-up in the middle (blue box
  when ahead of your best, red when behind), a PB and next-medal board top-left, lap and checkpoint
  counters top-right, a compact speed readout.
- Fonts: Barlow Condensed (race font) and Inter, bundled through Fontsource (SIL Open Font License), so
  they work offline.

## How to test

- `npm test`, `npm run build`, then the browser checks in `docs/RELEASE_CHECKLIST.md`.
- `npx tsx scripts/jump-check.ts` for jump landings.
- `npm run dev`, open `/` (landing page), Play, and drive Sprint 01 flat out over the jump.

## Known issues

- The arena surrounds the whole level's bounding box, so long, thin levels get a long, thin bowl.
- The ground stays 12 m below the lowest road (a car that falls off must not land and drive on it), so
  ground-level road reads as raised and gets pillars.
- Everything is still tested in a software renderer only; please report the device and browser if
  anything looks wrong on real hardware.
