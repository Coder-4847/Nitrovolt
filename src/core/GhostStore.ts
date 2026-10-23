import { GhostData } from './Ghost';

/**
 * Personal-best ghosts live in IndexedDB (they are tens of KB each and there can be 100+); where it is not
 * available (private windows, tests) they fall back to memory for the session.
 */
const DB = 'nitrovolt';
const STORE = 'ghosts';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, GhostData>();

function open(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'trackId' });
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

export const GhostStore = {
  async load(trackId: string): Promise<GhostData | null> {
    const hit = memory.get(trackId);
    if (hit) return hit;
    const g = await run<GhostData>('readonly', (s) => s.get(trackId));
    if (g) memory.set(trackId, g);
    return g ?? null;
  },

  async save(g: GhostData): Promise<void> {
    memory.set(g.trackId, g);
    await run('readwrite', (s) => s.put(g));
  },

  async all(): Promise<GhostData[]> {
    const fromDb = (await run<GhostData[]>('readonly', (s) => s.getAll())) ?? [];
    const byId = new Map(fromDb.map((g) => [g.trackId, g]));
    for (const g of memory.values()) byId.set(g.trackId, g);
    return [...byId.values()];
  },

  async clear(): Promise<void> {
    memory.clear();
    await run('readwrite', (s) => s.clear());
  },
};

/** Ghosts that ship with the game: the author runs (recorded by the validation bot), loaded on demand. */
const authorModules = import.meta.glob<GhostData>('../data/ghosts/*.json', { import: 'default' });

export async function authorGhost(trackId: string): Promise<GhostData | null> {
  const loader = authorModules[`../data/ghosts/${trackId}.json`];
  return loader ? await loader() : null;
}
