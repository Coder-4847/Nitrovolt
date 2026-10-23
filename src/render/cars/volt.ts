import { Group, Mesh, SphereGeometry } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Volt: open-wheel stadium racer. A slim monocoque from a low nose to the engine cover and fin, sidepods
 * with intakes, an open cockpit with the driver's helmet and a roll hoop, a two-element front wing, a
 * rear wing on a swan-neck pylon, a floor and diffuser, and exposed wishbones to every wheel.
 * Wheel centres sit at x = +-0.9 / 0.92, z = -1.35 / 1.3, y = -0.25 (the physics layout).
 */
export function buildVolt(m: CarMaterials): CarModel {
  const body = new Group();
  // monocoque: nose cone -> cockpit -> engine cover
  const tub = shell([
    { z: -2.32, w: 0.26, y0: -0.3, y1: -0.2, top: 0.8 },
    { z: -2.05, w: 0.36, y0: -0.33, y1: -0.14, top: 0.8 },
    { z: -1.5, w: 0.5, y0: -0.36, y1: -0.04, top: 0.78 },
    { z: -0.9, w: 0.66, y0: -0.38, y1: 0.06, top: 0.76 },
    { z: -0.35, w: 0.78, y0: -0.4, y1: 0.12, top: 0.74 },
    { z: 0.35, w: 0.86, y0: -0.4, y1: 0.18, top: 0.7 },
    { z: 0.95, w: 0.7, y0: -0.38, y1: 0.2, top: 0.62 },
    { z: 1.55, w: 0.44, y0: -0.34, y1: 0.08, top: 0.66 },
    { z: 1.95, w: 0.3, y0: -0.3, y1: -0.06, top: 0.7 },
  ], m.livery, { square: 3.2 });
  // sidepods with dark intake mouths
  const pod = shell([
    { z: -0.42, w: 0.36, y0: -0.38, y1: -0.02, bot: 0.95, top: 0.8 },
    { z: -0.15, w: 0.46, y0: -0.4, y1: 0.04, bot: 0.95, top: 0.78 },
    { z: 0.55, w: 0.42, y0: -0.4, y1: 0.0, bot: 0.95, top: 0.74 },
    { z: 1.25, w: 0.22, y0: -0.38, y1: -0.16, bot: 0.95, top: 0.75 },
  ], m.livery, { square: 3.4 });
  pod.position.x = 0.5;
  const intake = shell([
    { z: -0.44, w: 0.3, y0: -0.33, y1: -0.06 },
    { z: -0.4, w: 0.3, y0: -0.33, y1: -0.06 },
  ], m.dark, { square: 3 });
  intake.position.x = 0.5;
  // cockpit rim, driver and roll hoop / airbox
  const rim = shell([
    { z: -0.7, w: 0.5, y0: 0.06, y1: 0.12 },
    { z: -0.2, w: 0.62, y0: 0.1, y1: 0.18 },
    { z: 0.2, w: 0.58, y0: 0.14, y1: 0.22 },
  ], m.dark, { square: 2.6 });
  const helmet = new Mesh(new SphereGeometry(0.15, 20, 14), m.accent);
  helmet.position.set(0, 0.26, 0.0);
  const visor = new Mesh(new SphereGeometry(0.152, 20, 8, -Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.32, Math.PI * 0.2), m.glass);
  visor.position.copy(helmet.position);
  const airbox = shell([
    { z: 0.28, w: 0.3, y0: 0.15, y1: 0.42, top: 0.7 },
    { z: 0.5, w: 0.32, y0: 0.16, y1: 0.46, top: 0.7 },
    { z: 1.05, w: 0.24, y0: 0.18, y1: 0.32, top: 0.7 },
  ], m.livery, { square: 3 });
  const fin = box(0.03, 0.26, 0.9, m.livery, 0, 0.2, 1.35);
  // front wing: main plane, flap, endplates and nose pillars
  const fwMain = box(1.9, 0.035, 0.42, m.carbon, 0, -0.5, -2.14);
  const fwFlap = box(1.6, 0.03, 0.2, m.accent, 0, -0.44, -1.97);
  fwFlap.rotation.x = -0.35;
  const fwPlate = box(0.03, 0.2, 0.5, m.livery, 0.95, -0.44, -2.12);
  const pillars = [tube([-0.12, -0.48, -2.1], [-0.12, -0.3, -2.02], 0.025, m.carbon), tube([0.12, -0.48, -2.1], [0.12, -0.3, -2.02], 0.025, m.carbon)];
  // rear wing on a swan-neck pylon
  const rwMain = box(1.32, 0.04, 0.36, m.carbon, 0, 0.42, 1.92);
  const rwFlap = box(1.32, 0.035, 0.16, m.livery, 0, 0.53, 2.06);
  rwFlap.rotation.x = 0.5;
  const rwPlate = box(0.03, 0.46, 0.62, m.livery, 0.67, 0.36, 1.94);
  const pylon = tube([0, 0.0, 1.62], [0, 0.42, 1.86], 0.035, m.carbon);
  const beam = box(1.0, 0.03, 0.12, m.carbon, 0, 0.0, 1.88);
  // floor, plank and diffuser
  const floor = box(1.42, 0.03, 2.5, m.carbon, 0, -0.43, 0.25);
  const diffuser = box(1.0, 0.16, 0.36, m.carbon, 0, -0.36, 1.82);
  diffuser.rotation.x = -0.3;
  // wishbones and push-rods (upper and lower, front and rear)
  const arms: Mesh[] = [];
  for (const [z, hw] of [[-1.35, 0.78], [1.3, 0.8]] as const) {
    for (const sx of [-1, 1]) {
      arms.push(
        tube([sx * 0.22, -0.12, z - 0.18], [sx * hw, -0.16, z], 0.022, m.carbon),
        tube([sx * 0.22, -0.12, z + 0.18], [sx * hw, -0.16, z], 0.022, m.carbon),
        tube([sx * 0.24, -0.32, z - 0.18], [sx * hw, -0.34, z], 0.022, m.carbon),
        tube([sx * 0.24, -0.32, z + 0.18], [sx * hw, -0.34, z], 0.022, m.carbon),
        tube([sx * 0.26, 0.02, z + 0.05], [sx * (hw - 0.04), -0.32, z], 0.016, m.metal),
      );
    }
  }
  // lights: slim LED bar in the nose, rain light at the back
  const head = box(0.22, 0.03, 0.03, m.head, 0, -0.17, -2.34);
  const tail = box(0.26, 0.05, 0.03, m.tail, 0, 0.05, 1.98);
  const mirrorL = box(0.12, 0.05, 0.08, m.livery, 0.36, 0.2, -0.45);
  const mirrors = [mirrorL, mirrored(mirrorL)];
  body.add(tub, pod, mirrored(pod), intake, mirrored(intake), rim, helmet, visor, airbox, fin, fwMain, fwFlap, fwPlate, mirrored(fwPlate), ...pillars,
    rwMain, rwFlap, rwPlate, mirrored(rwPlate), pylon, beam, floor, diffuser, ...arms, head, tail, ...mirrors);
  return {
    body,
    cockpitHidden: [helmet, visor, airbox, fin, rim, ...mirrors, rwMain, rwFlap, rwPlate, pylon],
    tyre: 'sport',
    tyreWidth: 0.34,
    exhaust: [[0, -0.05, 2.0]],
    flame: 'electric',
    plate: { x: 0, y: -0.2, z: 2.0, w: 0.34, h: 0.12 },
  };
}
