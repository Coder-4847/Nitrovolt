import { LEVELS } from '../src/data';

/**
 * Expensive per-level checks (full bot drives, exact ghost replays, scenery sweeps) run on a spread of the
 * hand-made levels (every tier, training, car gates, walls and loops) so the suite stays fast;
 * `npx tsx scripts/make-levels.mts` drives all of them. Set FULL=1 to run them on every level.
 */
const PICK = ['t01', 't08', 'c01', 'c05', 'c07', 'c12', 'c18', 'c20', 'c25'];
export const SAMPLE = process.env.FULL ? LEVELS : LEVELS.filter((l) => PICK.includes(l.id));
