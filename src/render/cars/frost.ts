import { Group, Mesh, MeshBasicMaterial } from 'three';
import { CarMaterials, CarModel, box, sideExtrude, tube } from './parts';

/** Frost: tall, heavy 4x4 pickup with roof rack, light bar, bull bar and studded tyres. */
export function buildFrost(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = new Mesh(
    sideExtrude([[-2.15, -0.42], [2.1, -0.42], [2.18, -0.1], [1.85, 0.25], [0.85, 0.32], [0.62, 0.36], [0.2, 0.98], [-0.62, 1.0], [-0.9, 0.5], [-2.15, 0.48]], 1.92),
    m.paint,
  );
  const glass = new Mesh(sideExtrude([[0.5, 0.4], [0.18, 0.92], [-0.56, 0.94], [-0.82, 0.52]], 1.7, 0.03), m.glass);
  const rack = [-0.75, -0.25].map((z) => box(1.6, 0.05, 0.06, m.dark, 0, 1.08, z));
  const rackRails = [-0.8, 0.8].map((x) => box(0.05, 0.05, 0.9, m.dark, x, 1.08, -0.5));
  const lightBar = box(1.5, 0.12, 0.14, m.dark, 0, 1.0, 0.1);
  const lights = box(1.4, 0.07, 0.04, new MeshBasicMaterial({ color: 0xeaf6ff }), 0, 1.0, 0.0);
  const bullBar = [box(1.9, 0.12, 0.12, m.dark, 0, -0.18, -2.22), box(0.1, 0.5, 0.1, m.dark, -0.7, -0.05, -2.2), box(0.1, 0.5, 0.1, m.dark, 0.7, -0.05, -2.2)];
  const bedRails = [-0.97, 0.97].map((x) => box(0.06, 0.2, 1.3, m.dark, x, 0.58, 1.5));
  const tailgate = box(1.9, 0.38, 0.06, m.paint, 0, 0.58, 2.15);
  const stripe = box(0.35, 0.02, 3.4, m.accent, 0, 0.34, 0.2);
  const stack = tube([0.82, 0.9, 0.6], [0.82, 1.55, 0.6], 0.07, m.dark);
  const fenders = [-1, 1].flatMap((sx) => [-1.4, 1.35].map((z) => box(0.26, 0.14, 1.2, m.dark, sx * 0.98, -0.05, z)));
  const tail = box(1.5, 0.08, 0.04, new MeshBasicMaterial({ color: 0xff2020 }), 0, 0.5, 2.19);
  body.add(hull, glass, ...rack, ...rackRails, lightBar, lights, ...bullBar, ...bedRails, tailgate, stripe, stack, ...fenders, tail);
  return { body, cockpitHidden: [glass, ...rack, ...rackRails, lightBar, lights, stack], tyre: 'studded', tyreWidth: 0.4 };
}
