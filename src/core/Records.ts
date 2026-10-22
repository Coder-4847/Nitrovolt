import { storage } from './Storage';

export interface PersonalBest {
  /** Best finish time (ms). */
  best: number;
  /** Split times (ms) of that run, in crossing order. */
  splits: number[];
}

const KEY = 'nitrovolt.records.v1';

/** Personal bests per track, kept in localStorage (expanded with ghosts and medals in Phase 4). */
export const Records = {
  get(trackId: string): PersonalBest | undefined {
    return storage.get<{ [id: string]: PersonalBest }>(KEY, {})[trackId];
  },
  /** Store `time`/`splits` if it beats the saved best. Returns true for a new personal best. */
  submit(trackId: string, time: number, splits: number[]): boolean {
    const all = storage.get<{ [id: string]: PersonalBest }>(KEY, {});
    const cur = all[trackId];
    if (cur && cur.best <= time) return false;
    all[trackId] = { best: time, splits: [...splits] };
    storage.set(KEY, all);
    return true;
  },
};

/** "+0.231" / "-0.231" style delta in seconds. */
export function formatDelta(ms: number): string {
  const s = Math.abs(ms) / 1000;
  return `${ms < 0 ? '−' : '+'}${s.toFixed(3)}`;
}
