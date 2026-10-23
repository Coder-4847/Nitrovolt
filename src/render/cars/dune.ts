import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { CarMaterials, CarModel, box, mirrored, shell, tube } from './parts';

/**
 * Dune: open tube-frame buggy. A shaped nose and side pods over a skid floor, a roll cage, two bucket
 * seats, an exposed rear engine with a wing, long-travel arms and balloon tyres.
 */
export function buildDune(m: CarMaterials): CarModel {
  const body = new Group();
  const floor = shell([
    { z: -1.75, w: 1.2, y0: -0.38, y1: -0.26 },
    { z: -1.2, w: 1.4, y0: -0.4, y1: -0.22 },
    { z: 1.2, w: 1.4, y0: -0.4, y1: -0.22 },
    { z: 1.85, w: 1.2, y0: -0.36, y1: -0.2 },
  ], m.dark, { square: 6 });
  const nose = shell([
    { z: -2.22, w: 0.9, y0: -0.3, y1: -0.18, top: 0.8 },
    { z: -2.0, w: 1.22, y0: -0.34, y1: 0.0, top: 0.82 },
    { z: -1.5, w: 1.34, y0: -0.34, y1: 0.16, top: 0.8 },
    { z: -0.95, w: 1.3, y0: -0.3, y1: 0.18, top: 0.78 },
    { z: -0.65, w: 1.18, y0: -0.26, y1: 0.08, top: 0.8 },
  ], m.paint, { square: 4 });
  const pod = shell([
    { z: -0.7, w: 0.3, y0: -0.3, y1: -0.05 },
    { z: -0.3, w: 0.34, y0: -0.32, y1: 0.08 },
    { z: 0.5, w: 0.34, y0: -0.32, y1: 0.1 },
    { z: 0.95, w: 0.3, y0: -0.3, y1: -0.02 },
  ], m.paint, { square: 4 });
  pod.position.x = 0.66;
  const cage: Mesh[] = [];
  const t = (a: [number, number, number], b: [number, number, number], r = 0.04): void => {
    cage.push(tube(a, b, r, m.dark));
  };
  // main hoop, A-pillars, rear hoop and bracing
  for (const sx of [-0.68, 0.68]) {
    t([sx, -0.12, 0.45], [sx * 0.95, 0.85, 0.18]);
    t([sx * 0.95, 0.85, 0.18], [sx * 0.95, 0.88, -0.6]);
    t([sx * 0.95, 0.88, -0.6], [sx, 0.02, -1.0]);
    t([sx * 0.95, 0.85, 0.18], [sx, -0.05, 1.25]);
    t([sx, -0.05, 1.25], [sx * 0.9, -0.12, 1.85]);
  }
  t([-0.65, 0.85, 0.18], [0.65, 0.85, 0.18]);
  t([-0.65, 0.88, -0.6], [0.65, 0.88, -0.6]);
  t([-0.68, 0.38, 0.32], [0.68, 0.38, 0.32]);
  t([-0.65, 0.85, 0.18], [0.68, 0.38, 0.32], 0.028);
  const seat = box(0.48, 0.5, 0.5, m.accent, -0.3, 0.06, 0.32);
  const seats = [seat, mirrored(seat)];
  const engine = box(0.9, 0.5, 0.72, m.dark, 0, 0.1, 1.4);
  const heads = [-0.22, 0.22].map((x) => {
    const c = box(0.3, 0.2, 0.6, m.metal, x, 0.42, 1.4);
    return c;
  });
  const cover = shell([
    { z: 0.95, w: 1.0, y0: -0.2, y1: 0.18 },
    { z: 1.4, w: 1.02, y0: -0.22, y1: 0.3 },
    { z: 1.85, w: 0.92, y0: -0.2, y1: 0.2 },
  ], m.paint, { square: 5 });
  cover.scale.set(1, 1, 1);
  const exhaust = tube([-0.32, 0.3, 1.75], [-0.32, 0.5, 2.25], 0.07, m.metal);
  // wing + whip antenna with flag
  const wing = box(1.66, 0.05, 0.46, m.paint, 0, 0.95, 1.75);
  const plates = [box(0.04, 0.26, 0.52, m.accent, 0.83, 0.88, 1.75)];
  plates.push(mirrored(plates[0]!));
  const wingPosts = [tube([-0.45, 0.3, 1.65], [-0.45, 0.94, 1.72], 0.035, m.dark), tube([0.45, 0.3, 1.65], [0.45, 0.94, 1.72], 0.035, m.dark)];
  const whip = tube([0.72, 0.2, 1.5], [0.72, 2.4, 1.5], 0.012, m.dark);
  const flag = new Mesh(new PlaneGeometry(0.6, 0.3), new MeshStandardMaterial({ color: m.accent.color, roughness: 0.7, side: DoubleSide }));
  flag.rotation.y = Math.PI / 2;
  flag.position.set(0.72, 2.24, 1.2);
  // long-travel suspension arms
  const arms = [-1, 1].flatMap((sx) => [
    tube([sx * 0.55, -0.12, -1.3], [sx * 0.98, -0.16, -1.3], 0.032, m.dark),
    tube([sx * 0.55, -0.12, 1.2], [sx * 1.0, -0.16, 1.2], 0.032, m.dark),
  ]);
  const head = box(0.86, 0.06, 0.04, m.head, 0, -0.12, -2.2);
  const lampBar = box(1.1, 0.06, 0.06, m.head, 0, 0.92, -0.64);
  const tail = box(0.7, 0.05, 0.04, m.tail, 0, 0.02, 1.88);
  body.add(floor, nose, pod, mirrored(pod), ...cage, ...seats, engine, ...heads, cover, exhaust, wing, ...plates, ...wingPosts, whip, flag, ...arms, head, lampBar, tail);
  return { body, cockpitHidden: [...cage, wing, ...plates, ...wingPosts, whip, flag, ...seats, lampBar], tyre: 'balloon', tyreWidth: 0.46, exhaust: [[-0.32, 0.5, 2.27]], flame: 'fire' };
}
