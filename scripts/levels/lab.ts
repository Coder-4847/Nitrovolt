import { B, LevelDef, cp, finish, gate, jump, road, start, turbo } from './dsl';

const SA = { s: 'sand' } as const;
/** Scratch layout for trying things with the bot (not shipped). */
export const LAB: LevelDef = {
  id: 'lab',
  name: 'Lab',
  theme: 'desert',
  car: 'dune',
  blurb: 'Test bed.',
  items: [start(SA), ...road(3, SA), ...jump('jumpRampLong', 1, SA), ...road(3, SA), finish(SA), ...road(1, SA)],
};
