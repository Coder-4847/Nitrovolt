import { Quaternion, Vector3 } from 'three';
import { parseSurface } from '../physics/Surface';
import { BLOCKS } from './BlockLibrary';
import { TrackBuilder } from './TrackBuilder';
import { BlockJson, CELL, LEVEL_H, TrackJson, VARIANT_WIDTH } from './TrackSchema';
import { TrackData } from './TrackTypes';

/** World-space entry point (south-edge centre of the anchor cell, rotated by `rot`). */
export function blockEntry(b: BlockJson): { position: Vector3; yawDeg: number } {
  const [gx, gy, gz] = b.gridPos;
  const centre = new Vector3(gx * CELL, gy * LEVEL_H, gz * CELL);
  const ang = (b.rot * Math.PI) / 2;
  // local entry is half a cell behind the anchor centre (+Z), rotated by rot about +Y
  const off = new Vector3(0, 0, CELL / 2).applyAxisAngle(new Vector3(0, 1, 0), ang);
  return { position: centre.add(off), yawDeg: b.rot * 90 };
}

/** Turn level JSON into render meshes, collider meshes, triggers and the spawn pose. */
export function buildTrack(json: TrackJson): TrackData {
  const t = new TrackBuilder();
  json.blocks.forEach((b, i) => {
    const def = BLOCKS[b.type];
    if (!def) throw new Error(`unknown block type "${b.type}" at index ${i}`);
    t.blockId = i;
    const { position, yawDeg } = blockEntry(b);
    t.place(position, yawDeg);
    const { surface, effect } = parseSurface(b.surface ?? 'tarmac');
    def.build(t, {
      width: def.fixedWidth ?? VARIANT_WIDTH[b.variant ?? 'std'],
      surface,
      effect,
      walls: b.walls ?? def.walls,
    });
  });

  const spawn = t.spawn ?? { position: new Vector3(0, 1, 0), quaternion: new Quaternion() };
  let minY = Infinity;
  for (const p of t.centerline) minY = Math.min(minY, p.y);
  if (!isFinite(minY)) minY = 0;
  const m = json.medalTimes;
  return t.finish(json.id, json.name, spawn, minY - 45, {
    car: json.car,
    theme: json.theme,
    seed: json.seed,
    laps: json.laps ?? 1,
    medals: { author: m.author, gold: m.gold, silver: m.silver, bronze: m.bronze },
  });
}
