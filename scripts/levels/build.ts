// Turns a level definition into level JSON and its built track, and checks the layout for overlaps.
import { BLOCK_TYPE_SET } from '../../src/tracks/BlockLibrary';
import { layoutChain } from '../../src/tracks/ChainLayout';
import { TrackJson, validateTrackJson } from '../../src/tracks/TrackSchema';
import { buildTrack } from '../../src/tracks/TrackGenerator';
import { TrackData } from '../../src/tracks/TrackTypes';
import { LevelDef } from './dsl';

export interface Built {
  def: LevelDef;
  json: TrackJson;
  track: TrackData;
  /** Places where two stretches of road run into each other (x, y, z), empty when the layout is clean. */
  overlaps: Array<[number, number, number]>;
  /** Driving length (m), jump gaps excluded. */
  length: number;
}

const hashSeed = (id: string): number => [...id].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

export function buildLevel(def: LevelDef): Built {
  const { blocks, next } = layoutChain(def.items, def.start);
  const json: TrackJson = {
    id: def.id,
    name: def.name,
    car: def.car,
    theme: def.theme,
    seed: hashSeed(def.id) % 100000,
    laps: def.laps ?? 1,
    blocks,
    medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
  };
  if ((def.laps ?? 1) > 1) {
    const s = def.start ?? { gridPos: [0, 0, 0], rot: 0 };
    if (next.gridPos.join() !== s.gridPos.join() || next.rot !== s.rot) throw new Error(`${def.id}: circuit does not close (ends at ${next.gridPos} rot ${next.rot})`);
  }
  const errs = validateTrackJson(json, BLOCK_TYPE_SET);
  if (errs.length) throw new Error(`${def.id}: ${errs.join('; ')}`);
  const track = buildTrack(json);
  return { def, json, track, overlaps: findOverlaps(track, (def.laps ?? 1) > 1), length: drivingLength(track) };
}

function drivingLength(t: TrackData): number {
  let d = 0;
  for (let i = 1; i < t.centerline.length; i++) if (t.centerFrame[i]!.kind !== 'gap') d += t.centerline[i]!.distanceTo(t.centerline[i - 1]!);
  return d;
}

/** Road that runs into other road (closer than both half widths, less than a level apart, far apart along the path). */
function findOverlaps(t: TrackData, closed: boolean): Array<[number, number, number]> {
  const c = t.centerline, f = t.centerFrame;
  const s: number[] = [0];
  for (let i = 1; i < c.length; i++) s.push(s[i - 1]! + c[i]!.distanceTo(c[i - 1]!));
  const cell = 24;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < c.length; i++) {
    const k = `${Math.floor(c[i]!.x / cell)},${Math.floor(c[i]!.z / cell)}`;
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(i);
  }
  const out: Array<[number, number, number]> = [];
  const seen = new Set<string>();
  for (let i = 0; i < c.length; i++) {
    if (f[i]!.kind === 'gap') continue;
    const p = c[i]!;
    const gx = Math.floor(p.x / cell), gz = Math.floor(p.z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const j of grid.get(`${gx + a},${gz + b}`) ?? []) {
        if (j <= i || f[j]!.kind === 'gap') continue;
        const q = c[j]!;
        const reach = f[i]!.hw + f[j]!.hw;
        if (s[j]! - s[i]! < reach * 2 + 40) continue;
        // a circuit's end runs back into its start
        if (closed && s[i]! < 80 && s[s.length - 1]! - s[j]! < 80) continue;
        if (Math.abs(q.y - p.y) > 7) continue;
        if (Math.hypot(q.x - p.x, q.z - p.z) > reach - 0.5) continue;
        const key = `${Math.round(p.x / 16)},${Math.round(p.z / 16)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([p.x, p.y, p.z]);
      }
    }
  }
  return out;
}
