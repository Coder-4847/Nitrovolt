import { TrackJson } from '../tracks/TrackSchema';
import placement from './campaign.json';

/** Every level file in `levels/` (hand-made and generated), loaded through the same JSON loader the editor uses. */
const files = import.meta.glob<TrackJson>('./levels/*.json', { eager: true, import: 'default' });
const all = Object.values(files);
const order = new Map((placement as Array<[number, number, string]>).map(([s, k, id]) => [id, s * 25 + k]));

/** Built-in levels in campaign order (levels not in the campaign come last). */
export const LEVELS: TrackJson[] = all.sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6) || a.id.localeCompare(b.id));

export const DEFAULT_LEVEL_ID = 'sprint01';

const byId = new Map(LEVELS.map((l) => [l.id, l]));

export function getLevel(id: string | null | undefined): TrackJson | undefined {
  return id ? byId.get(id) : undefined;
}
