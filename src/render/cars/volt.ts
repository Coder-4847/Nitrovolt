import { Group } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell } from './parts';

/**
 * Volt: low electric sports coupe. Long sculpted hull with front and rear haunches over the wheels,
 * a teardrop glass cabin, full-width light bars and a small ducktail.
 */
export function buildVolt(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = shell([
    { z: -2.14, w: 1.36, y0: -0.38, y1: -0.2, bot: 0.92, top: 0.8 },
    { z: -2.02, w: 1.76, y0: -0.43, y1: -0.07, bot: 0.92, top: 0.85 },
    { z: -1.72, w: 1.92, y0: -0.45, y1: 0.05, bot: 0.86, top: 0.88 },
    { z: -1.35, w: 1.96, y0: -0.45, y1: 0.13, bot: 0.76, top: 0.9 },
    { z: -0.98, w: 1.94, y0: -0.45, y1: 0.14, bot: 0.84, top: 0.9 },
    { z: -0.45, w: 1.86, y0: -0.46, y1: 0.16, bot: 0.96, top: 0.88 },
    { z: 0.35, w: 1.9, y0: -0.46, y1: 0.2, bot: 0.96, top: 0.88 },
    { z: 0.92, w: 1.98, y0: -0.45, y1: 0.24, bot: 0.86, top: 0.9 },
    { z: 1.3, w: 2.0, y0: -0.44, y1: 0.25, bot: 0.76, top: 0.9 },
    { z: 1.74, w: 1.96, y0: -0.42, y1: 0.23, bot: 0.86, top: 0.88 },
    { z: 2.04, w: 1.82, y0: -0.37, y1: 0.18, bot: 0.9, top: 0.85 },
    { z: 2.14, w: 1.58, y0: -0.3, y1: 0.1, bot: 0.9, top: 0.8 },
  ], m.paint);
  const cabin = shell([
    { z: -0.98, w: 1.5, y0: 0.02, y1: 0.13, top: 0.8 },
    { z: -0.55, w: 1.46, y0: 0.05, y1: 0.4, top: 0.72 },
    { z: -0.05, w: 1.42, y0: 0.08, y1: 0.55, top: 0.68 },
    { z: 0.5, w: 1.38, y0: 0.1, y1: 0.5, top: 0.68 },
    { z: 1.05, w: 1.3, y0: 0.13, y1: 0.35, top: 0.72 },
    { z: 1.5, w: 1.1, y0: 0.15, y1: 0.24, top: 0.75 },
  ], m.glass);
  const ducktail = shell([
    { z: 1.78, w: 1.5, y0: 0.2, y1: 0.24 },
    { z: 2.0, w: 1.62, y0: 0.2, y1: 0.29 },
    { z: 2.1, w: 1.5, y0: 0.22, y1: 0.28 },
  ], m.paint, { square: 6 });
  const splitter = box(1.72, 0.04, 0.32, m.dark, 0, -0.43, -1.98);
  const diffuser = box(1.6, 0.12, 0.3, m.dark, 0, -0.38, 2.0);
  const fins = [-0.45, 0, 0.45].map((x) => box(0.03, 0.12, 0.28, m.accent, x, -0.38, 2.0));
  const skirt = box(0.04, 0.06, 1.9, m.accent, 0.95, -0.4, -0.05);
  const head = box(1.36, 0.035, 0.04, m.head, 0, -0.12, -2.075);
  const tail = box(1.5, 0.05, 0.04, m.tail, 0, 0.02, 2.135);
  const mirror = box(0.14, 0.07, 0.16, m.paint, 0.8, 0.22, -0.5);
  const mirrors = [mirror, mirrored(mirror)];
  body.add(hull, cabin, ducktail, splitter, diffuser, ...fins, skirt, mirrored(skirt), head, tail, ...mirrors);
  return { body, cockpitHidden: [cabin, ...mirrors], tyre: 'sport', tyreWidth: 0.32, exhaust: [[-0.5, -0.33, 2.15], [0.5, -0.33, 2.15]], flame: 'electric' };
}
