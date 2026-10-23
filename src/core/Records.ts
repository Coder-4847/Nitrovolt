import { Medal, medalFor } from './Medals';
import { storage } from './Storage';
import { MedalTimes } from '../tracks/TrackSchema';

export interface PersonalBest {
  /** Best finish time (ms). */
  best: number;
  /** Split times (ms) of that run, in crossing order. */
  splits: number[];
  /** When it was set (epoch ms). */
  at: number;
}

export const RECORDS_KEY = 'nitrovolt.records.v1';

type Table = { [id: string]: PersonalBest };
const read = (): Table => storage.get<Table>(RECORDS_KEY, {});

/** Personal bests per track, kept in localStorage. Medals are derived from the time, so they follow the thresholds. */
export const Records = {
  get(trackId: string): PersonalBest | undefined {
    return read()[trackId];
  },

  all(): Table {
    return read();
  },

  /** Store `time`/`splits` if it beats the saved best. Returns true for a new personal best. */
  submit(trackId: string, time: number, splits: number[]): boolean {
    const all = read();
    const cur = all[trackId];
    if (cur && cur.best <= time) return false;
    all[trackId] = { best: time, splits: [...splits], at: Date.now() };
    storage.set(RECORDS_KEY, all);
    return true;
  },

  clear(): void {
    storage.set(RECORDS_KEY, {});
  },

  /** Best medal earned on a level, from its personal best. */
  medal(trackId: string, medals: MedalTimes): Medal {
    const r = read()[trackId];
    return r ? medalFor(r.best, medals) : 'none';
  },
};

/** "+0.231" / "-0.231" style delta in seconds. */
export function formatDelta(ms: number): string {
  const s = Math.abs(ms) / 1000;
  return `${ms < 0 ? '−' : '+'}${s.toFixed(3)}`;
}
