import { Group, Mesh, MeshBasicMaterial } from 'three';
import { CarMaterials, CarModel, box, sideExtrude } from './parts';

/** Gravel: tall rally hatchback, fender flares, roof scoop, light pod, big wing, knobbly tyres. */
export function buildGravel(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = new Mesh(
    sideExtrude([[-2.0, -0.42], [1.95, -0.42], [2.0, -0.2], [1.8, 0.02], [0.95, 0.1], [0.55, 0.16], [0.12, 0.74], [-1.15, 0.78], [-1.75, 0.3], [-2.0, 0.18]], 1.7),
    m.paint,
  );
  const glass = new Mesh(sideExtrude([[0.48, 0.2], [0.12, 0.68], [-1.1, 0.72], [-1.62, 0.3]], 1.5, 0.03), m.glass);
  glass.scale.set(1.005, 1, 1.002);
  const roof = box(1.4, 0.05, 1.1, m.paint, 0, 0.8, -0.3);
  const scoop = box(0.5, 0.16, 0.5, m.dark, 0, 0.9, -0.15);
  const lightPod = box(1.3, 0.14, 0.2, m.dark, 0, 0.84, -0.78);
  const lights = box(1.2, 0.08, 0.04, new MeshBasicMaterial({ color: 0xfff1c0 }), 0, 0.84, -0.89);
  const wingPlane = box(1.85, 0.06, 0.6, m.dark, 0, 0.98, 1.9);
  const wingStripe = box(1.85, 0.065, 0.12, m.accent, 0, 0.985, 1.65);
  const stalkL = box(0.07, 0.5, 0.2, m.dark, -0.7, 0.72, 1.9);
  const stalkR = box(0.07, 0.5, 0.2, m.dark, 0.7, 0.72, 1.9);
  const bumper = box(1.8, 0.2, 0.3, m.dark, 0, -0.36, -2.0);
  const rearBumper = box(1.8, 0.2, 0.3, m.dark, 0, -0.34, 2.0);
  const stripe = box(0.4, 0.02, 3.2, m.accent, 0, 0.12, -0.2);
  const tail = box(1.2, 0.07, 0.04, new MeshBasicMaterial({ color: 0xff2020 }), 0, 0.15, 2.02);
  const flares = [-1, 1].flatMap((sx) => [-1.3, 1.25].map((z) => box(0.22, 0.12, 1.05, m.dark, sx * 0.9, -0.12, z)));
  const flaps = [-1, 1].map((sx) => box(0.04, 0.3, 0.4, m.dark, sx * 0.95, -0.38, 1.7));
  body.add(hull, glass, roof, scoop, lightPod, lights, wingPlane, wingStripe, stalkL, stalkR, bumper, rearBumper, stripe, tail, ...flares, ...flaps);
  return { body, cockpitHidden: [glass, roof, scoop, lightPod, lights, wingPlane, wingStripe, stalkL, stalkR], tyre: 'knobby', tyreWidth: 0.3 };
}
