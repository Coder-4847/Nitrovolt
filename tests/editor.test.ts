import { describe, expect, it } from 'vitest';
import { getLevel } from '../src/data';
import { checkLevel } from '../src/editor/Checks';
import { EditorModel, emptyLevel } from '../src/editor/EditorModel';
import { decodeLevel, encodeLevel } from '../src/editor/ShareCode';
import { layoutChain } from '../src/tracks/ChainLayout';
import { TrackJson } from '../src/tracks/TrackSchema';
import { botRun } from '../src/tracks/Validate';

/** Build a level by "typing" it into the editor the way a player would, in chain mode. */
function build(types: string[]): EditorModel {
  const m = new EditorModel(emptyLevel('u-test', 'Test'));
  for (const t of types) {
    m.brush.type = t;
    expect(m.place(), t).toBeGreaterThanOrEqual(0);
  }
  return m;
}

describe('editor model', () => {
  it('chain mode lays blocks end to end exactly like the authoring tool', () => {
    const types = ['straight2', 'curve2R', 'straight2', 'checkpoint', 'chicaneL', 'straight1', 'finish'];
    const m = build(types);
    const ref = layoutChain([{ type: 'start' }, ...types.map((type) => ({ type }))]).blocks;
    expect(m.json.blocks).toEqual(ref);
    expect(checkLevel(m.json).errors).toEqual([]);
    expect(checkLevel(m.json).finishReachable).toBe(true);
  });

  it('undo / redo restore every step; erase, paint and pick work on blocks', () => {
    const m = build(['straight2', 'curve2L', 'finish']);
    const full = JSON.stringify(m.json.blocks);
    m.undo();
    expect(m.json.blocks).toHaveLength(3);
    m.redo();
    expect(JSON.stringify(m.json.blocks)).toBe(full);
    const curve = m.json.blocks.findIndex((b) => b.type === 'curve2L');
    m.brush = { ...m.brush, surface: 'ice', variant: 'wide', walls: 'both' };
    m.paint(curve);
    expect(m.json.blocks[curve]).toMatchObject({ surface: 'ice', variant: 'wide', walls: 'both' });
    m.pick(0);
    expect(m.brush.type).toBe('start');
    m.erase(curve);
    expect(m.json.blocks.some((b) => b.type === 'curve2L')).toBe(false);
    m.undo();
    expect(m.json.blocks[curve]!.type).toBe('curve2L');
  });

  it('finds blocks by grid column and keeps a single start', () => {
    const m = build(['straight2', 'finish']);
    const [x, , z] = m.json.blocks[1]!.gridPos;
    expect(m.blockAt(x, z, 0)).toBe(1);
    m.brush.type = 'start';
    m.moveCursor(10, 10);
    m.place();
    expect(m.json.blocks.filter((b) => b.type === 'start')).toHaveLength(1);
  });

  it('rotates and changes level of the cursor', () => {
    const m = new EditorModel(emptyLevel('u', 'x'));
    m.rotate(1);
    m.rotate(1);
    m.rotate(-1);
    expect(m.cursor.rot).toBe(1);
    m.setLevel(3);
    expect(m.cursor.gridPos[1]).toBe(3);
  });
});

describe('level checks', () => {
  it('a campaign level is fully connected', () => {
    for (const id of ['sprint01', 'circuit01', 'stunt01', 's2-11', 's4-16']) {
      const c = checkLevel(getLevel(id)!);
      expect(c.errors, id).toEqual([]);
      expect(c.finishReachable, id).toBe(true);
      expect(c.unreachable, id).toEqual([]);
    }
  });

  it('follows jumps across their gap', () => {
    const lv = getLevel('sprint01')!;
    const c = checkLevel(lv);
    const landing = lv.blocks.findIndex((b) => b.type.startsWith('landing'));
    expect(c.path).toContain(landing);
  });

  it('reports a broken driving line, unreachable pieces and overlaps', () => {
    const lv = structuredClone(getLevel('sprint01')!) as TrackJson;
    lv.blocks.splice(5, 1);
    const c = checkLevel(lv);
    expect(c.finishReachable).toBe(false);
    expect(c.errors.join()).toContain('cannot be reached');
    expect(c.unreachable.length).toBeGreaterThan(3);
    const dup = structuredClone(getLevel('sprint01')!) as TrackJson;
    dup.blocks.push({ ...dup.blocks[3]!, rot: ((dup.blocks[3]!.rot + 1) % 4) as 0 | 1 | 2 | 3 });
    expect(checkLevel(dup).overlaps.length).toBeGreaterThan(0);
  });
});

describe('share codes', () => {
  it('round-trip a level compactly and reject junk', async () => {
    const lv = getLevel('s3-08')!;
    const code = await encodeLevel(lv);
    expect(code.length).toBeLessThan(JSON.stringify(lv).length / 3);
    const back = await decodeLevel(code);
    expect(back.blocks).toEqual(lv.blocks);
    expect(back.name).toBe(lv.name);
    await expect(decodeLevel('hello')).rejects.toThrow();
    await expect(decodeLevel('z' + code.slice(5))).rejects.toThrow();
    const evil = structuredClone(lv) as TrackJson;
    evil.blocks[0]!.gridPos = [9999, 0, 0];
    await expect(decodeLevel(await encodeLevel(evil))).rejects.toThrow(/outside/);
  });
});

describe('editor validation', () => {
  it('the bot validates a level built in the editor and records an author ghost', async () => {
    const m = build(['straight2', 'straight2', 'curve3L', 'straight2', 'checkpoint', 'straight2', 'curve2R', 'straight2', 'finish', 'straight1']);
    const r = await botRun(m.json, { maxSpeed: 75 }, 60);
    expect(r.finished).toBe(true);
    expect(r.ghost!.time).toBe(r.time);
  });
});
