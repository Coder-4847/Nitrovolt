import { storage } from './Storage';

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

/** Personal bests per track, kept in localStorage. */
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
};

/** "+0.231" / "-0.231" style delta in seconds. */
export function formatDelta(ms: number): string {
  const s = Math.abs(ms) / 1000;
  return `${ms < 0 ? '−' : '+'}${s.toFixed(3)}`;
}
