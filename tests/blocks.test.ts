import { describe, expect, it } from 'vitest';
import { BLOCKS, BLOCK_IDS } from '../src/tracks/BlockLibrary';
import { blockExit, layoutChain } from '../src/tracks/ChainLayout';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson } from '../src/tracks/TrackSchema';

describe('block library', () => {
  it('has the ~40 piece core set', () => {
    expect(BLOCK_IDS.length).toBeGreaterThanOrEqual(40);
  });

  it('every chain block exits on the grid (edge centre, whole level), in every variant', () => {
    for (const id of BLOCK_IDS) {
      if (!BLOCKS[id]!.chain) continue;
      for (const variant of ['std', 'wide', 'narrow'] as const) {
        // layoutChain throws if the next anchor cell centre is off the grid
        expect(() => layoutChain([{ type: id, variant }, { type: 'straight1' }]), `${id}/${variant}`).not.toThrow();
      }
    }
  });

  it('every block builds geometry (or is scenery) without throwing, in all variants', () => {
    for (const id of BLOCK_IDS) {
      for (const variant of ['std', 'wide', 'narrow'] as const) {
        const json: TrackJson = {
          id: 't', name: 't', car: 'volt', theme: 'grey', seed: 1, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
          blocks: [{ type: id, gridPos: [0, 0, 0], rot: 0, variant }],
        };
        const t = buildTrack(json);
        expect(t.meshes.length, id).toBeGreaterThan(0);
        for (const m of t.meshes) {
          expect(m.positions.every(Number.isFinite), `${id} NaN`).toBe(true);
          expect(m.indices.length % 3).toBe(0);
        }
      }
    }
  });

  it('chaining places blocks edge to edge and rotates with turns', () => {
    const { blocks, next } = layoutChain([{ type: 'straight2' }, { type: 'curve2L' }, { type: 'straight1' }]);
    expect(blocks[0]!.gridPos).toEqual([0, 0, 0]);
    expect(blocks[1]!.gridPos).toEqual([0, 0, -2]);
    expect(blocks[2]!.rot).toBe(1);
    expect(next.rot).toBe(1);
  });

  it('jump ramps leave pitched up and landings arrive level', () => {
    expect(blockExit('jumpRamp').pitchDeg).toBeGreaterThan(8);
    expect(blockExit('jumpRamp').pitchDeg).toBeLessThan(35);
    expect(Math.abs(blockExit('landing1').pitchDeg)).toBeLessThan(0.5);
    expect(blockExit('slopeUp1').dy).toBeCloseTo(4, 2);
  });
});
