import { B, LevelDef, Opt, cp, finish, gate, jump, road, start, turbo } from './dsl';

// surfaces (snow and ice get barriers: slippery roads are walled)
const D = { s: 'dirt' } as const;
const G = { s: 'grass' } as const;
const SN = { s: 'snow', w: 'both' } as const;
const IC = { s: 'ice', w: 'both' } as const;
const SA = { s: 'sand' } as const;
const W = { w: 'both' } as const;
const NW = { v: 'narrow', w: 'both' } as const;
const DW = { s: 'dirt', w: 'both' } as const;
const WD = { v: 'wide' } as const;
const fx = (s: 'turbo' | 'turbo2' | 'reactor' | 'noSteer' | 'noBrake' | 'cruise' | 'fragile' | 'slowMo' | 'engineOff' | 'gravity') => ({ s });

/** n alternating chicanes (left first): a zigzag that keeps its heading. */
const zig = (n: number, o: Opt = {}, wide = false): ReturnType<typeof road> => Array.from({ length: n }, (_, i) => B(`chicane${wide ? 'Wide' : ''}${i % 2 ? 'R' : 'L'}`, o));

/** The campaign: five worlds of five tracks. Each world runs short, medium, medium, medium, long. */
export const CAMPAIGN_DEFS: LevelDef[] = [
  // ================================================================ SUMMER
  {
    id: 'c01', name: 'Green Valley', theme: 'forest', car: 'volt',
    blurb: 'A sweeping valley road, one jump over the stream, then dirt for the final stretch.',
    items: [
      start(), ...road(4), B('curve3R'), ...road(1), B('slopeUp1'), B('slopeDown1'), ...road(1), B('chicaneL'), ...road(3), ...jump('jumpRamp', 1), ...road(2), cp(),
      B('curve3L'), ...road(2), B('slopeUp2'), ...road(1), B('curve2R'), ...road(1), gate('gravel', D), ...road(2, D),
      B('chicaneR', D), ...road(1, D), B('curve2L', D), ...road(2, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c02', name: 'Lakeside Rally', theme: 'forest', car: 'gravel',
    blurb: 'Zigzag through the woods in the rally car, then the stadium car takes the lakeshore.',
    items: [
      start(D), ...road(3, D), ...zig(3, D), ...road(1, D), B('hairpinR', D), ...road(2, D), B('curve2L', D),
      B('slopeUp1', D), B('slopeDown1', D), B('slopeUp1', D), B('slopeDown1', D), ...road(1, D), cp(D), B('curve3R', D), ...road(2, D),
      B('hairpinL', D), ...road(1, D), B('curve2R', D), ...road(1, D),
      gate('volt'), ...road(3), B('bank3L'), ...road(3), B('wallTurn90R'), ...road(2), B('bankChicaneL'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c03', name: 'Hill Climb', theme: 'forest', car: 'volt',
    blurb: 'Switchbacks up the mountain, the rally car down the dirt, and a flat-out run home.',
    items: [
      start(), ...road(3), B('curve2L'), B('slopeUp2'), B('hairpinR'), B('slopeUp2'), ...road(1), B('hairpinL'), B('slopeUp2'), ...road(2), cp(),
      gate('gravel', D), ...road(1, D), B('curve3R', D), B('slopeDown2', D), ...road(1, D), B('spiralDownL', D), ...road(1, D), ...zig(2, D), B('slopeDown2', D), B('curve2L', D), ...road(1, D),
      gate('volt'), ...road(2), B('loop'), ...road(2), B('curve3R'), ...road(3), B('wallTurn90L'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c04', name: 'Canopy Run', theme: 'forest', car: 'gravel',
    blurb: 'Fast forest dirt with jumps, then the stadium car for the loop and the wall.',
    items: [
      start(D), ...road(4, D), B('curve3L', D), ...road(3, D), ...jump('kicker', 1, D), ...road(2, D), B('curve2R', D), ...road(1, D), B('chicaneWideL', D),
      ...road(3, D), ...jump('jumpRamp', 1, D), ...road(2, D), cp(D), B('curve3R', D), ...road(2, D), B('curve2L', D),
      gate('volt'), ...road(2), B('loop'), ...road(1), B('wallRide4L'), ...road(1), B('curve3R'), ...road(2), B('wallTurn90L'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c05', name: 'Grand Valley', theme: 'forest', car: 'volt',
    blurb: 'The big one: tarmac, forest dirt and a beach run, three cars in one lap.',
    items: [
      start(), ...road(5), B('curve3R'), ...road(2), B('bankChicaneL'), ...turbo(3), B('wallTurnL'), ...road(2), cp(), B('curve3R'), ...road(2),
      B('loop'), ...road(1), B('curve2L'), ...road(1), B('wallRide4R'), ...road(1), ...zig(2), ...road(1),
      gate('gravel', D), ...road(2, D), ...zig(3, D), ...road(1, D), B('curve3L', D), B('slopeUp2', D), ...road(1, D), B('hairpinR', D), ...road(1, D), B('slopeDown2', D), cp(D),
      B('curve2L', D), ...road(2, D), B('slopeUp1', D), B('slopeDown1', D), B('slopeUp1', D), B('slopeDown1', D), ...road(1, D),
      gate('dune', SA), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(2, SA), B('curve3R', SA), ...road(1, SA), B('slopeUp1', SA), B('slopeDown1', SA), ...road(2, SA), B('curve3L', SA), ...road(2, SA), finish(SA), ...road(1, SA),
    ],
  },

  // ================================================================ AUTUMN
  {
    id: 'c06', name: 'Falling Leaves', theme: 'sunset', car: 'gravel',
    blurb: 'A short, snappy dirt trail through the red woods, then tarmac for the last sprint.',
    items: [
      start(D), ...road(3, D), B('curve2R', D), ...road(1, D), ...zig(2, D), B('slopeUp1', D), B('slopeDown1', D), ...road(1, D), B('curve3L', D), cp(D), ...road(1, D),
      gate('volt'), ...road(2), B('bank3R'), ...turbo(3), B('bankChicaneL'), ...road(1), finish(), ...road(1),
    ],
  },
  {
    id: 'c07', name: 'Harvest Run', theme: 'sunset', car: 'gravel',
    blurb: 'Farm tracks and sandy fields: rally car, desert car, rally car again.',
    items: [
      start(D), ...road(3, D), B('curve3L', D), ...road(1, D), ...zig(2, D, true), ...road(3, D), ...jump('kicker', 1, D), ...road(2, D), cp(D),
      gate('dune', SA), ...road(1, SA), B('slopeUp2', SA), B('curve3R', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('curve2L', SA), cp(SA),
      gate('gravel', D), ...road(1, D), B('hairpinR', D), ...road(2, D), ...zig(2, D), ...road(1, D), B('curve2L', D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c08', name: 'Misty Gorge', theme: 'sunset', car: 'volt',
    blurb: 'A narrow walled gorge for the stadium car, then out onto the rally trail.',
    items: [
      start(), ...road(3), B('curve3L'), ...road(1), B('slopeUp2', NW), B('wallTurnR'), ...road(1, NW), B('steepUp', NW), ...road(1, NW), B('wallTurn90L'), ...road(2, NW), ...zig(2, NW), cp(NW),
      ...road(2, NW), B('wallTurnL'), ...road(1, NW), B('slopeDown2', NW), ...road(1, NW), B('curve2R', NW), ...road(2, NW),
      gate('gravel', D), ...road(2, D), ...jump('kicker', 1, D), ...road(2, D), B('curve2R', D), ...road(1, D), B('hairpinL', D), ...road(3, D), ...jump('jumpRamp', 1, D), ...road(2, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c09', name: 'Switchback Pass', theme: 'sunset', car: 'gravel',
    blurb: 'Down the mountain in switchbacks, across a tarmac viaduct, and down again.',
    items: [
      start(D), ...road(2, D), B('curve2R', D), B('slopeDown2', D), B('hairpinL', D), B('slopeDown2', D), ...road(1, D), B('hairpinR', D), cp(D), B('slopeDown2', D), ...road(1, D),
      gate('volt'), ...road(2), B('bank3L'), ...road(3), ...jump('jumpRampLong', 1), ...road(2), B('curve3R'), ...road(1), cp(),
      gate('gravel', D), ...road(1, D), B('spiralDownR', D), ...road(1, D), ...zig(2, D), ...road(1, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c10', name: 'Amber Endurance', theme: 'sunset', car: 'gravel',
    blurb: 'Autumn forest, a tarmac mountain road and the first snow of winter. Three cars.',
    items: [
      start(D), ...road(3, D), ...zig(2, D, true), ...road(1, D), B('curve3R', D), ...road(1, D), B('slopeUp1', D), B('slopeDown1', D), B('slopeUp1', D), B('slopeDown1', D), ...road(1, D),
      B('hairpinL', D), ...road(3, D), ...jump('kicker', 1, D), ...road(2, D), B('curve2R', D), ...road(1, D), cp(D),
      gate('volt'), ...road(2), B('curve3L'), ...road(1), B('loop'), ...road(1), B('wallTurnR'), ...road(1), ...turbo(2), B('bank3L'), ...road(2), B('bankChicaneR'), ...road(1), cp(),
      gate('frost', SN), ...road(1, SN), B('slopeUp2', SN), B('curve2R', SN), ...road(1, IC), ...zig(2, SN), ...road(1, SN), B('curve3L', SN), ...road(2, SN), B('hairpinR', SN), ...road(1, SN), finish(SN), ...road(1, SN),
    ],
  },

  // ================================================================ WINTER
  {
    id: 'c11', name: 'Powder Sprint', theme: 'snow', car: 'frost',
    blurb: 'A quick run over fresh powder, then the rally car for the dirt road home.',
    items: [
      start(SN), ...road(3, SN), B('chicaneR', SN), B('slopeUp2', SN), B('curve3R', SN), ...road(3, SN),
      ...jump('kicker', 1, SN), ...road(1, SN), B('bank3L', SN), cp(SN),
      gate('gravel', D), ...road(1, D), B('curve2L', D), ...road(1, D), B('chicaneR', D), B('curve1L', D), B('curve1R', D), ...road(1, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c12', name: 'Frozen Lake', theme: 'snow', car: 'frost',
    blurb: 'Glide across the ice in the snow car, then switch to the stadium car on the gritted road.',
    items: [
      start(SN), ...road(3, SN), B('curve3R', SN), ...road(2, IC), B('curve3L', IC), ...road(2, IC), B('curve2R', SN), ...road(1, SN), cp(SN), ...zig(2, SN, true), ...road(1, SN), B('hairpinR', SN), ...road(1, SN),
      gate('volt', W), ...road(2, W), ...turbo(3, W), B('bank3L', W), ...road(3, W), B('wallTurn90L'), ...road(3, W), ...jump('jumpRamp', 1, W), ...road(2, W), B('curve3R', W), ...road(1, W), finish(W), ...road(1, W),
    ],
  },
  {
    id: 'c13', name: 'Avalanche Alley', theme: 'snow', car: 'volt',
    blurb: 'Downhill at full speed, then the snow car down the chute, and the stadium car for the runout.',
    items: [
      start(), ...road(3), B('slopeDown2'), B('curve3R'), B('slopeDown2'), ...road(1), B('bankChicaneR'), ...road(1), B('wallTurnL'), ...road(2), B('slopeDown2'), ...road(1), cp(),
      gate('frost', SN), ...road(1, SN), B('slopeDown2', SN), ...zig(2, SN), ...road(1, IC), B('curve2R', SN), B('slopeDown2', SN), ...road(1, SN), B('hairpinL', SN), ...road(1, SN), cp(SN),
      gate('volt', W), ...road(2, W), ...turbo(3, W), B('bank3L'), ...road(2, W), B('wallTurn90R'), ...road(2, W), finish(W), ...road(1, W),
    ],
  },
  {
    id: 'c14', name: 'Glacier Run', theme: 'snow', car: 'frost',
    blurb: 'Narrow ice canyons, a rally dirt shortcut under the glacier, and back onto the ice.',
    items: [
      start(SN), ...road(2, SN), B('curve2L', NW), ...road(2, { s: 'ice', v: 'narrow', w: 'both' }), ...zig(2, SN), ...road(1, SN), B('slopeUp2', SN), ...road(1, SN), B('curve3R', SN), cp(SN),
      gate('gravel', DW), ...road(1, DW), B('hairpinR', DW), ...road(1, DW), B('slopeDown2', DW), ...zig(2, DW), ...road(1, DW),
      gate('frost', SN), ...road(2, SN), B('curve3L', SN), ...road(3, SN), ...jump('kicker', 1, SN), ...road(2, SN), B('curve2R', SN), ...road(1, SN), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c15', name: 'Blizzard Marathon', theme: 'snow', car: 'volt',
    blurb: 'The longest road in the snow: stadium, snow and rally cars across the whole range.',
    items: [
      start(), ...road(4), B('curve3R'), ...road(2), B('loop'), ...road(1), B('bankChicaneL'), ...turbo(2), B('wallTurnL'), ...road(2), cp(),
      gate('frost', SN), ...road(1, SN), B('curve3R', SN), ...road(2, IC), B('slopeUp2', SN), ...zig(3, SN), ...road(1, SN), B('hairpinL', SN), ...road(2, SN), B('slopeDown2', SN), ...road(1, SN), B('curve3L', SN), ...road(2, IC), B('curve3L', SN), ...road(1, SN), cp(SN),
      gate('gravel', D), ...road(2, D), B('curve3R', D), ...road(3, D), ...jump('jumpRamp', 1, D), ...road(2, D), B('curve2L', D), ...road(1, D), ...zig(2, D, true), ...road(2, D), finish(D), ...road(1, D),
    ],
  },

  // ================================================================ DESERT
  {
    id: 'c16', name: 'Dune Dash', theme: 'desert', car: 'dune',
    blurb: 'Fly over the dunes, then pull on the stadium car for the walls at the end.',
    items: [
      start(SA), ...road(4, SA), B('curve3L', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('slopeUp2', SA), ...road(1, SA), cp(SA), B('curve2R', SA), ...road(1, SA),
      gate('volt'), ...road(2), B('wallTurn90L'), ...turbo(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c17', name: 'Canyon Run', theme: 'desert', car: 'dune',
    blurb: 'Sand, then the rally car through the dirt canyon, then back to the dunes.',
    items: [
      start(SA), ...road(3, SA), B('curve3R', SA), ...road(1, SA), ...zig(2, SA, true), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(2, SA), cp(SA),
      gate('gravel', D), ...road(1, D), B('hairpinL', D), ...road(1, D), B('slopeUp2', D), B('curve2R', D), ...road(1, D), ...zig(2, D), B('slopeDown2', D), cp(D),
      gate('dune', SA), ...road(2, SA), B('curve3L', SA), ...road(3, SA), ...jump('jumpRampBig', 2, SA), ...road(2, SA), B('curve2R', SA), ...road(1, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 'c18', name: 'Mesa Jumps', theme: 'desert', car: 'gravel',
    blurb: 'Rally car over the rocky ridge, then the desert car for four big jumps.',
    items: [
      start(D), ...road(3, D), B('curve3R', D), ...road(1, D), B('slopeUp2', D), ...zig(2, D), ...road(1, D), B('hairpinL', D), ...road(2, D), B('slopeDown2', D), cp(D),
      gate('dune', SA), ...road(2, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('curve2L', SA), ...road(3, SA), ...jump('jumpRampBig', 2, SA), ...road(2, SA), B('curve3R', SA), ...road(3, SA),
      ...jump('jumpRampLong', 1, SA), ...road(2, SA), B('curve2L', SA), ...road(3, SA), ...jump('jumpRampBig', 2, SA), ...road(2, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 'c19', name: 'Oasis Highway', theme: 'desert', car: 'volt',
    blurb: 'A tarmac highway, a dune shortcut through the oasis, and a high-speed finish.',
    items: [
      start(), ...road(5), B('curve3L'), ...road(2), ...zig(2), ...turbo(3), B('bank3R'), ...road(2), cp(),
      gate('dune', SA), ...road(2, SA), B('curve3L', SA), ...road(1, SA), B('slopeUp2', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('curve2R', SA), ...road(1, SA), ...zig(2, SA, true), ...road(1, SA), cp(SA),
      gate('volt'), ...road(2), B('wallTurnL'), ...road(3), ...jump('jumpRampLong', 1), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c20', name: 'Sahara Marathon', theme: 'desert', car: 'dune',
    blurb: 'The longest drive in the desert: sand, dirt and tarmac, and home across the dunes.',
    items: [
      start(SA), ...road(4, SA), B('curve3R', SA), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(2, SA), B('curve2L', SA), ...road(1, SA), ...zig(2, SA, true), ...road(1, SA), B('slopeUp1', SA), B('slopeDown1', SA), ...road(1, SA), cp(SA),
      gate('gravel', D), ...road(1, D), B('hairpinR', D), ...road(1, D), B('slopeUp2', D), ...zig(2, D), B('slopeDown2', D), ...road(1, D), B('curve3L', D), ...road(1, D), B('curve1R', D), B('curve1L', D), ...road(1, D), cp(D),
      gate('volt'), ...road(2), B('loop'), ...road(1), B('wallTurnR'), ...turbo(2), B('bank3L'), ...road(2), cp(),
      gate('dune', SA), ...road(3, SA), ...jump('jumpRampBig', 2, SA), ...road(2, SA), B('curve3R', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), finish(SA), ...road(1, SA),
    ],
  },

  // ================================================================ NIGHT
  {
    id: 'c21', name: 'Neon Sprint', theme: 'night', car: 'volt',
    blurb: 'A flat-out lap under the floodlights: loop, wall, then a dirt alley to the line.',
    items: [
      start(), ...turbo(3), B('loop'), ...road(2), B('curve3R'), ...road(2), ...zig(2), ...road(1), B('wallTurnL'), ...road(2), cp(),
      gate('gravel', D), ...road(1, D), B('curve2R', D), ...road(1, D), B('chicaneL', D), ...road(2, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 'c22', name: 'Downtown Drift', theme: 'night', car: 'gravel',
    blurb: 'Slide through the back alleys in the rally car, then stadium speed down the main drag.',
    items: [
      start(D), ...road(2, D), B('curve1L', D), ...road(1, D), B('curve1R', D), ...road(2, D), B('curve1L', D), ...road(1, D), B('curve1R', D), ...road(2, D), cp(D),
      B('hairpinR', D), ...road(1, D), B('curve1L', D), ...road(1, D), B('curve1R', D), ...road(2, D), B('curve1L', D), ...road(1, D), B('curve1R', D), ...road(2, D),
      gate('volt'), ...road(2), ...turbo(3), B('bank3L'), ...road(1), B('loop'), ...road(1), B('curve3R'), ...road(2), B('bankChicaneL'), ...road(1), finish(), ...road(1),
    ],
  },
  {
    id: 'c23', name: 'Skyline Stunts', theme: 'night', car: 'volt',
    blurb: 'Spirals, loops and wall rides above the city, with a sandy rooftop in the middle.',
    items: [
      start(), ...road(2), B('spiralUpL'), ...road(1), B('loop'), ...road(1), B('wallRide4R'), ...road(1), B('curve3L'), cp(),
      gate('dune', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('curve2R', SA), ...road(1, SA), ...zig(2, SA), cp(SA),
      gate('volt'), ...road(1), B('spiralDownR'), ...turbo(2), B('wallTurnL'), ...road(1), B('loop'), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 'c24', name: 'Midnight Mountain', theme: 'night', car: 'frost',
    blurb: 'Snow and ice up the peak, tarmac across the ridge, and back down on the snow.',
    items: [
      start(SN), ...road(2, SN), B('curve3R', SN), ...road(1, SN), B('steepUp', SN), ...zig(1, SN), ...road(1, IC), B('curve2L', SN), cp(SN),
      gate('volt', W), ...road(2, W), ...turbo(2, W), B('wallTurnR'), ...road(1, W), B('loop'), ...road(1, W), B('bank3L'), ...road(1, W), B('bankChicaneL'), cp(W),
      gate('frost', SN), B('steepDown', SN), ...road(1, SN), B('hairpinR', SN), ...road(1, IC), B('curve3L', SN), ...road(1, SN), ...zig(1, SN), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 'c25', name: 'Grand Final', theme: 'night', car: 'volt',
    blurb: 'Every car, every trick: stadium, rally, snow and desert in one run under the lights.',
    items: [
      start(), ...road(3), B('curve3R'), ...turbo(2), B('loop'), ...road(1), B('wallTurnL'), ...road(1), B('bankChicaneR'), cp(),
      gate('gravel', D), ...road(1, D), ...zig(2, D), B('hairpinL', D), ...road(3, D), ...jump('kicker', 1, D), ...road(2, D), B('curve2R', D), cp(D),
      gate('frost', SN), ...road(1, SN), B('slopeUp2', SN), B('curve3L', SN), ...road(1, IC), B('chicaneL', SN), B('slopeDown2', SN), ...road(1, SN), cp(SN),
      gate('dune', SA), ...road(3, SA), ...jump('kicker', 1, SA), ...road(4, SA), B('curve3R', SA), ...road(3, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), cp(SA),
      gate('volt'), ...road(2), B('wallTurn90R'), ...road(1), B('loop'), ...road(1), B('wallRide4L'), ...road(1), finish(), ...road(1),
    ],
  },
];
