import { Group } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Frost: tall electric pickup. Squared-off hull with flared arches, a crew cab with a painted roof and
 * rack, a lined bed, a full-width light bar front and rear, skid plate and studded tyres.
 */
export function buildFrost(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = shell([
    { z: -2.2, w: 1.84, y0: -0.43, y1: 0.02, bot: 0.92, top: 0.9 },
    { z: -2.1, w: 2.04, y0: -0.45, y1: 0.24, bot: 0.9, top: 0.93 },
    { z: -1.75, w: 2.1, y0: -0.45, y1: 0.32, bot: 0.86, top: 0.95 },
    { z: -1.4, w: 2.14, y0: -0.45, y1: 0.36, bot: 0.74, top: 0.95 },
    { z: -1.0, w: 2.08, y0: -0.45, y1: 0.38, bot: 0.86, top: 0.95 },
    { z: 0.0, w: 2.04, y0: -0.46, y1: 0.42, bot: 0.95, top: 0.95 },
    { z: 1.0, w: 2.08, y0: -0.45, y1: 0.44, bot: 0.86, top: 0.95 },
    { z: 1.35, w: 2.14, y0: -0.45, y1: 0.44, bot: 0.74, top: 0.95 },
    { z: 1.8, w: 2.1, y0: -0.43, y1: 0.44, bot: 0.86, top: 0.95 },
    { z: 2.14, w: 2.06, y0: -0.39, y1: 0.42, bot: 0.9, top: 0.94 },
    { z: 2.22, w: 1.94, y0: -0.34, y1: 0.36, bot: 0.9, top: 0.92 },
  ], m.paint, { square: 6 });
  const cabin = shell([
    { z: -0.95, w: 1.9, y0: 0.3, y1: 0.4, top: 0.88 },
    { z: -0.55, w: 1.88, y0: 0.32, y1: 0.92, top: 0.84 },
    { z: 0.2, w: 1.86, y0: 0.34, y1: 1.02, top: 0.84 },
    { z: 0.62, w: 1.86, y0: 0.36, y1: 1.0, top: 0.84 },
    { z: 0.76, w: 1.84, y0: 0.38, y1: 0.62, top: 0.86 },
  ], m.glass, { square: 6 });
  const roof = shell([
    { z: -0.48, w: 1.36, y0: 0.9, y1: 0.93 },
    { z: 0.2, w: 1.5, y0: 1.0, y1: 1.035 },
    { z: 0.6, w: 1.5, y0: 0.98, y1: 1.015 },
  ], m.paint, { square: 6 });
  const liner = box(1.78, 0.02, 1.3, m.dark, 0, 0.45, 1.5);
  const rails = [-0.92, 0.92].map((x) => box(0.08, 0.06, 1.38, m.dark, x, 0.47, 1.5));
  const rack = [-0.1, 0.4].map((z) => box(1.5, 0.04, 0.05, m.dark, 0, 1.1, z));
  const rackRails = [-0.7, 0.7].map((x) => box(0.05, 0.05, 0.8, m.dark, x, 1.08, 0.15));
  const lightBar = box(1.9, 0.05, 0.05, m.head, 0, 0.27, -2.13);
  const roofLamp = box(1.2, 0.05, 0.08, m.head, 0, 1.12, -0.38);
  const skid = box(1.4, 0.06, 0.7, m.metal, 0, -0.47, -1.8);
  const tow = box(0.5, 0.12, 0.12, m.dark, 0, -0.3, 2.25);
  const tail = box(1.84, 0.05, 0.04, m.tail, 0, 0.3, 2.225);
  const step = box(0.18, 0.04, 1.4, m.dark, 1.0, -0.36, -0.1);
  const flare = box(0.08, 0.1, 1.05, m.dark, 1.06, 0.2, -1.4);
  const flareR = box(0.08, 0.1, 1.05, m.dark, 1.06, 0.26, 1.35);
  const antenna = tube([0.75, 1.03, 0.55], [0.75, 1.45, 0.62], 0.012, m.dark);
  body.add(hull, cabin, roof, liner, ...rails, ...rack, ...rackRails, lightBar, roofLamp, skid, tow, tail, step, mirrored(step), flare, mirrored(flare), flareR, mirrored(flareR), antenna);
  return { body, cockpitHidden: [cabin, roof, ...rack, ...rackRails, roofLamp, antenna], tyre: 'studded', tyreWidth: 0.4, exhaust: [[-0.45, -0.36, 2.2], [0.45, -0.36, 2.2]], flame: 'electric' };
}
