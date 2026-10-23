import { B, LevelDef, cp, finish, gate, jump, lap, road, start, turbo } from './dsl';

// surfaces (snow and ice get barriers: slippery roads are walled)
const D = { s: 'dirt' } as const;
const DW = { s: 'dirt', w: 'both' } as const;
const G = { s: 'grass' } as const;
const SN = { s: 'snow', w: 'both' } as const;
const IC = { s: 'ice', w: 'both' } as const;
const SA = { s: 'sand' } as const;
const W = { w: 'both' } as const;
const N = { v: 'narrow', w: 'both' } as const;
const WD = { v: 'wide' } as const;
const fx = (s: 'turbo' | 'turbo2' | 'reactor' | 'noSteer' | 'noBrake' | 'cruise' | 'fragile' | 'slowMo' | 'engineOff' | 'gravity') => ({ s });

/** The campaign: 5 tiers x 5 tracks, White (first laps) to Black (everything at once). */
export const CAMPAIGN_DEFS: LevelDef[] = [
  // ---------------------------------------------------------------- White
  {
    id: 'c01', name: 'Opening Lap', theme: 'forest', car: 'volt', tier: 0,
    blurb: 'A flowing first lap: one jump, one banked turn, full throttle.',
    items: [
      start(), ...road(5), B('curve3R'), ...road(3), ...jump('jumpRamp', 1), ...road(2), cp(), ...road(1), B('curve3L'), ...road(2),
      B('slopeUp2'), ...road(2), B('bank3L'), ...road(2), ...turbo(4), finish(), ...road(1),
    ],
  },
  {
    id: 'c02', name: 'Pine Run', theme: 'snow', car: 'frost', tier: 0,
    blurb: 'Through the pines on packed snow. Brake early, the snow car is heavy.',
    items: [
      start(SN), ...road(4, SN), B('curve3L', SN), ...road(2, SN), B('chicaneR', SN), ...road(2, SN), cp(SN), ...road(1, SN),
      ...jump('kicker', 1, SN), ...road(1, SN), B('bank3R', SN), ...road(3, SN), B('curve2R', SN), ...road(3, SN), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c03', name: 'Red Dust', theme: 'desert', car: 'dune', tier: 0,
    blurb: 'Wide sand, long sweepers and a big jump over the ravine.',
    items: [
      start(SA), ...road(4, SA), B('curve3R', SA), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(2, SA), cp(SA),
      B('curve3L', SA), ...road(1, SA), B('slopeUp2', SA), ...road(2, SA), B('chicaneWideL', SA), ...road(2, SA), ...jump('kicker', 1, SA), ...road(1, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 'c04', name: 'Golden Hour', theme: 'sunset', car: 'volt', tier: 0,
    blurb: 'Your first wall turn at sunset. Commit and keep it pinned.',
    items: [
      start(), ...road(5), B('chicaneR'), ...road(2), B('wallTurnL'), ...road(3), cp(), ...road(1), B('curve2R'), ...road(2), B('curve2L'),
      ...road(2), ...turbo(3), B('bank3L'), ...road(3), finish(), ...road(1),
    ],
  },
  {
    id: 'c05', name: 'Rally Woods', theme: 'forest', car: 'gravel', tier: 0,
    blurb: 'Gravel road through the woods. Slide it, do not fight it.',
    items: [
      start(D), ...road(3, D), B('curve2R', D), ...road(1, D), B('curve2L', D), ...road(2, D), cp(D), ...road(1, D), ...jump('kicker', 1, D),
      ...road(1, D), B('chicaneL', D), ...road(1, G), B('curve3R', G), ...road(2, D), B('curve2R', D), ...road(3, D), finish(D), ...road(1, D),
    ],
  },
  // ---------------------------------------------------------------- Green
  {
    id: 'c06', name: 'Loop Lane', theme: 'night', car: 'volt', tier: 1,
    blurb: 'Under the floodlights: a loop, a wall and a loop again.',
    items: [
      start(), ...turbo(4), B('loop'), ...road(3), B('wallTurnR'), ...road(1), B('slopeUp2'), ...road(1), cp(), ...road(1), B('curve3R'), ...road(2),
      B('curve3R'), ...turbo(3), B('loop'), ...road(3), finish(), ...road(1),
    ],
  },
  {
    id: 'c07', name: 'Two Faces', theme: 'forest', car: 'volt', tier: 1,
    blurb: 'Stadium car on tarmac, rally car through the dirt, and back.',
    items: [
      start(), ...road(5), B('curve3L'), ...road(2), gate('gravel', D), ...road(2, D), B('curve2R', D), ...road(1, D), B('chicaneL', D), cp(D),
      ...road(2, D), ...jump('kicker', 1, D), ...road(1, D), B('curve2R', D), ...road(1, D), gate('volt'), ...road(3), B('bank3R'), ...turbo(3), finish(), ...road(1),
    ],
  },
  {
    id: 'c08', name: 'Ice Lake', theme: 'snow', car: 'frost', tier: 1,
    blurb: 'Glide across the frozen lake. On ice, less steering is more.',
    items: [
      start(SN), ...road(3, SN), B('curve3R', SN), ...road(3, IC), B('curve3L', IC), ...road(2, SN), cp(SN), ...road(1, SN),
      B('bank3L', SN), ...road(2, SN), ...road(3, IC), B('curve3R', IC), ...road(3, SN), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c09', name: 'Mesa Hop', theme: 'desert', car: 'dune', tier: 1,
    blurb: 'Three ravines in a row and a climb between them.',
    items: [
      start(SA), ...road(5, SA), ...jump('jumpRamp', 1, SA), ...road(1, SA), B('slopeUp2', SA), ...road(2, SA), ...jump('jumpRampLong', 1, SA), ...road(1, SA), cp(SA),
      B('curve3L', SA), ...road(2, SA), B('slopeUp2', SA), ...road(2, SA), ...jump('jumpRampBig', 2, SA), ...road(2, SA), B('curve3R', SA), ...road(2, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 'c10', name: 'Halfpipe', theme: 'sunset', car: 'volt', tier: 1,
    blurb: 'Drop into the half-pipe, then tip over onto the tilted straight.',
    items: [
      start(), ...road(4), B('halfpipe2'), ...road(2), B('curve3R'), ...road(2), cp(), ...road(1), B('wallRide4L'), ...road(1),
      B('curve3L'), ...road(2), ...turbo(2, {}, 'turbo2'), ...jump('jumpRamp', 1), ...road(2), B('wallTurn90R'), ...road(2), finish(), ...road(1),
    ],
  },
  // ---------------------------------------------------------------- Blue
  {
    id: 'c11', name: 'Snow Patrol', theme: 'snow', car: 'volt', tier: 2,
    blurb: 'Stadium car to the snow gate, snow car over the pass, stadium car home.',
    items: [
      start(), ...road(4), B('wallTurn90R'), ...road(2), gate('frost', SN), ...road(2, SN), B('curve2L', SN), ...road(1, SN), B('slopeUp2', SN), cp(SN),
      B('bank3L', SN), ...road(1, SN), ...road(2, IC), B('slopeDown2', SN), ...road(1, SN), gate('volt'), ...road(3), B('wallTurnR'), ...road(4), finish(), ...road(1),
    ],
  },
  {
    id: 'c12', name: 'Spiral', theme: 'forest', car: 'volt', tier: 2,
    blurb: 'Climb to the top of the hill, then corkscrew back down.',
    items: [
      start(), ...road(3), B('slopeUp2'), ...road(2), B('steepUp'), ...road(1), B('curve3R'), ...road(2), cp(), ...road(1), B('spiralDownL'),
      ...road(2), ...jump('jumpRamp', 1), ...road(1), B('curve3R'), ...road(2), B('slopeDown2'), ...turbo(3), finish(), ...road(1),
    ],
  },
  {
    id: 'c13', name: 'Sand Rally', theme: 'desert', car: 'dune', tier: 2,
    blurb: 'Desert car on the dunes, rally car through the canyon dirt.',
    items: [
      start(SA), ...road(4, SA), ...jump('kicker', 1, SA), ...road(1, SA), B('curve3L', SA), ...road(1, SA), gate('gravel', D), ...road(2, D), B('curve2R', D),
      ...road(1, D), B('chicaneR', D), cp(D), ...road(1, D), B('curve2L', D), ...road(1, D), gate('dune', SA), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(2, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 'c14', name: 'Night Shift', theme: 'night', car: 'volt', tier: 2,
    blurb: 'Reactor boost, cruise control and a wall turn under the lights.',
    items: [
      start(), ...road(3), B('straight1', fx('reactor')), ...road(3), B('wallTurnL'), ...road(2), B('straight2', fx('cruise')), ...road(1), B('curve3R'), cp(),
      ...road(2), B('loop'), ...road(2), B('curve2R'), ...road(2), B('straight1', fx('noSteer')), ...road(1), ...jump('jumpRamp', 1), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c15', name: 'Four Seasons', theme: 'sunset', car: 'volt', tier: 2,
    blurb: 'Stadium, rally, snow, desert: one track, four cars.',
    items: [
      start(), ...road(4), B('curve3R'), ...road(1), gate('gravel', D), ...road(2, D), B('curve2L', D), ...road(1, D), cp(D),
      gate('frost', SN), ...road(2, SN), B('curve3L', SN), ...road(1, SN), gate('dune', SA), ...road(2, SA), ...jump('kicker', 1, SA), ...road(1, SA), cp(SA),
      B('curve3R', SA), gate('volt'), ...road(3), B('wallTurnR'), ...road(3), finish(), ...road(1),
    ],
  },
  // ---------------------------------------------------------------- Red
  {
    id: 'c16', name: 'Skyline', theme: 'night', car: 'volt', tier: 3,
    blurb: 'Narrow road high above the field. No-steer pads before the jumps.',
    items: [
      start(), ...road(2), B('slopeUp2'), B('slopeUp2'), ...road(2, N), B('curve3L', N), ...road(1, N), B('straight1', { ...N, s: 'noSteer' }), ...jump('jumpRamp', 1, N), ...road(1, N), cp(N),
      B('curve3R', N), ...road(2, N), ...jump('jumpRampLong', 1, N), ...road(1, N), B('bank3R'), ...road(2), B('wallTurnL'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c17', name: 'Avalanche', theme: 'snow', car: 'frost', tier: 3,
    blurb: 'Down the mountain on ice, rally car through the slush, snow car to finish.',
    items: [
      start(SN), ...road(2, SN), B('steepUp', SN), ...road(1, SN), B('curve3R', SN), ...road(1, SN), B('spiralDownR', SN), ...road(1, IC), B('curve3L', IC), cp(SN),
      gate('gravel', DW), ...road(2, DW), B('chicaneL', DW), ...road(2, DW), B('slopeDown2', DW), gate('frost', SN), ...road(2, SN), B('bank3L', SN), ...road(2, IC), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c18', name: 'Mirage', theme: 'desert', car: 'dune', tier: 3,
    blurb: 'Big air on sand, then the stadium car and two wall turns.',
    items: [
      start(SA), ...road(5, SA), ...jump('jumpRampBig', 2, SA), ...road(3, SA), B('curve3L', SA), ...road(1, SA), B('slopeUp2', SA), ...road(2, SA), cp(SA),
      gate('volt'), ...road(3), B('wallTurnL'), ...road(3), B('wallTurn90R'), ...road(2), ...turbo(2), ...jump('jumpRamp', 1), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c19', name: 'Corkscrew', theme: 'forest', car: 'volt', tier: 3,
    blurb: 'Loop, tilt, loop, wall. And a slow-motion pad where you least want it.',
    items: [
      start(), ...turbo(3), B('loop'), ...road(1), B('wallRide4R'), ...road(1), B('curve3L'), cp(), ...road(1), B('straight1', fx('slowMo')), ...road(1),
      B('wallTurnR'), ...road(2), ...turbo(2, {}, 'turbo2'), B('loop'), ...road(2), B('curve3R'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c20', name: 'Endurance', theme: 'sunset', car: 'volt', tier: 3, laps: 2,
    blurb: 'Two laps: tarmac, a rally sector through the trees, tarmac again.',
    // a closed oval: opposite sides are the same length (4 and 5 cells) between four curve3R-sized corners
    items: [
      lap(), ...road(3), B('curve3R'),
      gate('gravel', D), B('slopeUp2', D), cp(D), ...road(1, D), B('curve3R', D),
      ...road(2, D), gate('volt'), ...road(1), B('curve3R'),
      B('slopeDown2'), ...road(1), cp(), ...road(1), B('bank3R'),
    ],
  },
  // ---------------------------------------------------------------- Black
  {
    id: 'c21', name: 'Gauntlet', theme: 'night', car: 'volt', tier: 4,
    blurb: 'Every pad in the book between two wall turns and a loop.',
    items: [
      start(), ...road(2), B('straight1', fx('turbo2')), ...road(2), B('straight1', fx('engineOff')), ...road(1), B('wallTurnL'), ...road(1), B('straight1', fx('reactor')), ...road(2),
      cp(), B('curve3R'), ...road(1), B('straight2', fx('fragile')), ...road(1), B('loop'), ...road(1), B('straight1', fx('noBrake')), ...road(1), B('wallTurnR'),
      ...road(1), cp(), B('straight1', fx('gravity')), ...jump('jumpRamp', 1), ...road(1), B('curve3L'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c22', name: 'Whiteout', theme: 'snow', car: 'frost', tier: 4,
    blurb: 'Narrow ice lanes, a frozen spiral and the engine cut on the climb.',
    items: [
      start(SN), ...road(3, IC), B('curve3R', IC), ...road(1, SN), B('slopeUp2', SN), B('straight1', { ...SN, s: 'engineOff' }), ...road(1, SN), B('curve3L', SN), cp(SN),
      ...road(1, SN), B('spiralDownL', SN), ...road(2, IC), gate('gravel', DW), ...road(2, DW), B('curve2R', DW), ...road(1, DW), gate('frost', SN), ...jump('kicker', 1, SN), ...road(1, SN),
      B('bank3R', SN), ...road(2, IC), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c23', name: 'Sandstorm', theme: 'desert', car: 'dune', tier: 4,
    blurb: 'Huge jumps on sand, then the stadium car over the last ravine.',
    items: [
      start(SA), ...road(5, SA), ...jump('jumpRampBig', 2, SA), ...road(1, SA), B('curve3R', SA), ...road(1, SA), B('slopeUp2', SA), ...road(2, SA), ...jump('jumpRampLong', 1, SA), ...road(1, SA), cp(SA),
      B('curve3L', SA), ...road(1, SA), B('slopeUp2', SA), B('slopeUp2', SA), gate('volt'), ...road(3), B('wallTurnL'), ...road(4), ...jump('jumpRampBig', 2), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c24', name: 'Vortex', theme: 'sunset', car: 'volt', tier: 4,
    blurb: 'Wall, loop, spiral, wall: the stadium car at full stretch.',
    items: [
      start(), ...road(2), B('slopeUp2'), ...road(2), B('wallTurn90L'), ...road(1), B('loop'), ...road(1), B('wallTurnR'), ...road(1), cp(), B('spiralDownL'),
      ...road(1), ...turbo(2, {}, 'turbo2'), B('loop'), ...road(1), B('wallTurn90R'), ...road(2), B('halfpipe2'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c25', name: 'Grand Final', theme: 'forest', car: 'volt', tier: 4,
    blurb: 'The whole game in one run: four cars, walls, loops and the big ravine.',
    items: [
      start(), ...road(4), B('wallTurnL'), ...road(2), ...jump('jumpRamp', 1), ...road(1), cp(), gate('gravel', D), ...road(2, D), B('curve2R', D), ...road(1, D), B('chicaneL', D),
      ...road(1, D), gate('frost', SN), ...road(1, SN), B('bank3R', SN), ...road(2, IC), cp(SN), gate('dune', SA), ...road(2, SA), ...jump('kicker', 1, SA), ...road(1, SA), B('curve3L', SA),
      gate('volt'), ...road(2, WD), B('slopeUp2'), ...road(1), B('loop'), ...road(2), cp(), ...road(1), ...jump('jumpRampBig', 2), ...road(2), finish(), ...road(1),
    ],
  },
];
