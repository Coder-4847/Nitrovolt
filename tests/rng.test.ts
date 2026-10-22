import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/Rng';

describe('Rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it('differs between seeds and stays in [0,1)', () => {
    const a = new Rng(1), b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a.next(), y = b.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === y) same++;
    }
    expect(same).toBeLessThan(3);
  });
});
