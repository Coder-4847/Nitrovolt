import { LEVELS } from '../src/data';
import { HANDMADE } from '../src/tracks/CampaignPlan';

/**
 * Expensive per-level checks (full bot drives, exact ghost replays, scenery sweeps) run on every hand-made
 * level plus every 8th generated one, so the suite stays fast; `npm run campaign` drives all 100.
 * Set FULL=1 to run them on every level.
 */
const generated = LEVELS.filter((l) => !(l.id in HANDMADE));
export const SAMPLE = process.env.FULL ? LEVELS : [...LEVELS.filter((l) => l.id in HANDMADE), ...generated.filter((_, i) => i % 8 === 3)];
