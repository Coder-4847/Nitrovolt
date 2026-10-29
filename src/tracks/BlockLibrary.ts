import { EffectId, SurfaceId } from '../physics/Surface';
import { RoadOpts, TrackBuilder, WallSide } from './TrackBuilder';
import { CELL } from './TrackSchema';

export type BlockCategory = 'straight' | 'gameplay' | 'curve' | 'bank' | 'chicane' | 'slope' | 'jump' | 'platform' | 'special' | 'spiral' | 'scenery';

export interface BlockOptions {
  width: number;
  surface: SurfaceId;
  effect: EffectId | undefined;
  walls: WallSide;
}

export interface BlockDef {
  id: string;
  label: string;
  category: BlockCategory;
  /** Part of the driving line (has a grid-aligned entry and exit). Scenery is not. */
  chain: boolean;
  /** Walls used unless the level overrides them. */
  walls: WallSide;
  /** Fixed-width pieces ignore the wide / narrow variants. */
  fixedWidth?: number;
  build(t: TrackBuilder, o: BlockOptions): void;
}

const ro = (o: BlockOptions, extra: RoadOpts = {}): RoadOpts => ({ width: o.width, surface: o.surface, effect: o.effect, walls: o.walls, ...extra });

// Gantry tints (start / checkpoint / finish / lap, then the four car gates). The renderer draws its own
// arches there and hides the gantry boxes by these exact values, so scenery blocks use different tints.
export const GANTRY_TINTS = [0x28ff7a, 0x18e0ff, 0xff3b2f, 0xffd21f, 0xff3a14, 0x20c0ff, 0xff8020, 0x80e0ff, 0xffd060];
const GREEN = 0x28ff7a;
const CYAN = 0x18e0ff;
const RED = 0xff3b2f;
const GOLD = 0xffd21f;
/** Car-gate tint per car id (matches GANTRY_TINTS[5..8]). */
export const GATE_TINT: Record<string, number> = { volt: 0x20c0ff, gravel: 0xff8020, frost: 0x80e0ff, dune: 0xffd060 };

type BuildFn = BlockDef['build'];
const defs: BlockDef[] = [];
const add = (id: string, label: string, category: BlockCategory, build: BuildFn, extra: Partial<BlockDef> = {}): void => {
  defs.push({ id, label, category, chain: category !== 'scenery', walls: 'none', build, ...extra });
};

// One cell is 32 m and one level 8 m; every block below is sized so its exit lands back on the grid.

// ---------------------------------------------------------------- straights
add('straight1', 'Straight 1', 'straight', (t, o) => t.straight(CELL, ro(o)));
add('straight2', 'Straight 2', 'straight', (t, o) => t.straight(CELL * 2, ro(o)));
add('straight4', 'Straight 4', 'straight', (t, o) => t.straight(CELL * 4, ro(o)));

// ---------------------------------------------------------------- gameplay lines
add('start', 'Start', 'gameplay', (t, o) => {
  const r = ro(o);
  t.straight(8, r);
  t.setSpawn();
  t.straight(12, r);
  t.gantry(o.width, GREEN);
  t.straight(12, r);
});
const lineBlock = (kind: 'checkpoint' | 'finish', tint: number): BuildFn => (t, o) => {
  const r = ro(o);
  t.straight(CELL / 2, r);
  t.trigger(kind, o.width);
  t.gantry(o.width, tint);
  t.straight(CELL / 2, r);
};
add('checkpoint', 'Checkpoint', 'gameplay', lineBlock('checkpoint', CYAN));
add('finish', 'Finish', 'gameplay', lineBlock('finish', RED));
add('lapFinish', 'Lap line (start/finish)', 'gameplay', (t, o) => {
  const r = ro(o);
  t.straight(8, r);
  t.setSpawn();
  t.straight(8, r);
  t.trigger('finish', o.width);
  t.gantry(o.width, GOLD);
  t.straight(16, r);
});
// car gates: drive through and the next section is driven with another car
for (const [car, label] of [['volt', 'Stadium'], ['gravel', 'Rally'], ['frost', 'Snow'], ['dune', 'Desert']] as const) {
  add(`gate${car[0]!.toUpperCase()}${car.slice(1)}`, `${label} car gate`, 'gameplay', (t, o) => {
    const r = ro(o);
    t.straight(CELL / 2, r);
    t.trigger('car', o.width, undefined, car);
    t.gantry(o.width, GATE_TINT[car]!);
    t.straight(CELL / 2, r);
  });
}

// ---------------------------------------------------------------- curves (R = 16, 48, 80 keep the exit on the grid)
for (const [n, R] of [[1, 16], [2, 48], [3, 80]] as const) {
  add(`curve${n}L`, `Curve ${n} left`, 'curve', (t, o) => t.arc(R, 90, 0, ro(o)));
  add(`curve${n}R`, `Curve ${n} right`, 'curve', (t, o) => t.arc(R, -90, 0, ro(o)));
}
// banked turns roll about their inner edge: the inside stays on the ground, the outside rises
for (const [n, R] of [[2, 48], [3, 80]] as const) {
  add(`bank${n}L`, `Banked curve ${n} left`, 'bank', (t, o) => t.arc(R, 90, 28, ro(o), true), { walls: 'both' });
  add(`bank${n}R`, `Banked curve ${n} right`, 'bank', (t, o) => t.arc(R, -90, 28, ro(o), true), { walls: 'both' });
}
// wall turns: the road climbs onto a near-vertical wall through the middle of the turn (speed holds you on it)
// (the roll eases in over half the turn: a car cannot roll onto a wall much faster than that)
add('wallTurnL', 'Wall turn left (U)', 'special', (t, o) => t.arc(48, 180, 78, ro(o, { step: 1.5 }), true, 0.5), { walls: 'both' });
add('wallTurnR', 'Wall turn right (U)', 'special', (t, o) => t.arc(48, -180, 78, ro(o, { step: 1.5 }), true, 0.5), { walls: 'both' });
add('wallTurn90L', 'Wall turn left', 'special', (t, o) => t.arc(80, 90, 72, ro(o, { step: 1.5 }), true, 0.5), { walls: 'both' });
add('wallTurn90R', 'Wall turn right', 'special', (t, o) => t.arc(80, -90, 72, ro(o, { step: 1.5 }), true, 0.5), { walls: 'both' });

// ---------------------------------------------------------------- chicanes (S-shifts)
/** tan(theta/2) = shift / forward-ish: R = 80 gives 3 cells x 1 cell and 4 cells x 2 cells exactly. */
const chicane = (dir: 1 | -1, angle: number): BuildFn => (t, o) => {
  t.arc(80, dir * angle, 0, ro(o));
  t.arc(80, -dir * angle, 0, ro(o));
};
const A1 = (Math.atan(1 / 3) * 2 * 180) / Math.PI; // 36.87 deg: 96 m forward, 32 m sideways
const A2 = (Math.atan(1 / 2) * 2 * 180) / Math.PI; // 53.13 deg: 128 m forward, 64 m sideways
add('chicaneL', 'Chicane left', 'chicane', chicane(1, A1));
add('chicaneR', 'Chicane right', 'chicane', chicane(-1, A1));
add('chicaneWideL', 'Wide chicane left', 'chicane', chicane(1, A2));
add('chicaneWideR', 'Wide chicane right', 'chicane', chicane(-1, A2));

// banked S-bends: both turns lean into the corner, the road levels out between them
add('bankChicaneL', 'Banked chicane left', 'chicane', (t, o) => {
  t.arc(80, A1, 26, ro(o), true, 0.4);
  t.arc(80, -A1, 26, ro(o), true, 0.4);
}, { walls: 'both' });
add('bankChicaneR', 'Banked chicane right', 'chicane', (t, o) => {
  t.arc(80, -A1, 26, ro(o), true, 0.4);
  t.arc(80, A1, 26, ro(o), true, 0.4);
}, { walls: 'both' });

// hairpins: a 180 degree U-turn of radius 32 that ends two cells to the side
add('hairpinL', 'Hairpin left', 'curve', (t, o) => t.arc(32, 180, 0, ro(o)));
add('hairpinR', 'Hairpin right', 'curve', (t, o) => t.arc(32, -180, 0, ro(o)));

// ---------------------------------------------------------------- slopes (rise is whole levels of 8 m)
add('slopeUp1', 'Slope up 1', 'slope', (t, o) => t.slope(CELL, 8, 24, 2, ro(o)));
add('slopeDown1', 'Slope down 1', 'slope', (t, o) => t.slope(CELL, -8, 24, 2, ro(o)));
add('slopeUp2', 'Slope up 2', 'slope', (t, o) => t.slope(CELL * 2, 16, 60, 2, ro(o)));
add('slopeDown2', 'Slope down 2', 'slope', (t, o) => t.slope(CELL * 2, -16, 60, 2, ro(o)));
add('steepUp', 'Steep climb', 'slope', (t, o) => t.slope(CELL * 2, 32, 32, 2, ro(o)));
add('steepDown', 'Steep descent', 'slope', (t, o) => t.slope(CELL * 2, -32, 32, 2, ro(o)));

// ---------------------------------------------------------------- jumps: ramps leave pitched up, landings enter pitched down
// Jump ramps are shallow (lips of about 5, 9 and 10 degrees) so flight grows gently with speed and a landing
// sized for the approach speed still catches a flat-out run. They end below the grid level above them; the
// chain layout treats that level as their exit (a gap always follows a ramp). The big ramp (about 16
// degrees) throws a car high and far over a ravine.
add('kicker', 'Kicker', 'jump', (t, o) => t.slope(CELL * 2, 4.4, 280, 1, ro(o)));
add('jumpRamp', 'Jump ramp', 'jump', (t, o) => t.slope(CELL, 4.0, 80, 1, ro(o)));
add('jumpRampLong', 'Long jump ramp', 'jump', (t, o) => {
  t.straight(CELL / 2, ro(o));
  t.slope(CELL * 1.5, 7.2, 72, 1, ro(o));
});
add('jumpRampBig', 'Big ramp', 'jump', (t, o) => {
  t.straight(CELL / 2, ro(o));
  t.slope(CELL * 1.5, 7.6, 130, 1, ro(o));
});
// Landings are S-curves: they start level (no edge to clip), steepen to meet the falling car, and round out
// flat at the bottom, so a car comes down on the slope across a wide band of speeds.
add('landing1', 'Landing', 'jump', (t, o) => t.slope(CELL, -8, 32, 2, ro(o)));
add('landingLong', 'Long landing', 'jump', (t, o) => t.slope(CELL * 2, -16, 64, 2, ro(o)));
add('landingXL', 'Extra-long landing', 'jump', (t, o) => t.slope(CELL * 3, -16, 120, 2, ro(o)));

// ---------------------------------------------------------------- platforms
add('platform', 'Platform', 'platform', (t, o) => t.straight(CELL, ro(o, { width: 32, thickness: 1.5 })), { fixedWidth: 32 });
add('platformBig', 'Big platform', 'platform', (t, o) => t.straight(CELL * 3, ro(o, { width: 96, thickness: 1.5, step: 12 })), { fixedWidth: 96 });

// ---------------------------------------------------------------- special geometry
add('loop', 'Loop', 'special', (t, o) => {
  const r = ro(o, { walls: 'both', wallHeight: 1.0 });
  t.straight(CELL, r);
  t.loop(24, CELL, { ...r, special: true });
  t.straight(CELL, r);
}, { walls: 'both' });
add('halfpipe2', 'Half-pipe', 'special', (t, o) => t.halfpipe(CELL * 2, 16, 150, ro(o)), { fixedWidth: 32 });
add('wallRide4L', 'Tilted straight left', 'special', (t, o) => t.straightBanked(CELL * 4, -45, ro(o, { walls: 'both', wallHeight: 2.6 }), 0.42, true), { walls: 'both' });
add('wallRide4R', 'Tilted straight right', 'special', (t, o) => t.straightBanked(CELL * 4, 45, ro(o, { walls: 'both', wallHeight: 2.6 }), 0.42, true), { walls: 'both' });
add('spiralDownL', 'Spiral descent left', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(48, 360, 16, 22, { ...r, special: true });
  t.straight(CELL, r);
}, { walls: 'both' });
add('spiralDownR', 'Spiral descent right', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(48, -360, 16, 22, { ...r, special: true });
  t.straight(CELL, r);
}, { walls: 'both' });
add('spiralUpL', 'Spiral climb left', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(48, 360, -16, 22, { ...r, special: true });
  t.straight(CELL, r);
}, { walls: 'both' });
add('spiralUpR', 'Spiral climb right', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(48, -360, -16, 22, { ...r, special: true });
  t.straight(CELL, r);
}, { walls: 'both' });

// ---------------------------------------------------------------- scenery (not part of the driving line)
add('pylon', 'Pylon', 'scenery', (t) => {
  t.decoBox(CELL / 2, 0, 0, 2.4, 38, 2.4, 0x18e0fe);
  t.decoBox(CELL / 2, 0, 38, 5, 1.4, 5, 0xffffff);
});
add('arch', 'Arch', 'scenery', (t) => {
  t.decoBox(CELL / 2, -16, 0, 2, 16, 2, 0xff3b2e);
  t.decoBox(CELL / 2, 16, 0, 2, 16, 2, 0xff3b2e);
  t.decoBox(CELL / 2, 0, 15, 34, 2, 2, 0xff3b2e);
});
add('tower', 'Tower', 'scenery', (t) => {
  t.decoBox(CELL / 2, 0, 0, 9, 60, 9, 0x2a3350);
  t.decoBox(CELL / 2, 0, 57, 10, 3, 10, 0xff8a1f);
});

export const BLOCKS: Readonly<Record<string, BlockDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const BLOCK_IDS: readonly string[] = defs.map((d) => d.id);
export const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_IDS);
