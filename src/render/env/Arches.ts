import {
  AdditiveBlending, BoxGeometry, BufferGeometry, Color, CurvePath, DoubleSide, Group, LineCurve3, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, Quaternion, TubeGeometry, Vector3,
} from 'three';
import { Pose, TrackTrigger } from '../../tracks/TrackTypes';
import { archSignTexture } from './Signage';
import { ThemeDef } from './Theme';

/** Elliptical arch path over a road of half-width `a` (m), apex height `b`, in the gate's local XY plane. */
function archCurve(a: number, b: number, n = 24): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>();
  let prev = new Vector3(-a, 0, 0);
  for (let i = 1; i <= n; i++) {
    const t = Math.PI - (i / n) * Math.PI;
    const p = new Vector3(Math.cos(t) * a, Math.sin(t) * b, 0);
    path.add(new LineCurve3(prev, p));
    prev = p;
  }
  return path;
}

/** Car-gate colours and names (one per car). */
const CAR_GATE: Record<string, number> = { volt: 0x2aa8ff, gravel: 0xff8a2a, frost: 0x8fe6ff, dune: 0xffc83a };
const CAR_GATE_NAME: Record<string, string> = { volt: 'STADIUM', gravel: 'RALLY', frost: 'SNOW', dune: 'DESERT' };

/**
 * Start, checkpoint and finish arches: an elliptical arch spanning the road with LED strips along both
 * faces, a coloured inner band, feet at both ends and a sign board on top with the gate's name. Drawn by the
 * renderer at the trigger poses (the block library's plain gantry boxes are hidden).
 */
export class Arches {
  readonly group = new Group();
  private readonly mats: Material[] = [];
  private readonly geos: BufferGeometry[] = [];

  constructor(triggers: readonly TrackTrigger[], start: Pose, theme: ThemeDef) {
    const body = new MeshStandardMaterial({ color: 0x252a32, roughness: 0.45, metalness: 0.5 });
    this.mats.push(body);
    const gates: Array<{ pose: Pose; hw: number; kind: 'start' | 'checkpoint' | 'finish' }> = triggers.flatMap((t) => (t.kind === 'car' ? [] : [{
      pose: { position: t.position, quaternion: t.quaternion },
      hw: t.halfWidth,
      kind: t.kind,
    }]));
    for (const t of triggers) if (t.kind === 'car' && t.car) this.carGate({ position: t.position, quaternion: t.quaternion }, t.halfWidth, t.car, body);
    // a lap track's start line is also its finish: one arch is enough there
    const finishAtStart = triggers.some((t) => t.kind === 'finish' && t.position.distanceTo(start.position) < 24);
    if (!finishAtStart) {
      // the car spawns a few metres behind the start arch
      const fwd = new Vector3(0, 0, -1).applyQuaternion(start.quaternion);
      gates.push({ pose: { position: start.position.clone().addScaledVector(fwd, 6).addScaledVector(new Vector3(0, 1, 0).applyQuaternion(start.quaternion), -0.75), quaternion: start.quaternion }, hw: triggers[0]?.halfWidth ?? 6, kind: 'start' });
    }
    for (const g of gates) this.build(g.pose, g.hw, g.kind, theme, body);
  }

  private build(pose: Pose, hw: number, kind: 'start' | 'checkpoint' | 'finish', theme: ThemeDef, body: Material): void {
    const colour = kind === 'start' ? theme.gate.start : kind === 'finish' ? theme.gate.finish : theme.gate.checkpoint;
    const a = hw - 0.6, b = 10.5;
    const root = new Group();
    root.position.copy(pose.position);
    root.quaternion.copy(pose.quaternion as Quaternion);
    // the beam: a squared tube along the arch, with LED strips along its front and back faces and a
    // coloured band on the inside of the curve
    const beamGeo = new TubeGeometry(archCurve(a, b), 64, 0.75, 4, false);
    const beam = new Mesh(beamGeo, body);
    beam.castShadow = true;
    const led = new MeshBasicMaterial({ color: new Color(colour).lerp(new Color(0xffffff), 0.4) });
    const band = new MeshStandardMaterial({ color: colour, roughness: 0.4, metalness: 0.2 });
    const ledGeo = new TubeGeometry(archCurve(a, b), 64, 0.07, 6, false);
    const bandGeo = new TubeGeometry(archCurve(a - 0.55, b - 0.55), 64, 0.22, 6, false);
    const strips = [0.56, -0.56].map((z) => {
      const m = new Mesh(ledGeo, led);
      m.position.z = z;
      return m;
    });
    const outer = new Mesh(bandGeo, band);
    // feet
    const footGeo = new BoxGeometry(1.8, 1.2, 2.4).translate(0, 0.6, 0);
    const footL = new Mesh(footGeo, body);
    const footR = new Mesh(footGeo, body);
    footL.position.x = -a;
    footR.position.x = a;
    // sign board on top: the same face front and back
    const sign = archSignTexture(kind === 'start' ? 'START' : kind === 'finish' ? 'FINISH' : 'CHECKPOINT', colour);
    const signMat = new MeshBasicMaterial({ map: sign });
    const boardGeo = new BoxGeometry(Math.min(14, a * 1.4), 2.6, 0.6);
    const board = new Mesh(boardGeo, [body, body, body, body, signMat, signMat]);
    board.position.y = b + 1.6;
    root.add(beam, ...strips, outer, footL, footR, board);
    this.group.add(root);
    this.mats.push(led, band, signMat);
    this.geos.push(beamGeo, ledGeo, bandGeo, footGeo, boardGeo);
  }

  /**
   * Car gate: a square portal in the colour of the car it gives you, with a shimmering curtain across the
   * road and the car's name on a board above.
   */
  private carGate(pose: Pose, hw: number, car: string, body: Material): void {
    const colour = CAR_GATE[car] ?? CAR_GATE.volt!;
    const a = hw - 0.4, h = 11;
    const root = new Group();
    root.position.copy(pose.position);
    root.quaternion.copy(pose.quaternion as Quaternion);
    const postGeo = new BoxGeometry(1.4, h, 1.6).translate(0, h / 2, 0);
    const beamGeo = new BoxGeometry(a * 2 + 1.4, 1.4, 1.6).translate(0, h, 0);
    const posts = [-a, a].map((x) => {
      const m = new Mesh(postGeo, body);
      m.position.x = x;
      m.castShadow = true;
      return m;
    });
    const beam = new Mesh(beamGeo, body);
    const led = new MeshBasicMaterial({ color: new Color(colour).lerp(new Color(0xffffff), 0.3) });
    const ledGeo = new BoxGeometry(0.18, h - 1, 0.1).translate(0, (h - 1) / 2, 0);
    const ledBeamGeo = new BoxGeometry(a * 2 - 0.6, 0.18, 0.1);
    const leds: Mesh[] = [];
    for (const z of [0.82, -0.82]) {
      for (const x of [-a + 0.72, a - 0.72]) {
        const m = new Mesh(ledGeo, led);
        m.position.set(x, 0, z);
        leds.push(m);
      }
      const t = new Mesh(ledBeamGeo, led);
      t.position.set(0, h - 0.72, z);
      leds.push(t);
    }
    const curtainMat = new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const curtainGeo = new PlaneGeometry(a * 2 - 1.4, h - 1.4).translate(0, (h - 1.4) / 2, 0);
    const curtain = new Mesh(curtainGeo, curtainMat);
    curtain.renderOrder = 5;
    const sign = archSignTexture(CAR_GATE_NAME[car] ?? car.toUpperCase(), colour);
    const signMat = new MeshBasicMaterial({ map: sign });
    const boardGeo = new BoxGeometry(Math.min(16, a * 1.3), 3, 0.6);
    const board = new Mesh(boardGeo, [body, body, body, body, signMat, signMat]);
    board.position.y = h + 2.4;
    root.add(...posts, beam, ...leds, curtain, board);
    this.group.add(root);
    this.mats.push(led, curtainMat, signMat);
    this.geos.push(postGeo, beamGeo, ledGeo, ledBeamGeo, curtainGeo, boardGeo);
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
