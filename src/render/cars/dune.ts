import { Group, Mesh, CylinderGeometry, PlaneGeometry, DoubleSide, MeshStandardMaterial } from 'three';
import { CarMaterials, CarModel, box, sideExtrude, tube } from './parts';

/** Dune: open tube-frame buggy with a rear engine, long-travel struts, whip flag and balloon tyres. */
export function buildDune(m: CarMaterials): CarModel {
  const body = new Group();
  const floor = new Mesh(sideExtrude([[-1.9, -0.32], [1.9, -0.32], [2.0, -0.2], [1.2, -0.08], [-1.7, -0.08]], 1.5, 0.04), m.paint);
  const nose = new Mesh(sideExtrude([[1.0, -0.14], [2.15, -0.22], [2.2, -0.05], [1.4, 0.18], [0.9, 0.12]], 1.3, 0.05), m.paint);
  const cage: Mesh[] = [];
  const t = (a: [number, number, number], b: [number, number, number], r = 0.045): void => {
    cage.push(tube(a, b, r, m.dark));
  };
  // main hoop, A-pillars, rear hoop and bracing
  for (const sx of [-0.7, 0.7]) {
    t([sx, -0.1, 0.45], [sx, 0.85, 0.15]);
    t([sx, 0.85, 0.15], [sx, 0.85, -0.75]);
    t([sx, 0.85, -0.75], [sx, 0.05, -0.95]);
    t([sx, 0.85, 0.15], [sx, -0.05, 1.2]);
    t([sx, 0.05, 1.2], [sx, -0.1, 1.85]);
  }
  t([-0.7, 0.85, 0.15], [0.7, 0.85, 0.15]);
  t([-0.7, 0.85, -0.75], [0.7, 0.85, -0.75]);
  t([-0.7, 0.4, 0.3], [0.7, 0.4, 0.3]);
  t([-0.7, 0.85, 0.15], [0.7, 0.4, 0.3], 0.03);
  const seatL = box(0.5, 0.5, 0.55, m.accent, -0.3, 0.12, 0.35);
  const seatR = box(0.5, 0.5, 0.55, m.accent, 0.3, 0.12, 0.35);
  const engine = box(1.0, 0.55, 0.8, m.dark, 0, 0.18, 1.4);
  const cyl = [-0.25, 0.25].map((x) => {
    const c = new Mesh(new CylinderGeometry(0.16, 0.16, 0.5, 12), new MeshStandardMaterial({ color: 0xb8bcc6, metalness: 0.9, roughness: 0.3 }));
    c.rotation.z = Math.PI / 2;
    c.position.set(x, 0.55, 1.4);
    return c;
  });
  const exhaust = tube([-0.3, 0.35, 1.8], [-0.3, 0.55, 2.3], 0.08, m.dark);
  // wing + whip antenna with flag
  const wing = box(1.7, 0.05, 0.5, m.paint, 0, 0.95, 1.75);
  const wingPostL = tube([-0.5, 0.2, 1.7], [-0.5, 0.95, 1.75], 0.04, m.dark);
  const wingPostR = tube([0.5, 0.2, 1.7], [0.5, 0.95, 1.75], 0.04, m.dark);
  const whip = tube([0.75, 0.2, 1.5], [0.75, 2.5, 1.5], 0.012, m.dark);
  const flag = new Mesh(new PlaneGeometry(0.7, 0.35), new MeshStandardMaterial({ color: m.accent.color, emissive: m.accent.color, emissiveIntensity: 0.8, side: DoubleSide }));
  flag.rotation.y = Math.PI / 2;
  flag.position.set(0.75, 2.3, 1.15);
  // long-travel suspension arms
  const arms = [-1, 1].flatMap((sx) => [
    tube([sx * 0.6, -0.1, -1.3], [sx * 1.0, -0.1, -1.3], 0.035, m.dark),
    tube([sx * 0.6, -0.1, 1.25], [sx * 1.02, -0.1, 1.2], 0.035, m.dark),
  ]);
  const head = box(0.9, 0.12, 0.05, new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c0, emissiveIntensity: 2 }), 0, 0.02, -2.2);
  body.add(floor, nose, ...cage, seatL, seatR, engine, ...cyl, exhaust, wing, wingPostL, wingPostR, whip, flag, ...arms, head);
  return { body, cockpitHidden: [...cage, wing, wingPostL, wingPostR, whip, flag, seatL, seatR], tyre: 'balloon', tyreWidth: 0.46 };
}
