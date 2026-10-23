import { TrackJson } from '../tracks/TrackSchema';
import manifest from './levels.json';

/** Every level file in `levels/` (built by scripts/make-levels.mts). */
const files = import.meta.glob<TrackJson>('./levels/*.json', { eager: true, import: 'default' });
const all = Object.values(files);
const order = new Map((manifest as Array<{ id: string }>).map((e, i) => [e.id, i]));

/** Built-in levels in play order (campaign, then training). */
export const LEVELS: TrackJson[] = all.sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6) || a.id.localeCompare(b.id));

export const DEFAULT_LEVEL_ID = 'c01';

const byId = new Map(LEVELS.map((l) => [l.id, l]));

export function getLevel(id: string | null | undefined): TrackJson | undefined {
  return id ? byId.get(id) : undefined;
}
