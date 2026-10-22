import { TrackJson } from '../tracks/TrackSchema';
import sprint01 from './levels/sprint01.json';
import boostlab from './levels/boostlab.json';
import circuit01 from './levels/circuit01.json';
import stunt01 from './levels/stunt01.json';

/** Built-in levels (all driven through the same JSON loader the editor will use). */
export const LEVELS: TrackJson[] = [sprint01, circuit01, boostlab, stunt01] as unknown as TrackJson[];

export const DEFAULT_LEVEL_ID = 'sprint01';

export function getLevel(id: string | null | undefined): TrackJson | undefined {
  return LEVELS.find((l) => l.id === id);
}
