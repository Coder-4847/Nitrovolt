import { B, LevelDef, cp, finish, gate, jump, road, start, turbo } from './dsl';

/** Every special block and car once: checks the bot and the physics can do them all. */
export const LAB: LevelDef = {
  id: 'lab',
  name: 'Lab',
  theme: 'forest',
  car: 'volt',
  tier: 'training',
  blurb: 'Test bed.',
  hints: { lateralBudget: 45 },
  items: [
    start(), ...road(3), B('curve2R'), ...road(2), B('wallTurnL'), ...road(2), cp(),
    ...turbo(2), ...jump('jumpRamp', 1), ...road(1), B('loop'), ...road(2), B('curve3L'), ...road(1),
    gate('gravel'), ...road(2, { s: 'dirt' }), B('curve2R', { s: 'dirt' }), ...road(2, { s: 'dirt' }), cp(),
    gate('frost'), ...road(2, { s: 'snow' }), B('bank2R', { s: 'snow' }), ...road(2, { s: 'snow' }),
    gate('dune'), ...road(2, { s: 'sand' }), ...jump('kicker', 1, { s: 'sand' }), ...road(1, { s: 'sand' }),
    gate('volt'), ...road(2), B('wallTurn90R'), ...road(2), B('halfpipe2'), ...road(1), B('wallRide4L'), ...road(1), finish(), ...road(1),
  ],
};
