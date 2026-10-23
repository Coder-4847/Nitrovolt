import { Group } from 'three';
import { CarMaterials, CarModel, box, flare, lamp, mirrored, shell } from './parts';

/**
 * Desert car: a lifted muscle coupe. A long bonnet with a scoop, a fastback cabin, wide hips over the rear
 * wheels, chrome bumpers and round headlights, flared arches over big off-road tyres (rear wider).
 * Wheel centres sit at x = +-0.98 / 1.02, z = -1.3 / 1.2, y = -0.38 (the physics layout); the ground is at -0.8.
 */
export function buildDune(m: CarMaterials): CarModel {
  const body = new Group();
  // the body rides high: its lower edge lifts over the wheels so the tyres show under the arches
  const hull = shell([
    { z: -2.12, w: 1.6, y0: -0.2, y1: 0.12, top: 0.94, bot: 0.96 },
    { z: -1.9, w: 1.72, y0: -0.2, y1: 0.2, top: 0.95 },
    { z: -1.3, w: 1.76, y0: -0.02, y1: 0.22, top: 0.96 },
    { z: -0.6, w: 1.78, y0: -0.3, y1: 0.24, top: 0.96 },
    { z: 0.3, w: 1.8, y0: -0.3, y1: 0.25, top: 0.96 },
    { z: 1.2, w: 1.88, y0: -0.02, y1: 0.28, top: 0.95 },
    { z: 1.85, w: 1.82, y0: -0.18, y1: 0.26, top: 0.94 },
    { z: 2.08, w: 1.68, y0: -0.18, y1: 0.2, top: 0.94 },
  ], m.livery, { square: 5, ring: 40 });
  // fastback cabin (glass) with a painted roof
  const cabin = shell([
    { z: -0.58, w: 1.46, y0: 0.2, y1: 0.24, top: 0.9 },
    { z: -0.2, w: 1.42, y0: 0.2, y1: 0.66, top: 0.74 },
    { z: 0.5, w: 1.4, y0: 0.2, y1: 0.7, top: 0.74 },
    { z: 1.25, w: 1.4, y0: 0.2, y1: 0.46, top: 0.8 },
    { z: 1.9, w: 1.42, y0: 0.2, y1: 0.28, top: 0.86 },
  ], m.glass, { square: 4.4 });
  const roof = shell([
    { z: -0.12, w: 1.28, y0: 0.62, y1: 0.68, top: 0.8 },
    { z: 0.5, w: 1.26, y0: 0.66, y1: 0.72, top: 0.8 },
    { z: 1.0, w: 1.24, y0: 0.52, y1: 0.6, top: 0.82 },
  ], m.paint, { square: 4 });
  const scoop = box(0.5, 0.12, 0.6, m.dark, 0, 0.27, -1.15);
  const scoopMouth = box(0.4, 0.07, 0.03, m.metal, 0, 0.28, -1.45);
  const spoiler = box(1.6, 0.04, 0.24, m.dark, 0, 0.36, 1.95);
  const spoilerLegs = [-0.6, 0.6].map((x) => box(0.05, 0.1, 0.06, m.dark, x, 0.3, 1.95));
  // chrome bumpers, round headlights, tail lights
  const bumperF = box(1.76, 0.12, 0.14, m.chrome, 0, -0.12, -2.16);
  const bumperR = box(1.76, 0.12, 0.14, m.chrome, 0, -0.1, 2.12);
  const grille = box(1.1, 0.2, 0.03, m.dark, 0, -0.0, -2.12);
  const heads = [-0.66, -0.42, 0.42, 0.66].map((x) => lamp(0.085, m.head, x, 0.0, -2.12));
  const tails = [-0.62, 0.62].map((x) => box(0.38, 0.09, 0.03, m.tail, x, 0.08, 2.09));
  // arches
  const flares = [
    flare(0.5, 0.38, 0.07, m.livery, 0.92, -0.38, -1.3), flare(0.5, 0.38, 0.07, m.livery, -0.92, -0.38, -1.3),
    flare(0.52, 0.46, 0.08, m.livery, 0.98, -0.38, 1.2), flare(0.52, 0.46, 0.08, m.livery, -0.98, -0.38, 1.2),
  ];
  const sill = box(0.06, 0.08, 1.4, m.dark, 0.9, -0.26, -0.05);
  const mirrorL = box(0.12, 0.08, 0.1, m.chrome, 0.78, 0.34, -0.5);
  body.add(hull, cabin, roof, scoop, scoopMouth, spoiler, ...spoilerLegs, bumperF, bumperR, grille, ...heads, ...tails, ...flares,
    sill, mirrored(sill), mirrorL, mirrored(mirrorL));
  return {
    body,
    cockpitHidden: [cabin, roof, scoop, scoopMouth, mirrorL],
    tyre: 'knobby',
    tyreWidth: 0.4,
    exhaust: [[-0.5, -0.2, 2.14], [0.5, -0.2, 2.14]],
    flame: 'fire',
    plate: { x: 0, y: -0.02, z: 2.09, w: 0.42, h: 0.14 },
  };
}
