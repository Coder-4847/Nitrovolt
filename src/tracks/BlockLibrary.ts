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

// Gantry tints (start / checkpoint / finish / lap). The renderer draws its own arches there and hides the
// gantry boxes by these exact values, so scenery blocks use nearby but different tints.
export const GANTRY_TINTS = [0x28ff7a, 0x18e0ff, 0xff3b2f, 0xffd21f, 0xff3a14];
const GREEN = 0x28ff7a;
const CYAN = 0x18e0ff;
const RED = 0xff3b2f;
const GOLD = 0xffd21f;

type BuildFn = BlockDef['build'];
const defs: BlockDef[] = [];
const add = (id: string, label: string, category: BlockCategory, build: BuildFn, extra: Partial<BlockDef> = {}): void => {
  defs.push({ id, label, category, chain: category !== 'scenery', walls: 'none', build, ...extra });
};

// ---------------------------------------------------------------- straights
add('straight1', 'Straight 1', 'straight', (t, o) => t.straight(CELL, ro(o)));
add('straight2', 'Straight 2', 'straight', (t, o) => t.straight(CELL * 2, ro(o)));
add('straight4', 'Straight 4', 'straight', (t, o) => t.straight(CELL * 4, ro(o)));

// ---------------------------------------------------------------- gameplay lines
add('start', 'Start', 'gameplay', (t, o) => {
  const r = ro(o);
  t.straight(4, r);
  t.setSpawn();
  t.straight(6, r);
  t.gantry(o.width, GREEN);
  t.straight(6, r);
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
  t.straight(4, r);
  t.setSpawn();
  t.straight(4, r);
  t.trigger('finish', o.width);
  t.gantry(o.width, GOLD);
  t.straight(8, r);
});

// ---------------------------------------------------------------- curves (R = 8, 24, 40 keep the exit on the grid)
for (const [n, R] of [[1, 8], [2, 24], [3, 40]] as const) {
  add(`curve${n}L`, `Curve ${n} left`, 'curve', (t, o) => t.arc(R, 90, 0, ro(o)));
  add(`curve${n}R`, `Curve ${n} right`, 'curve', (t, o) => t.arc(R, -90, 0, ro(o)));
}
for (const [n, R] of [[2, 24], [3, 40]] as const) {
  add(`bank${n}L`, `Banked curve ${n} left`, 'bank', (t, o) => t.arc(R, 90, 30, ro(o)), { walls: 'both' });
  add(`bank${n}R`, `Banked curve ${n} right`, 'bank', (t, o) => t.arc(R, -90, 30, ro(o)), { walls: 'both' });
}

// ---------------------------------------------------------------- chicanes (S-shifts)
/** tan(theta/2) = shift / forward-ish: R = 40 gives 3 cells x 1 cell and 4 cells x 2 cells exactly. */
const chicane = (dir: 1 | -1, angle: number): BuildFn => (t, o) => {
  t.arc(40, dir * angle, 0, ro(o));
  t.arc(40, -dir * angle, 0, ro(o));
};
const A1 = (Math.atan(1 / 3) * 2 * 180) / Math.PI; // 36.87 deg: 48 m forward, 16 m sideways
const A2 = (Math.atan(1 / 2) * 2 * 180) / Math.PI; // 53.13 deg: 64 m forward, 32 m sideways
add('chicaneL', 'Chicane left', 'chicane', chicane(1, A1));
add('chicaneR', 'Chicane right', 'chicane', chicane(-1, A1));
add('chicaneWideL', 'Wide chicane left', 'chicane', chicane(1, A2));
add('chicaneWideR', 'Wide chicane right', 'chicane', chicane(-1, A2));

// ---------------------------------------------------------------- slopes (rise is whole levels of 4 m)
add('slopeUp1', 'Slope up 1', 'slope', (t, o) => t.slope(CELL, 4, 12, 2, ro(o)));
add('slopeDown1', 'Slope down 1', 'slope', (t, o) => t.slope(CELL, -4, 12, 2, ro(o)));
add('slopeUp2', 'Slope up 2', 'slope', (t, o) => t.slope(CELL * 2, 8, 30, 2, ro(o)));
add('slopeDown2', 'Slope down 2', 'slope', (t, o) => t.slope(CELL * 2, -8, 30, 2, ro(o)));
add('steepUp', 'Steep climb', 'slope', (t, o) => t.slope(CELL * 2, 16, 16, 2, ro(o)));
add('steepDown', 'Steep descent', 'slope', (t, o) => t.slope(CELL * 2, -16, 16, 2, ro(o)));

// ---------------------------------------------------------------- jumps: ramps leave pitched up, landings enter pitched down
// Jump ramps are shallow (lips of about 5, 9 and 12 degrees) so flight grows gently with speed and a landing
// sized for the approach speed still catches a flat-out run; the generator picks the flattest one that
// clears the gap. They end below the grid level above them; the chain layout treats that level as their
// exit (a gap always follows a ramp).
add('kicker', 'Kicker', 'jump', (t, o) => t.slope(CELL * 2, 2.2, 140, 1, ro(o)));
add('jumpRamp', 'Jump ramp', 'jump', (t, o) => t.slope(CELL, 2.0, 40, 1, ro(o)));
add('jumpRampLong', 'Long jump ramp', 'jump', (t, o) => {
  t.straight(CELL / 2, ro(o));
  t.slope(CELL * 1.5, 3.6, 36, 1, ro(o));
});
// Landings are S-curves: they start level (no edge to clip), steepen to meet the falling car, and round out
// flat at the bottom, so a car comes down on the slope across a wide band of speeds.
add('landing1', 'Landing', 'jump', (t, o) => t.slope(CELL, -4, 16, 2, ro(o)));
add('landingLong', 'Long landing', 'jump', (t, o) => t.slope(CELL * 2, -8, 32, 2, ro(o)));
add('landingXL', 'Extra-long landing', 'jump', (t, o) => t.slope(CELL * 3, -8, 60, 2, ro(o)));

// ---------------------------------------------------------------- platforms
add('platform', 'Platform', 'platform', (t, o) => t.straight(CELL, ro(o, { width: 32, thickness: 1.5 })), { fixedWidth: 32 });
add('platformBig', 'Big platform', 'platform', (t, o) => t.straight(CELL * 3, ro(o, { width: 48, thickness: 1.5, step: 12 })), { fixedWidth: 48 });

// ---------------------------------------------------------------- special geometry
add('loop', 'Loop', 'special', (t, o) => {
  const r = ro(o, { walls: 'both', wallHeight: 1.0 });
  t.straight(CELL, r);
  t.loop(24, CELL, r);
  t.straight(CELL, r);
}, { walls: 'both' });
add('halfpipe2', 'Half-pipe', 'special', (t, o) => t.halfpipe(CELL * 2, 8.5, 150, ro(o)), { fixedWidth: 16 });
add('wallRide4L', 'Wall-ride left', 'special', (t, o) => t.straightBanked(CELL * 4, -45, ro(o, { walls: 'both', wallHeight: 2.6 }), 0.42), { walls: 'both' });
add('wallRide4R', 'Wall-ride right', 'special', (t, o) => t.straightBanked(CELL * 4, 45, ro(o, { walls: 'both', wallHeight: 2.6 }), 0.42), { walls: 'both' });
add('spiralDownL', 'Spiral descent left', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(24, 360, 12, 24, r);
  t.straight(CELL, r);
}, { walls: 'both' });
add('spiralDownR', 'Spiral descent right', 'spiral', (t, o) => {
  const r = ro(o, { walls: 'both' });
  t.spiral(24, -360, 12, 24, r);
  t.straight(CELL, r);
}, { walls: 'both' });

// ---------------------------------------------------------------- scenery (not part of the driving line)
add('pylon', 'Pylon', 'scenery', (t) => {
  t.decoBox(CELL / 2, 0, 0, 1.6, 26, 1.6, 0x18e0fe);
  t.decoBox(CELL / 2, 0, 26, 3.4, 1.0, 3.4, 0xffffff);
});
add('arch', 'Arch', 'scenery', (t) => {
  t.decoBox(CELL / 2, -9, 0, 1.4, 12, 1.4, 0xff3b2e);
  t.decoBox(CELL / 2, 9, 0, 1.4, 12, 1.4, 0xff3b2e);
  t.decoBox(CELL / 2, 0, 11.4, 20, 1.4, 1.4, 0xff3b2e);
});
add('tower', 'Tower', 'scenery', (t) => {
  t.decoBox(CELL / 2, 0, 0, 6, 40, 6, 0x2a3350);
  t.decoBox(CELL / 2, 0, 38, 7, 2, 7, 0xff8a1f);
});

export const BLOCKS: Readonly<Record<string, BlockDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const BLOCK_IDS: readonly string[] = defs.map((d) => d.id);
export const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_IDS);
