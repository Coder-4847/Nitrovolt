# Phase 7 — Track Editor

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| Editor model | `src/editor/EditorModel.ts` | The document is the same level JSON the game loads (single source of truth). A grid cursor (cell, height, heading) and a **brush** (block, width, surface or special pad, walls). Tools: **place, paint** (apply width / surface / walls to a block), **erase, pick** (eyedropper). **Chain mode**: after placing a track piece the cursor jumps to its exit, so a track is built by picking pieces one after another. One start (placing another moves it), lap line sets laps to 2. Undo / redo (200 steps). Building area +-120 cells, +-40 levels, 1500 blocks. Pure and unit-tested. |
| Checks | `src/editor/Checks.ts` | Schema, start / finish / lap rules, and a **walk along the driving line** from the start through every block's exit (after a jump ramp it searches up to 6 cells ahead and 4 levels down for the landing) to see whether the finish is reachable. Reports where the line breaks, pieces facing the wrong way, pieces not on the line, overlapping pairs and missing checkpoints. Shown live in the side panel; unreachable and overlapping blocks are outlined in the scene. |
| 3D editing | `EditorSession.ts`, `EditorView.ts`, `EditorCamera.ts` | Runs inside the game renderer with the level's theme (scenery off for speed and clarity). Build grid at the cursor height, translucent **preview** of the next block (green = fits, red = overlaps), cursor arrow, outlines of the hovered block per tool. Camera: drag to orbit, right-drag / Shift-drag / two fingers to pan, wheel / pinch to zoom, WASD to move, top view (T), frame track (F). Height with Q / E (or Alt+wheel, or the buttons). |
| UI | `EditorSession.ts`, `BlockIcons.ts`, styles | Tool bar; block palette in six groups with **icons generated from each block's geometry** (driving line from above, coloured by height, exit arrow); block properties (width, surface incl. every special pad, walls); track settings (name, car, theme, laps); checks and author status; help line. Panels fold on small screens. |
| Keyboard | | 1-4 tools · R / Shift+R rotate · Q / E height · Space / Enter place at the cursor · arrows move the cursor (relative to the view) · [ ] previous / next block in the group · Delete erase · C chain · T top · F frame · G test drive · Ctrl+Z / Ctrl+Y undo / redo · Ctrl+S save · Esc editor menu. A track can be built with the keyboard alone. |
| Touch | | Tap a cell to move the cursor there, tap it again to act; one finger orbits, two fingers pan and zoom; all tools are buttons. |
| Test drive | `App.testDrive` | **G** or the button drives the current draft instantly (normal race with countdown, ghosts, HUD). The pause menu becomes *Resume / Restart / Back to the editor*; the finish panel offers **Keep as author time** (your own run becomes the author ghost, like validating by driving) and *Back to editor*. The editor comes back with the same camera and undo history. |
| Validation | `Validate.ts` (`yieldEvery`), `EditorSession.validate` | **Validate (bot)** lets the Phase 6 validation bot drive the track in the browser (yielding every 300 ticks so the page stays responsive, with progress and Cancel). Success sets the author ghost and medal times (gold / silver / bronze = author x 1.08 / 1.20 / 1.42); failure says why and moves the camera to where the bot left the road. An author run only counts while it matches the current layout (fingerprint), so editing a validated track un-validates it until it is driven again. |
| My tracks | `src/editor/UserLevels.ts`, `MyLevelsScreen.ts` | Main menu > **Track editor**. Tracks live in IndexedDB (memory fallback) and **autosave** while you edit. Per track: Play, Edit, Share, Export, Copy, Delete (two-step); new track, **copy a campaign track** to remix it, import a file, paste a code. Records of a player track are keyed by id + layout, so an edited track starts a fresh personal best; ghosts of an older layout are not shown. |
| Sharing | `src/editor/ShareCode.ts`, `ShareScreen.ts` | A share link is `…/#track=` + base64url(deflate-raw(level JSON)) (a 15-block track is ~430 characters; JSON fallback where compression streams are missing). Opening the link anywhere adds the track to My tracks and starts it. Everything that comes in (links, codes, files) is validated: schema, block types, building-area bounds, block count, lap count, name length. |
| Export / import | | `.nitrovolt.json` files (the plain level format, readable and diffable). |
| Tests | `tests/editor.test.ts` | 9 new (151 total): chain placement matches the authoring tool's layout exactly; undo / redo / erase / paint / pick; block lookup by cell and single start; cursor rotation and height; campaign levels pass the checks (jumps followed across their gaps, run-outs after the finish included); broken lines, unreachable pieces and overlaps are reported; share codes round-trip compactly and reject junk and out-of-bounds levels; the bot validates a track built through the editor model and records its ghost. |
| Browser checks | `scripts/p7-editor.mjs`, `p7-mobile.mjs` | New track → 13 pieces placed through the palette and Space → checks say drivable → undo / redo → a mouse click places a block → rename → bot validation (author time) → test drive → Esc → back to the editor with the same track → share link → My tracks shows it validated → the link opens the track in a fresh browser profile. Mobile: tap-tap placement on 844x390. |

## How to test

```bash
npm run dev     # Main menu > Track editor > New track
npm test        # 151 tests
npx vite --port 5173 --host 127.0.0.1 & node scripts/p7-editor.mjs   # the full editor walk-through
```

Quick tour: New track → pick *Straight 2*, press Space a few times → *Curves* → *Curve 2 right* → Space → *Start / CP* → *Finish* → Space. The checks turn green. **G** drives it; finish and press *Keep as author time*, or press *Validate (bot)*. Esc > *Share link* copies a link that opens the track for anyone.

## Design decisions

- **The editor edits the real level format.** No separate editor representation: what you save is exactly what the campaign uses, so editor tracks get the same physics, ghosts, records, themes and thumbnails, and campaign tracks can be copied and remixed.
- **Chain mode by default.** Grid racers are built piece after piece; jumping the cursor to the exit (with the right heading and height) makes building feel like laying track rather than aiming at cells. The mouse takes over again as soon as it really moves.
- **Validation means "someone finished it".** Like the genre's convention, an author time comes from a real finish: either the bot's (which also proves the bot can drive it) or your own test drive. The ghost is stored, so the author medal is always demonstrable.
- **Checks are advisory, errors block driving.** Overlaps and loose pieces are warnings (they can be deliberate); a missing start / finish or a broken line stops the test drive with a clear reason.
- **Share links carry the whole track.** No server is needed (the game is a static site); deflate keeps typical tracks to a few hundred characters. Author ghosts are not included, so a shared track is re-validated by whoever wants medals on it.

## Known issues / not yet done

- No multi-select, copy / paste of block groups, or move tool yet (pick + erase + place covers it, slowly).
- Scenery decoration blocks (pylon, arch, tower) are the only decorative pieces; the Phase 5 scenery appears when the track is driven but not in the editor.
- The editor is mouse / keyboard first; touch works (tap-tap placement, pinch, panels fold) but is cramped on small phones.
- No gamepad control in the editor.
- The bot validator can fail tracks a human can drive (huge jumps, very tight technical sections); use *Keep as author time* for those.
- Share links of very large tracks (hundreds of blocks) get long (several KB); there is no URL-shortening server.
- Player tracks are local to the browser (export / share to move them; the Phase 4 save file does not include them yet).
