import { Group } from 'three';
import { CarMaterials, CarModel, box, flare, lamp, mirrored, shell } from './parts';

/**
 * Rally car: a boxy little rally hatchback from the golden era. Square body with big box flares, a near
 * upright windscreen and hatch, a roof scoop and a spoiler over the hatch, a light pod of four spots on
 * the bonnet, mud flaps and gravel tyres.
 * Wheel centres sit at x = +-0.92 / 0.94, z = -1.3 / 1.25, y = -0.35 (the physics layout); the ground is at -0.73.
 */
export function buildGravel(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = shell([
    { z: -1.95, w: 1.6, y0: -0.3, y1: 0.12, top: 0.95, bot: 0.96 },
    { z: -1.78, w: 1.7, y0: -0.32, y1: 0.2, top: 0.96 },
    { z: -1.3, w: 1.72, y0: -0.08, y1: 0.24, top: 0.96 },
    { z: -0.6, w: 1.74, y0: -0.36, y1: 0.28, top: 0.96 },
    { z: 0.6, w: 1.74, y0: -0.36, y1: 0.3, top: 0.96 },
    { z: 1.25, w: 1.74, y0: -0.08, y1: 0.3, top: 0.96 },
    { z: 1.72, w: 1.7, y0: -0.3, y1: 0.28, top: 0.95 },
    { z: 1.88, w: 1.62, y0: -0.28, y1: 0.24, top: 0.94 },
  ], m.livery, { square: 6, ring: 40 });
  // cabin: steep screen, flat roof, near-vertical hatch
  const cabin = shell([
    { z: -0.75, w: 1.52, y0: 0.26, y1: 0.3, top: 0.92 },
    { z: -0.35, w: 1.48, y0: 0.26, y1: 0.84, top: 0.84 },
    { z: 1.25, w: 1.48, y0: 0.26, y1: 0.86, top: 0.84 },
    { z: 1.7, w: 1.5, y0: 0.26, y1: 0.4, top: 0.9 },
  ], m.glass, { square: 6 });
  const roof = shell([
    { z: -0.3, w: 1.38, y0: 0.8, y1: 0.88, top: 0.86 },
    { z: 1.25, w: 1.38, y0: 0.82, y1: 0.9, top: 0.86 },
  ], m.livery, { square: 5 });
  const pillar = box(0.06, 0.52, 0.1, m.paint, 0.71, 0.56, 0.42);
  const scoop = box(0.42, 0.1, 0.4, m.dark, 0, 0.94, 0.1);
  const wing = box(1.4, 0.04, 0.3, m.paint, 0, 0.96, 1.42);
  const wingPlates = [-0.7, 0.7].map((x) => box(0.03, 0.16, 0.34, m.dark, x, 0.9, 1.42));
  // big square box flares
  const flares = [
    flare(0.46, 0.34, 0.08, m.livery, 0.88, -0.35, -1.3), flare(0.46, 0.34, 0.08, m.livery, -0.88, -0.35, -1.3),
    flare(0.46, 0.36, 0.08, m.livery, 0.9, -0.35, 1.25), flare(0.46, 0.36, 0.08, m.livery, -0.9, -0.35, 1.25),
  ];
  // light pod on the bonnet, grille, bumpers, tail lights, mud flaps
  const pod = box(1.0, 0.18, 0.08, m.dark, 0, 0.32, -1.72);
  const spots = [-0.36, -0.12, 0.12, 0.36].map((x) => lamp(0.075, m.head, x, 0.32, -1.76));
  const grille = box(1.0, 0.16, 0.03, m.dark, 0, -0.02, -1.95);
  const heads = [-0.62, 0.62].map((x) => box(0.24, 0.12, 0.03, m.head, x, 0.04, -1.95));
  const bumperF = box(1.72, 0.18, 0.16, m.dark, 0, -0.24, -1.99);
  const bumperR = box(1.7, 0.16, 0.14, m.dark, 0, -0.22, 1.92);
  const tails = [-0.62, 0.62].map((x) => box(0.26, 0.14, 0.03, m.tail, x, 0.12, 1.9));
  const flaps = [-0.82, 0.82].map((x) => box(0.3, 0.34, 0.02, m.dark, x, -0.46, 1.68));
  const flapsF = [-0.82, 0.82].map((x) => box(0.28, 0.26, 0.02, m.dark, x, -0.46, -0.85));
  const mirrorL = box(0.12, 0.09, 0.08, m.dark, 0.82, 0.42, -0.6);
  body.add(hull, cabin, roof, pillar, mirrored(pillar), scoop, wing, ...wingPlates, ...flares, pod, ...spots, grille, ...heads, bumperF, bumperR, ...tails, ...flaps, ...flapsF, mirrorL, mirrored(mirrorL));
  return {
    body,
    cockpitHidden: [cabin, roof, pillar, scoop, wing, ...wingPlates, mirrorL],
    tyre: 'knobby',
    tyreWidth: 0.3,
    exhaust: [[0.55, -0.26, 1.96]],
    flame: 'fire',
    plate: { x: 0, y: -0.04, z: 1.885, w: 0.4, h: 0.14 },
  };
}
