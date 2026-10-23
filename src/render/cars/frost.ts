import { Group, Mesh, SphereGeometry } from 'three';
import { CarMaterials, CarModel, box, shell, tube } from './parts';

/**
 * Frost: snow buggy. A raised monocoque tub with side panels, an open cockpit inside a full roll cage
 * with a light bar, a front skid bumper, long wishbones out to studded tyres and a rear engine cover.
 * Wheel centres sit at x = +-0.96 / 0.98, z = -1.4 / 1.35, y = -0.25 (the physics layout).
 */
export function buildFrost(m: CarMaterials): CarModel {
  const body = new Group();
  const tub = shell([
    { z: -2.1, w: 0.7, y0: -0.3, y1: -0.12, top: 0.8 },
    { z: -1.85, w: 1.0, y0: -0.36, y1: 0.02, top: 0.82 },
    { z: -1.2, w: 1.16, y0: -0.4, y1: 0.12, top: 0.84 },
    { z: -0.3, w: 1.24, y0: -0.42, y1: 0.16, top: 0.86 },
    { z: 0.7, w: 1.22, y0: -0.42, y1: 0.2, top: 0.84 },
    { z: 1.5, w: 1.08, y0: -0.4, y1: 0.24, top: 0.8 },
    { z: 2.0, w: 0.86, y0: -0.36, y1: 0.18, top: 0.76 },
  ], m.livery, { square: 4.2 });
  // cockpit opening and seat
  const opening = shell([
    { z: -0.75, w: 0.78, y0: 0.08, y1: 0.18 },
    { z: -0.2, w: 0.9, y0: 0.12, y1: 0.2 },
    { z: 0.35, w: 0.84, y0: 0.14, y1: 0.22 },
  ], m.dark, { square: 3 });
  const seat = box(0.46, 0.45, 0.4, m.dark, 0, 0.25, 0.3);
  const helmet = new Mesh(new SphereGeometry(0.15, 18, 12), m.accent);
  helmet.position.set(0, 0.56, 0.12);
  // engine cover behind the cockpit
  const cover = shell([
    { z: 0.55, w: 0.8, y0: 0.16, y1: 0.3, top: 0.8 },
    { z: 1.1, w: 0.86, y0: 0.18, y1: 0.44, top: 0.76 },
    { z: 1.75, w: 0.7, y0: 0.18, y1: 0.36, top: 0.76 },
  ], m.livery, { square: 3.6 });
  // roll cage
  const cage: Mesh[] = [];
  const t = (a: [number, number, number], b: [number, number, number], r = 0.035): void => {
    cage.push(tube(a, b, r, m.dark));
  };
  for (const sx of [-0.5, 0.5]) {
    t([sx, 0.15, -0.75], [sx * 0.88, 0.92, -0.35]);
    t([sx * 0.88, 0.92, -0.35], [sx * 0.88, 0.95, 0.45]);
    t([sx * 0.88, 0.95, 0.45], [sx, 0.2, 0.62]);
    t([sx * 0.88, 0.95, 0.45], [sx * 0.8, 0.3, 1.45]);
  }
  t([-0.44, 0.92, -0.35], [0.44, 0.92, -0.35]);
  t([-0.44, 0.95, 0.45], [0.44, 0.95, 0.45]);
  t([-0.44, 0.95, 0.45], [0.44, 0.92, -0.35], 0.025);
  const lightBar = box(0.92, 0.07, 0.08, m.dark, 0, 1.0, -0.38);
  const lamps = [-0.3, -0.1, 0.1, 0.3].map((x) => box(0.16, 0.05, 0.02, m.head, x, 1.0, -0.43));
  // front skid bumper and wishbones
  const bumper = [tube([-0.55, -0.3, -2.12], [0.55, -0.3, -2.12], 0.04, m.metal), tube([-0.55, -0.3, -2.12], [-0.4, 0.0, -1.9], 0.035, m.metal), tube([0.55, -0.3, -2.12], [0.4, 0.0, -1.9], 0.035, m.metal)];
  const skid = box(0.9, 0.04, 0.5, m.metal, 0, -0.44, -1.75);
  const arms: Mesh[] = [];
  for (const [z, hw] of [[-1.4, 0.82], [1.35, 0.84]] as const) {
    for (const sx of [-1, 1]) {
      arms.push(
        tube([sx * 0.5, -0.1, z - 0.2], [sx * hw, -0.18, z], 0.028, m.dark),
        tube([sx * 0.5, -0.1, z + 0.2], [sx * hw, -0.18, z], 0.028, m.dark),
        tube([sx * 0.52, -0.34, z], [sx * hw, -0.32, z], 0.028, m.dark),
        tube([sx * 0.45, 0.25, z + 0.1], [sx * (hw - 0.05), -0.25, z], 0.04, m.accent),
      );
    }
  }
  const head = box(0.6, 0.05, 0.03, m.head, 0, -0.1, -2.09);
  const tail = box(0.5, 0.05, 0.03, m.tail, 0, 0.12, 2.0);
  body.add(tub, opening, seat, helmet, cover, ...cage, lightBar, ...lamps, ...bumper, skid, ...arms, head, tail);
  return {
    body,
    cockpitHidden: [helmet, seat, ...cage, lightBar, ...lamps, cover],
    tyre: 'studded',
    tyreWidth: 0.4,
    exhaust: [[-0.25, 0.05, 2.02], [0.25, 0.05, 2.02]],
    flame: 'electric',
    plate: { x: 0, y: -0.12, z: 2.0, w: 0.36, h: 0.12 },
  };
}
