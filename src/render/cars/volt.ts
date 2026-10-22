import { Group, Mesh, MeshBasicMaterial } from 'three';
import { CarMaterials, CarModel, box, sideExtrude } from './parts';

/** Volt: low stadium wedge, glass canopy, big rear wing, open wheels. */
export function buildVolt(m: CarMaterials): CarModel {
  const body = new Group();
  const hull = new Mesh(sideExtrude([[-2.05, -0.3], [1.95, -0.3], [2.08, -0.14], [1.7, 0.04], [0.6, 0.14], [-0.9, 0.16], [-1.95, 0.2], [-2.08, 0.04]], 1.64), m.paint);
  const canopy = new Mesh(sideExtrude([[0.55, 0.12], [0.1, 0.52], [-0.65, 0.54], [-1.15, 0.16]], 1.15, 0.04), m.glass);
  const wing = box(1.9, 0.05, 0.55, m.dark, 0, 0.62, 1.95);
  const postL = box(0.06, 0.42, 0.28, m.dark, -0.55, 0.4, 1.95);
  const postR = box(0.06, 0.42, 0.28, m.dark, 0.55, 0.4, 1.95);
  const plateL = box(0.05, 0.3, 0.6, m.accent, -0.95, 0.62, 1.95);
  const plateR = box(0.05, 0.3, 0.6, m.accent, 0.95, 0.62, 1.95);
  const splitter = box(1.9, 0.05, 0.5, m.dark, 0, -0.3, -2.05);
  const stripe = box(0.3, 0.02, 3.6, m.accent, 0, 0.17, 0);
  const glow = box(1.5, 0.02, 3.4, new MeshBasicMaterial({ color: m.accent.color, transparent: true, opacity: 0.55 }), 0, -0.36, 0);
  const tail = box(1.3, 0.07, 0.04, new MeshBasicMaterial({ color: 0xff2020 }), 0, 0.12, 2.09);
  const head = box(1.2, 0.05, 0.04, new MeshBasicMaterial({ color: 0xf4fbff }), 0, -0.06, -2.1);
  body.add(hull, canopy, wing, postL, postR, plateL, plateR, splitter, stripe, glow, tail, head);
  return { body, cockpitHidden: [canopy, wing, postL, postR, plateL, plateR], tyre: 'sport', tyreWidth: 0.32 };
}
