import { Mesh, MeshBasicMaterial, PlaneGeometry, Group } from 'three';
import { CarMaterials, CarModel, box, flare, lamp, mirrored, plateTexture, shell } from './parts';

/**
 * Snow car: a stubby little pickup on big chunky tyres. A short bonnet, an upright two-seat cab with a
 * light bar on the roof, a short open bed with a tailgate, black bumpers and fender flares, round
 * headlights and a number plate in the grille.
 * Wheel centres sit at x = +-0.96 / 0.98, z = -1.4 / 1.35, y = -0.25 (the physics layout); the ground is at -0.62.
 */
export function buildFrost(m: CarMaterials): CarModel {
  const body = new Group();
  // lower body: one boxy shell from bumper to bumper, with a slight wedge to the bonnet
  const lower = shell([
    { z: -2.0, w: 1.56, y0: -0.3, y1: 0.18, top: 0.96, bot: 0.96 },
    { z: -1.8, w: 1.66, y0: -0.34, y1: 0.3, top: 0.96 },
    { z: -0.8, w: 1.68, y0: -0.36, y1: 0.36, top: 0.97 },
    { z: 0.6, w: 1.68, y0: -0.36, y1: 0.36, top: 0.97 },
    { z: 1.8, w: 1.66, y0: -0.34, y1: 0.34, top: 0.97 },
    { z: 2.02, w: 1.6, y0: -0.3, y1: 0.3, top: 0.96 },
  ], m.livery, { square: 6, ring: 36 });
  // cab: upright, slightly tapered
  const cab = shell([
    { z: -0.72, w: 1.56, y0: 0.3, y1: 0.36, top: 0.94 },
    { z: -0.6, w: 1.56, y0: 0.3, y1: 0.98, top: 0.86 },
    { z: 0.32, w: 1.56, y0: 0.3, y1: 1.02, top: 0.86 },
    { z: 0.46, w: 1.56, y0: 0.3, y1: 0.98, top: 0.88 },
  ], m.paint, { square: 6 });
  // glass: windscreen and side windows, slightly proud of the cab
  const screen = box(1.3, 0.48, 0.03, m.glass, 0, 0.7, -0.66);
  screen.rotation.x = -0.18;
  const side = box(0.03, 0.4, 0.78, m.glass, 0.77, 0.72, -0.12);
  const rear = box(1.24, 0.34, 0.03, m.glass, 0, 0.76, 0.47);
  // bed: walls, tailgate and a dark floor
  const bedFloor = box(1.44, 0.04, 1.38, m.dark, 0, 0.34, 1.22);
  const wall = box(0.07, 0.3, 1.5, m.paint, 0.8, 0.5, 1.22);
  const gate = box(1.6, 0.3, 0.07, m.paint, 0, 0.5, 1.98);
  const rollBar = [box(0.06, 0.34, 0.06, m.dark, 0.7, 0.64, 0.56), box(0.06, 0.34, 0.06, m.dark, -0.7, 0.64, 0.56), box(1.46, 0.06, 0.06, m.dark, 0, 0.8, 0.56)];
  // roof light bar
  const bar = box(1.2, 0.1, 0.16, m.dark, 0, 1.07, -0.3);
  const barLamps = [-0.42, -0.14, 0.14, 0.42].map((x) => lamp(0.045, m.head, x, 1.07, -0.38));
  // bumpers, grille and plate, lamps
  const bumperF = box(1.74, 0.22, 0.2, m.dark, 0, -0.22, -2.06);
  const bumperR = box(1.74, 0.2, 0.18, m.dark, 0, -0.22, 2.06);
  const grille = box(0.9, 0.3, 0.03, m.dark, 0, 0.04, -2.02);
  const plateMesh = new Mesh(new PlaneGeometry(0.34, 0.13), new MeshBasicMaterial({ map: plateTexture('01') }));
  plateMesh.rotation.y = Math.PI; // facing forward
  plateMesh.position.set(0, -0.2, -2.165);
  const heads = [-0.6, 0.6].map((x) => lamp(0.11, m.head, x, 0.06, -2.02));
  const tails = [-0.66, 0.66].map((x) => box(0.16, 0.12, 0.03, m.tail, x, 0.2, 2.03));
  // fender flares over all four wheels
  const flares = [
    flare(0.47, 0.42, 0.08, m.dark, 0.9, -0.25, -1.4), flare(0.47, 0.42, 0.08, m.dark, -0.9, -0.25, -1.4),
    flare(0.47, 0.42, 0.08, m.dark, 0.92, -0.25, 1.35), flare(0.47, 0.42, 0.08, m.dark, -0.92, -0.25, 1.35),
  ];
  const mirrorL = box(0.14, 0.12, 0.06, m.dark, 0.86, 0.66, -0.56);
  const skid = box(1.2, 0.04, 0.5, m.metal, 0, -0.36, -1.75);
  body.add(lower, cab, screen, side, mirrored(side), rear, bedFloor, wall, mirrored(wall), gate, ...rollBar, bar, ...barLamps,
    bumperF, bumperR, grille, plateMesh, ...heads, ...tails, ...flares, mirrorL, mirrored(mirrorL), skid);
  return {
    body,
    cockpitHidden: [cab, screen, side, rear, bar, ...barLamps, ...rollBar],
    tyre: 'studded',
    tyreWidth: 0.4,
    exhaust: [[0.5, -0.3, 2.08]],
    flame: 'fire',
    plate: { x: 0, y: 0.5, z: 2.02, w: 0.44, h: 0.15 },
  };
}
