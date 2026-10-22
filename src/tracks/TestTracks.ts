import { Vector3 } from 'three';
import { TrackBuilder } from './TrackBuilder';
import { TrackData } from './TrackTypes';
import { SurfaceId } from '../physics/Surface';

/** Huge flat slab for physics tests and tuning. Start at the south end facing north. */
export function buildFlatPad(length = 1200, width = 1200, surface: SurfaceId = 'tarmac'): TrackData {
  const t = new TrackBuilder();
  t.place(new Vector3(0, 0, length * 0.25), 0);
  const probe = new TrackBuilder();
  probe.place(new Vector3(0, 0, 0), 0);
  const start = probe.pose();
  t.straight(length, { width, step: 100, thickness: 2, surface });
  return t.finish('flatpad', 'Flat Pad', start, -50);
}
