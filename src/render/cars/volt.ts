import { Group, Mesh, SphereGeometry } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Stadium car: a low open-wheeler on big, fat tyres. A wide shovel nose with a splitter between the front
 * wheels, a slim cockpit with the driver's helmet and an air intake above it, sculpted sidepods, and a
 * boxy tail between the rear wheels carrying the race number on its deck and the digital speed display
 * between two LED strips at the back.
 * Wheel centres sit at x = +-0.9 / 0.92, z = -1.35 / 1.3, y = -0.25 (the physics layout); the ground is at -0.59.
 */
export function buildVolt(m: CarMaterials): CarModel {
  const body = new Group();
  // monocoque: shovel nose -> narrow waist between the front wheels -> cockpit -> engine hump -> tail box
  const tub = shell([
    { z: -2.04, w: 1.22, y0: -0.47, y1: -0.37, top: 0.94, bot: 0.98 },
    { z: -1.88, w: 1.3, y0: -0.49, y1: -0.26, top: 0.86 },
    { z: -1.6, w: 0.98, y0: -0.5, y1: -0.14, top: 0.8 },
    { z: -1.1, w: 0.82, y0: -0.5, y1: -0.02, top: 0.76 },
    { z: -0.55, w: 0.9, y0: -0.5, y1: 0.08, top: 0.76 },
    { z: 0.05, w: 0.96, y0: -0.5, y1: 0.14, top: 0.72 },
    { z: 0.55, w: 1.0, y0: -0.5, y1: 0.3, top: 0.66 },
    { z: 1.0, w: 1.22, y0: -0.49, y1: 0.3, top: 0.72 },
    { z: 1.45, w: 1.36, y0: -0.48, y1: 0.26, top: 0.86 },
    { z: 1.84, w: 1.34, y0: -0.46, y1: 0.22, top: 0.9 },
  ], m.livery, { square: 3.8, ring: 40 });
  // sidepods: swept back from intakes behind the front wheels, tucking in before the rear wheels
  const pod = shell([
    { z: -0.82, w: 0.34, y0: -0.48, y1: -0.14, bot: 0.98, top: 0.82 },
    { z: -0.48, w: 0.56, y0: -0.49, y1: 0.0, bot: 0.98, top: 0.8 },
    { z: 0.3, w: 0.58, y0: -0.49, y1: 0.04, bot: 0.98, top: 0.78 },
    { z: 0.88, w: 0.4, y0: -0.48, y1: -0.04, bot: 0.98, top: 0.8 },
  ], m.livery, { square: 3.4 });
  pod.position.x = 0.52;
  const intake = shell([
    { z: -0.84, w: 0.3, y0: -0.42, y1: -0.12 },
    { z: -0.8, w: 0.3, y0: -0.42, y1: -0.12 },
  ], m.dark, { square: 3 });
  intake.position.x = 0.54;
  // splitter and front wing between the front wheels, with endplates
  const splitter = box(1.7, 0.035, 0.44, m.carbon, 0, -0.51, -1.84);
  const flap = box(1.5, 0.03, 0.16, m.dark, 0, -0.43, -1.7);
  flap.rotation.x = -0.3;
  const plate = box(0.035, 0.18, 0.46, m.livery, 0.85, -0.44, -1.82);
  // cockpit: dark rim, windscreen, driver, and the intake above the helmet
  const rim = shell([
    { z: -0.62, w: 0.5, y0: 0.0, y1: 0.08 },
    { z: -0.2, w: 0.6, y0: 0.05, y1: 0.13 },
    { z: 0.22, w: 0.56, y0: 0.09, y1: 0.17 },
  ], m.dark, { square: 2.6 });
  const screen = box(0.46, 0.12, 0.03, m.glass, 0, 0.08, -0.62);
  screen.rotation.x = -0.5;
  const helmet = new Mesh(new SphereGeometry(0.15, 22, 16), m.accent);
  helmet.position.set(0, 0.2, -0.05);
  const visor = new Mesh(new SphereGeometry(0.153, 22, 8, -Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.32, Math.PI * 0.2), m.glass);
  visor.position.copy(helmet.position);
  const scoop = shell([
    { z: 0.22, w: 0.24, y0: 0.14, y1: 0.38, top: 0.7 },
    { z: 0.45, w: 0.28, y0: 0.16, y1: 0.42, top: 0.7 },
    { z: 0.95, w: 0.2, y0: 0.2, y1: 0.28, top: 0.7 },
  ], m.livery, { square: 3 });
  const scoopMouth = box(0.2, 0.18, 0.03, m.dark, 0, 0.3, 0.215);
  const fin = box(0.025, 0.14, 0.6, m.livery, 0, 0.36, 1.15);
  // tail: a lip spoiler over the back, the dark rear panel with the speed display and LED strips, diffuser fins
  const lip = box(1.32, 0.035, 0.22, m.livery, 0, 0.25, 1.76);
  lip.rotation.x = 0.18;
  const back = box(1.22, 0.5, 0.04, m.dark, 0, -0.16, 1.85);
  const leds = [-0.4, 0.4].map((x) => box(0.3, 0.035, 0.02, m.led, x, 0.06, 1.875));
  const tails = [-0.56, 0.56].map((x) => box(0.08, 0.12, 0.02, m.tail, x, -0.08, 1.875));
  const diffuser = box(1.1, 0.04, 0.4, m.carbon, 0, -0.45, 1.7);
  diffuser.rotation.x = -0.25;
  const fins = [-0.4, -0.13, 0.13, 0.4].map((x) => box(0.02, 0.12, 0.38, m.carbon, x, -0.43, 1.7));
  // suspension: upper and lower wishbones and push-rods to every wheel
  const arms: Mesh[] = [];
  for (const [z, hw] of [[-1.35, 0.78], [1.3, 0.8]] as const) {
    for (const sx of [-1, 1]) {
      arms.push(
        tube([sx * 0.26, -0.18, z - 0.16], [sx * hw, -0.18, z], 0.02, m.carbon),
        tube([sx * 0.26, -0.18, z + 0.16], [sx * hw, -0.18, z], 0.02, m.carbon),
        tube([sx * 0.28, -0.38, z - 0.16], [sx * hw, -0.34, z], 0.02, m.carbon),
        tube([sx * 0.28, -0.38, z + 0.16], [sx * hw, -0.34, z], 0.02, m.carbon),
      );
    }
  }
  // lights: LED slits at the corners of the nose
  const heads = [-0.36, 0.36].map((x) => box(0.16, 0.025, 0.03, m.head, x, -0.3, -2.0));
  const mirrorL = box(0.1, 0.05, 0.07, m.livery, 0.33, 0.12, -0.42);
  const mirrors = [mirrorL, mirrored(mirrorL)];
  body.add(tub, pod, mirrored(pod), intake, mirrored(intake), splitter, flap, plate, mirrored(plate), rim, screen, helmet, visor, scoop, scoopMouth, fin,
    lip, back, ...leds, ...tails, diffuser, ...fins, ...arms, ...heads, ...mirrors);
  return {
    body,
    cockpitHidden: [helmet, visor, scoop, scoopMouth, fin, rim, screen, ...mirrors],
    tyre: 'sport',
    tyreWidth: 0.38,
    exhaust: [[-0.2, -0.3, 1.82], [0.2, -0.3, 1.82]],
    flame: 'electric',
    plate: { x: 0, y: -0.14, z: 1.875, w: 0.46, h: 0.16 },
  };
}
