import { BLOCKS } from '../tracks/BlockLibrary';
import { placeItem } from '../tracks/ChainLayout';
import { Occupancy, blockCells } from '../tracks/Footprint';
import { BLOCK_TYPE_SET } from '../tracks/BlockLibrary';
import { TrackJson, validateTrackJson } from '../tracks/TrackSchema';

export interface LevelCheck {
  /** Must be fixed before the level can be driven / published. */
  errors: string[];
  /** Worth a look, but drivable. */
  warnings: string[];
  /** Block indices along the driving line, from the start. */
  path: number[];
  /** Track pieces the driving line never reaches. */
  unreachable: number[];
  /** Pairs of blocks that overlap in space. */
  overlaps: Array<[number, number]>;
  finishReachable: boolean;
  checkpoints: number;
}

const RAMPS = new Set(['kicker', 'jumpRamp', 'jumpRampLong']);

/**
 * Static checks for an edited level: the schema, start / finish rules, and a walk along the driving line
 * from the start (following each block's exit; after a jump ramp it looks up to 6 cells ahead and a few
 * levels down for the landing) to see whether the finish can be reached.
 */
export function checkLevel(json: TrackJson): LevelCheck {
  const errors = validateTrackJson(json, BLOCK_TYPE_SET).filter((e) => !e.startsWith('missing name'));
  if (!json.name.trim()) errors.push('give the track a name');
  const warnings: string[] = [];
  const blocks = json.blocks;
  const laps = json.laps ?? 1;
  const starts = blocks.map((b, i) => [b, i] as const).filter(([b]) => b.type === 'start' || b.type === 'lapFinish');
  if (starts.length > 1) errors.push('more than one start');
  if (laps > 1 && !blocks.some((b) => b.type === 'lapFinish')) errors.push('a lap race needs a lap line (start / finish) block');
  if (laps === 1 && blocks.some((b) => b.type === 'lapFinish') && !blocks.some((b) => b.type === 'finish')) warnings.push('a lap line with 1 lap: set laps to 2+ or use Start and Finish');

  // ---- walk the driving line
  const key = (g: [number, number, number], rot: number): string => `${g.join(',')}:${rot}`;
  const byAnchor = new Map<string, number>();
  blocks.forEach((b, i) => {
    if (BLOCKS[b.type]?.chain) byAnchor.set(key(b.gridPos, b.rot), i);
  });
  const path: number[] = [];
  const seen = new Set<number>();
  let finishReachable = false;
  let cur = starts[0]?.[1] ?? -1;
  while (cur >= 0 && !seen.has(cur)) {
    seen.add(cur);
    path.push(cur);
    const b = blocks[cur]!;
    // keep walking past the finish: the run-out after the line is part of the track too
    if (b.type === 'finish') finishReachable = true;
    let next;
    try {
      next = placeItem({ gridPos: b.gridPos, rot: b.rot }, { type: b.type, variant: b.variant }).next;
    } catch {
      break;
    }
    let found = byAnchor.get(key(next.gridPos, next.rot)) ?? -1;
    if (found < 0 && RAMPS.has(b.type)) {
      const ang = (next.rot * Math.PI) / 2;
      const hx = Math.round(-Math.sin(ang)), hz = Math.round(-Math.cos(ang));
      for (let gap = 1; gap <= 6 && found < 0; gap++) {
        for (let dy = 1; dy >= -4 && found < 0; dy--) {
          const g: [number, number, number] = [next.gridPos[0] + hx * gap, next.gridPos[1] + dy, next.gridPos[2] + hz * gap];
          found = byAnchor.get(key(g, next.rot)) ?? -1;
        }
      }
    }
    if (found < 0) {
      // something sits at the exit, facing another way?
      const wrong = blocks.findIndex((x, i) => i !== cur && x.gridPos.join() === next.gridPos.join() && BLOCKS[x.type]?.chain);
      if (wrong >= 0) warnings.push(`block ${wrong + 1} (${BLOCKS[blocks[wrong]!.type]!.label}) faces the wrong way`);
      break;
    }
    // a lap line closes the circuit
    if (blocks[found]!.type === 'lapFinish' && seen.has(found)) {
      finishReachable = true;
      break;
    }
    cur = found;
  }
  if (starts.length && !finishReachable) errors.push(path.length > 1 ? `the track ends after block ${path[path.length - 1]! + 1}: the finish cannot be reached` : 'nothing is connected to the start');
  const unreachable = blocks.map((_, i) => i).filter((i) => BLOCKS[blocks[i]!.type]?.chain && !seen.has(i));
  if (unreachable.length) warnings.push(`${unreachable.length} track piece${unreachable.length > 1 ? 's are' : ' is'} not on the driving line`);

  // ---- overlaps (same column, heights too close)
  const overlaps: Array<[number, number]> = [];
  const cells = blocks.map((b) => (BLOCKS[b.type]?.chain ? blockCells(b) : []));
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (!cells[i]!.length || !cells[j]!.length) continue;
      // neighbours along the line share edge columns
      if (Math.abs(path.indexOf(i) - path.indexOf(j)) === 1 && path.includes(i) && path.includes(j)) continue;
      const occ = new Occupancy(1.2, 1e9);
      occ.add(cells[i]!, 0);
      if (occ.conflicts(cells[j]!, 5)) overlaps.push([i, j]);
    }
  }
  if (overlaps.length) warnings.push(`${overlaps.length} overlapping block pair${overlaps.length > 1 ? 's' : ''}`);
  const checkpoints = blocks.filter((b) => b.type === 'checkpoint').length;
  if (checkpoints === 0 && path.length > 12) warnings.push('no checkpoints: a fall sends players back to the start');
  return { errors, warnings, path, unreachable, overlaps, finishReachable, checkpoints };
}
