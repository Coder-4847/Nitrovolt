import { Group } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Gravel: modern rally hatchback in a full livery. Boxed arches over long-travel wheels, a tall hatch cabin with a painted
 * roof and scoop, a big rear wing, mud flaps and a light pod.
 */
export function buildGravel(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = shell([
    { z: -2.03, w: 1.5, y0: -0.52, y1: -0.22, bot: 0.92, top: 0.8 },
    { z: -1.9, w: 1.84, y0: -0.56, y1: -0.05, bot: 0.92, top: 0.86 },
    { z: -1.6, w: 2.02, y0: -0.57, y1: 0.06, bot: 0.84, top: 0.9 },
    { z: -1.3, w: 2.06, y0: -0.57, y1: 0.12, bot: 0.74, top: 0.9 },
    { z: -0.95, w: 2.0, y0: -0.57, y1: 0.16, bot: 0.84, top: 0.9 },
    { z: -0.4, w: 1.86, y0: -0.57, y1: 0.22, bot: 0.95, top: 0.88 },
    { z: 0.4, w: 1.88, y0: -0.57, y1: 0.27, bot: 0.95, top: 0.88 },
    { z: 0.9, w: 2.02, y0: -0.56, y1: 0.31, bot: 0.84, top: 0.9 },
    { z: 1.25, w: 2.06, y0: -0.55, y1: 0.33, bot: 0.74, top: 0.9 },
    { z: 1.62, w: 2.0, y0: -0.51, y1: 0.34, bot: 0.86, top: 0.88 },
    { z: 1.92, w: 1.86, y0: -0.43, y1: 0.3, bot: 0.9, top: 0.85 },
    { z: 2.02, w: 1.66, y0: -0.34, y1: 0.22, bot: 0.9, top: 0.8 },
  ], m.livery, { square: 5.5 });
  const cabin = shell([
    { z: -0.78, w: 1.62, y0: 0.1, y1: 0.2, top: 0.82 },
    { z: -0.38, w: 1.58, y0: 0.12, y1: 0.7, top: 0.74 },
    { z: 0.3, w: 1.56, y0: 0.14, y1: 0.8, top: 0.72 },
    { z: 1.2, w: 1.5, y0: 0.2, y1: 0.78, top: 0.72 },
    { z: 1.68, w: 1.42, y0: 0.3, y1: 0.62, top: 0.74 },
    { z: 1.9, w: 1.3, y0: 0.32, y1: 0.4, top: 0.76 },
  ], m.glass, { square: 5.5 });
  const roof = shell([
    { z: -0.28, w: 0.96, y0: 0.69, y1: 0.72 },
    { z: 0.3, w: 1.14, y0: 0.78, y1: 0.815 },
    { z: 1.2, w: 1.1, y0: 0.76, y1: 0.795 },
    { z: 1.6, w: 0.96, y0: 0.64, y1: 0.67 },
  ], m.paint, { square: 3 });
  const scoop = shell([
    { z: -0.1, w: 0.36, y0: 0.79, y1: 0.8 },
    { z: 0.15, w: 0.44, y0: 0.79, y1: 0.9 },
    { z: 0.42, w: 0.44, y0: 0.8, y1: 0.86 },
  ], m.dark, { square: 5 });
  const wing = box(1.82, 0.05, 0.42, m.carbon, 0, 0.95, 1.82);
  const wingFlap = box(1.82, 0.04, 0.14, m.livery, 0, 1.0, 1.98);
  wingFlap.rotation.x = 0.4;
  const wingTip = box(0.04, 0.22, 0.5, m.accent, 0.91, 0.88, 1.82);
  const stalks = [tube([-0.55, 0.62, 1.88], [-0.55, 0.93, 1.82], 0.03, m.dark), tube([0.55, 0.62, 1.88], [0.55, 0.93, 1.82], 0.03, m.dark)];
  const bumper = box(1.86, 0.18, 0.2, m.dark, 0, -0.46, -1.97);
  const rearBumper = box(1.84, 0.18, 0.2, m.dark, 0, -0.44, 1.95);
  const plate = box(1.4, 0.035, 0.5, m.metal, 0, -0.56, -1.7);
  const pod = box(1.1, 0.1, 0.12, m.dark, 0, -0.18, -2.06);
  const podLamps = [-0.36, -0.12, 0.12, 0.36].map((x) => box(0.18, 0.06, 0.03, m.head, x, -0.18, -2.125));
  const head = box(1.5, 0.04, 0.04, m.head, 0, 0.0, -1.94);
  const tail = box(1.5, 0.05, 0.04, m.tail, 0, 0.12, 2.03);
  const flap = box(0.03, 0.26, 0.38, m.dark, 0.94, -0.5, 1.62);
  const stripe = box(0.5, 0.012, 1.7, m.accent, 0, 0.81, 0.6);
  // rally details: front splitter, side skirts, fog lamps, a roof vent, mirrors and an exhaust
  const splitter = box(1.8, 0.03, 0.3, m.carbon, 0, -0.58, -1.92);
  const skirt = box(0.06, 0.08, 1.7, m.carbon, 0.94, -0.52, -0.05);
  const fog = [-0.6, 0.6].map((x) => box(0.16, 0.08, 0.03, m.head, x, -0.36, -2.02));
  const vent = box(0.3, 0.05, 0.3, m.carbon, 0, 0.82, 1.0);
  const mirror = box(0.16, 0.08, 0.14, m.livery, 0.86, 0.32, -0.42);
  const exhaust = tube([0.58, -0.42, 1.9], [0.58, -0.42, 2.08], 0.055, m.metal);
  body.add(hull, cabin, roof, scoop, wing, wingFlap, wingTip, mirrored(wingTip), ...stalks, bumper, rearBumper, plate, pod, ...podLamps, head, tail, flap, mirrored(flap), stripe,
    splitter, skirt, mirrored(skirt), ...fog, vent, mirror, mirrored(mirror), exhaust);
  return {
    body,
    cockpitHidden: [cabin, roof, scoop, stripe, wing, wingFlap, wingTip, ...stalks, vent, mirror],
    tyre: 'knobby',
    tyreWidth: 0.3,
    exhaust: [[0.58, -0.42, 2.1]],
    flame: 'fire',
    plate: { x: -0.35, y: -0.1, z: 2.035, w: 0.4, h: 0.13 },
  };
}
