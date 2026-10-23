import { B, LevelDef, cp, finish, gate, jump, road, start, turbo } from './dsl';

const D = { s: 'dirt' } as const;
const G = { s: 'grass' } as const;
const SN = { s: 'snow', w: 'both' } as const;
const IC = { s: 'ice', w: 'both' } as const;
const SA = { s: 'sand' } as const;

/** Short tracks that each teach one thing. */
export const TRAINING_DEFS: LevelDef[] = [
  {
    id: 't01', name: 'Basics', theme: 'forest', car: 'volt', tier: 'training',
    blurb: 'Throttle, brake, steer. Brake before the corner, not in it.',
    items: [
      start(), ...road(4), B('curve3R'), ...road(3), cp(), ...road(1), B('curve2R'), ...road(2), B('curve1L'), ...road(1),
      B('curve2L'), ...road(3), B('curve3L'), ...road(3), finish(), ...road(1),
    ],
  },
  {
    id: 't02', name: 'Air Time', theme: 'forest', car: 'volt', tier: 'training',
    blurb: 'Hit the ramps flat out and land on the slope.',
    items: [
      start(), ...road(5), ...jump('jumpRamp', 1), ...road(2), B('curve3L'), ...road(2), B('slopeUp2'), ...road(2), cp(),
      ...road(3), ...jump('kicker', 1), ...road(1), B('curve3R'), ...road(4), ...jump('jumpRampBig', 2), ...road(2), finish(), ...road(1),
    ],
  },
  {
    id: 't03', name: 'Wall Ride', theme: 'sunset', car: 'volt', tier: 'training',
    blurb: 'Keep your speed up and the wall holds you.',
    items: [
      start(), ...road(5), B('wallTurn90R'), ...road(3), B('wallTurnL'), ...road(3), cp(), ...road(1),
      B('wallTurn90R'), ...road(4), B('wallTurnR'), ...road(3), finish(), ...road(1),
    ],
  },
  {
    id: 't04', name: 'Loop', theme: 'night', car: 'volt', tier: 'training',
    blurb: 'Full speed into the loop; let the car follow it round.',
    items: [
      start(), ...turbo(4), B('loop'), ...road(3), B('curve3L'), ...road(2), cp(), ...road(2), B('curve3L'), ...turbo(3), B('loop'), ...road(3), finish(), ...road(1),
    ],
  },
  {
    id: 't05', name: 'Dirt Road', theme: 'forest', car: 'gravel', tier: 'training',
    blurb: 'The rally car slides on dirt: turn in early and power out.',
    items: [
      start(D), ...road(3, D), B('curve2L', D), ...road(2, D), B('chicaneR', D), ...road(1, D), cp(D),
      ...road(1, D), B('curve2R', D), ...road(1, G), B('curve2R', G), ...road(2, D), ...jump('kicker', 1, D), ...road(2, D), B('curve3L', D), ...road(2, D), finish(D), ...road(1, D),
    ],
  },
  {
    id: 't06', name: 'Snowfield', theme: 'snow', car: 'frost', tier: 'training',
    blurb: 'Snow grips, ice does not. Smooth hands.',
    items: [
      start(SN), ...road(3, SN), B('curve3L', SN), ...road(2, SN), ...road(2, IC), ...road(1, SN), cp(SN),
      B('bank3R', SN), ...road(2, SN), ...jump('kicker', 1, SN), ...road(2, SN), B('curve2R', SN), ...road(2, IC), B('curve3L', IC), ...road(1, SN), finish(SN), ...road(1, SN),
    ],
  },
  {
    id: 't07', name: 'Dunes', theme: 'desert', car: 'dune', tier: 'training',
    blurb: 'Light and bouncy: the desert car flies off every crest.',
    items: [
      start(SA), ...road(4, SA), ...jump('kicker', 1, SA), ...road(2, SA), B('curve3R', SA), ...road(2, SA), B('slopeUp2', SA), cp(SA),
      ...road(2, SA), ...jump('jumpRamp', 1, SA), ...road(2, SA), B('curve2L', SA), ...road(3, SA), finish(SA), ...road(1, SA),
    ],
  },
  {
    id: 't08', name: 'Car Switch', theme: 'sunset', car: 'volt', tier: 'training',
    blurb: 'Drive through a gate and you change car on the spot.',
    items: [
      start(), ...road(4), B('curve3R'), ...road(2), gate('gravel', D), ...road(2, D), B('curve2L', D), ...road(2, D), cp(D),
      gate('frost', SN), ...road(2, SN), B('curve3L', SN), ...road(2, SN), gate('volt'), ...road(3), B('curve3R'), ...road(2), finish(), ...road(1),
    ],
  },
];
