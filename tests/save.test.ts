import { beforeEach, describe, expect, it } from 'vitest';

// minimal in-memory localStorage for node
class MemStorage {
  private m = new Map<string, string>();
  get length(): number { return this.m.size; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}
(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();

const { Records } = await import('../src/core/Records');
const { exportSave, importSave, validateSave } = await import('../src/core/SaveFile');
const { GhostStore } = await import('../src/core/GhostStore');
const { Settings } = await import('../src/core/Settings');

const ghost = (id: string) => ({ v: 1 as const, trackId: id, carId: 'volt', time: 12345, ticks: 10, levelHash: 'a', physicsHash: 'b', input: 'AA==', snaps: 'AA==' });

beforeEach(async () => {
  localStorage.clear();
  Settings.reload();
  await GhostStore.clear();
});

describe('records', () => {
  it('keeps only the best time and its splits', () => {
    expect(Records.submit('t', 30000, [10000, 30000])).toBe(true);
    expect(Records.submit('t', 31000, [11000, 31000])).toBe(false);
    expect(Records.submit('t', 29000, [9000, 29000])).toBe(true);
    expect(Records.get('t')!.best).toBe(29000);
    expect(Records.get('t')!.splits).toEqual([9000, 29000]);
  });

  it('derives medals from the personal best and current thresholds', () => {
    Records.submit('t', 21000, []);
    const m = { author: 20000, gold: 21600, silver: 24000, bronze: 29000 };
    expect(Records.medal('t', m)).toBe('gold');
    expect(Records.medal('t', { ...m, gold: 20500 })).toBe('silver'); // thresholds changed, medal follows
    expect(Records.medal('unplayed', m)).toBe('none');
  });
});

describe('save file', () => {
  it('exports records, settings and ghosts and imports them back', async () => {
    Records.submit('a', 22000, [8000, 22000]);
    Settings.set('hudScale', 1.3);
    localStorage.setItem('unrelated', 'x');
    await GhostStore.save(ghost('a'));
    const file = await exportSave();
    expect(file.storage['unrelated']).toBeUndefined();
    expect(validateSave(file)).toEqual([]);

    localStorage.clear();
    Settings.reload();
    await GhostStore.clear();
    expect(Records.get('a')).toBeUndefined();
    await importSave(JSON.parse(JSON.stringify(file)));
    expect(Records.get('a')!.best).toBe(22000);
    expect(Settings.get().hudScale).toBe(1.3);
    expect((await GhostStore.load('a'))!.time).toBe(12345);
  });

  it('rejects malformed or foreign files without touching the save', async () => {
    Records.submit('keep', 1000, []);
    for (const bad of [null, 'text', {}, { format: 'other', version: 1, storage: {}, ghosts: [] }, { format: 'nitrovolt-save', version: 2, storage: {}, ghosts: [] }, { format: 'nitrovolt-save', version: 1, storage: { evil: '1' }, ghosts: [] }, { format: 'nitrovolt-save', version: 1, storage: {}, ghosts: [{ nope: 1 }] }]) {
      await expect(importSave(bad)).rejects.toThrow();
    }
    expect(Records.get('keep')!.best).toBe(1000);
  });
});

describe('ghost store', () => {
  it('saves, loads and lists ghosts', async () => {
    await GhostStore.save(ghost('x'));
    await GhostStore.save(ghost('y'));
    expect((await GhostStore.load('x'))!.trackId).toBe('x');
    expect((await GhostStore.all()).map((g) => g.trackId).sort()).toEqual(['x', 'y']);
    expect(await GhostStore.load('missing')).toBeNull();
  });
});
