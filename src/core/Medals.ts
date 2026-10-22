import { MedalTimes } from '../tracks/TrackSchema';

export type Medal = 'author' | 'gold' | 'silver' | 'bronze' | 'none';

export const MEDAL_ORDER: Medal[] = ['none', 'bronze', 'silver', 'gold', 'author'];

/** Medal earned by a finish time (ms). Unset thresholds (0) are never reached. A time equal to a threshold earns it. */
export function medalFor(timeMs: number, m: MedalTimes): Medal {
  if (m.author > 0 && timeMs <= m.author) return 'author';
  if (m.gold > 0 && timeMs <= m.gold) return 'gold';
  if (m.silver > 0 && timeMs <= m.silver) return 'silver';
  if (m.bronze > 0 && timeMs <= m.bronze) return 'bronze';
  return 'none';
}

export const betterMedal = (a: Medal, b: Medal): Medal => (MEDAL_ORDER.indexOf(a) >= MEDAL_ORDER.indexOf(b) ? a : b);
