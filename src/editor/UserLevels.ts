import { GhostData } from '../core/Ghost';
import { TrackJson } from '../tracks/TrackSchema';

/** A level made in the editor, as stored in the browser. */
export interface UserLevel {
  id: string;
  json: TrackJson;
  /** epoch ms */
  updated: number;
  /** Set once the level has been validated (bot or the player's own finish). */
  author?: GhostData;
  /** How the author time was set. */
  authorBy?: 'bot' | 'player';
}

const DB = 'nitrovolt-user';
const STORE = 'levels';
const memory = new Map<string, UserLevel>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

/** "My levels": IndexedDB with an in-memory fallback (private windows, tests). */
export const UserLevels = {
  async list(): Promise<UserLevel[]> {
    const fromDb = (await run<UserLevel[]>('readonly', (s) => s.getAll())) ?? [];
    const byId = new Map(fromDb.map((l) => [l.id, l]));
    for (const l of memory.values()) byId.set(l.id, l);
    return [...byId.values()].sort((a, b) => b.updated - a.updated);
  },

  async get(id: string): Promise<UserLevel | null> {
    const hit = memory.get(id);
    if (hit) return hit;
    const l = await run<UserLevel>('readonly', (s) => s.get(id));
    if (l) memory.set(id, l);
    return l ?? null;
  },

  async save(l: UserLevel): Promise<void> {
    memory.set(l.id, l);
    await run('readwrite', (s) => s.put(l));
  },

  async remove(id: string): Promise<void> {
    memory.delete(id);
    await run('readwrite', (s) => s.delete(id));
  },
};

/** User level ids are prefixed so they never collide with built-in levels. */
export const isUserLevel = (id: string): boolean => id.startsWith('u-');

export function newLevelId(): string {
  return `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
