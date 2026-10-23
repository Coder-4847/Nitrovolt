import { CylinderGeometry, Group, Mesh } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Dune: desert trophy truck. A short hood and crew cab over big flared fenders, an open bed with a spare
 * wheel, an exposed cage behind the cab, a roof light bar, long-travel arms and balloon tyres.
 * Wheel centres sit at x = +-0.98 / 1.02, z = -1.3 / 1.2, y = -0.38 (the physics layout).
 */
export function buildDune(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = shell([
    { z: -2.2, w: 1.6, y0: -0.3, y1: 0.0, bot: 0.9, top: 0.84 },
    { z: -2.05, w: 2.0, y0: -0.34, y1: 0.12, bot: 0.86, top: 0.9 },
    { z: -1.65, w: 2.16, y0: -0.34, y1: 0.18, bot: 0.74, top: 0.92 },
    { z: -1.3, w: 2.18, y0: -0.32, y1: 0.22, bot: 0.66, top: 0.92 },
    { z: -0.9, w: 2.06, y0: -0.34, y1: 0.24, bot: 0.82, top: 0.92 },
    { z: -0.2, w: 1.92, y0: -0.36, y1: 0.28, bot: 0.94, top: 0.92 },
    { z: 0.6, w: 2.04, y0: -0.34, y1: 0.3, bot: 0.84, top: 0.94 },
    { z: 1.2, w: 2.2, y0: -0.32, y1: 0.3, bot: 0.66, top: 0.94 },
    { z: 1.75, w: 2.12, y0: -0.32, y1: 0.28, bot: 0.8, top: 0.94 },
    { z: 2.1, w: 1.94, y0: -0.3, y1: 0.24, bot: 0.88, top: 0.92 },
  ], m.livery, { square: 5 });
  const cab = shell([
    { z: -0.95, w: 1.7, y0: 0.2, y1: 0.3, top: 0.86 },
    { z: -0.6, w: 1.66, y0: 0.24, y1: 0.86, top: 0.78 },
    { z: 0.15, w: 1.62, y0: 0.26, y1: 0.92, top: 0.78 },
    { z: 0.42, w: 1.6, y0: 0.28, y1: 0.6, top: 0.8 },
  ], m.glass, { square: 5 });
  const roof = shell([
    { z: -0.55, w: 1.2, y0: 0.84, y1: 0.87 },
    { z: 0.12, w: 1.26, y0: 0.9, y1: 0.935 },
  ], m.livery, { square: 5 });
  const bedFloor = box(1.6, 0.04, 1.4, m.dark, 0, 0.29, 1.35);
  const spare = new Mesh(new CylinderGeometry(0.36, 0.36, 0.3, 20).rotateX(Math.PI / 2).rotateX(Math.PI / 2), m.dark);
  spare.position.set(0, 0.48, 1.45);
  spare.rotation.x = 0.0;
  const cage: Mesh[] = [];
  const t = (a: [number, number, number], b: [number, number, number], r = 0.035): void => {
    cage.push(tube(a, b, r, m.dark));
  };
  for (const sx of [-0.7, 0.7]) {
    t([sx, 0.3, 0.6], [sx, 0.95, 0.5]);
    t([sx, 0.95, 0.5], [sx * 0.9, 0.35, 2.0]);
  }
  t([-0.7, 0.95, 0.5], [0.7, 0.95, 0.5]);
  t([-0.65, 0.66, 1.2], [0.65, 0.66, 1.2]);
  const lightBar = box(1.3, 0.08, 0.1, m.dark, 0, 0.98, -0.4);
  const lamps = [-0.45, -0.15, 0.15, 0.45].map((x) => box(0.2, 0.06, 0.02, m.head, x, 0.98, -0.46));
  const bumper = box(1.7, 0.12, 0.14, m.metal, 0, -0.26, -2.22);
  const grille = box(1.1, 0.16, 0.03, m.dark, 0, -0.06, -2.2);
  const head = [-0.6, 0.6].map((x) => box(0.32, 0.06, 0.03, m.head, x, 0.04, -2.12));
  const tail = [-0.8, 0.8].map((x) => box(0.08, 0.3, 0.03, m.tail, x, 0.06, 2.12));
  const arms: Mesh[] = [];
  for (const [z, hw] of [[-1.3, 0.82], [1.2, 0.86]] as const) {
    for (const sx of [-1, 1]) {
      arms.push(
        tube([sx * 0.45, -0.2, z - 0.25], [sx * hw, -0.32, z], 0.035, m.dark),
        tube([sx * 0.45, -0.2, z + 0.25], [sx * hw, -0.32, z], 0.035, m.dark),
        tube([sx * 0.5, 0.15, z], [sx * (hw - 0.05), -0.3, z], 0.05, m.accent),
      );
    }
  }
  const mirror = box(0.14, 0.1, 0.06, m.dark, 0.9, 0.5, -0.6);
  body.add(hull, cab, roof, bedFloor, spare, ...cage, lightBar, ...lamps, bumper, grille, ...head, ...tail, ...arms, mirror, mirrored(mirror));
  return {
    body,
    cockpitHidden: [cab, roof, lightBar, ...lamps, ...cage, mirror],
    tyre: 'balloon',
    tyreWidth: 0.46,
    exhaust: [[0.55, -0.2, 2.14]],
    flame: 'fire',
    plate: { x: 0, y: 0.06, z: 2.12, w: 0.4, h: 0.13 },
  };
}
