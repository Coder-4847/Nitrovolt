import {
  BoxGeometry, BufferGeometry, Color, CurvePath, Group, LineCurve3, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, TubeGeometry, Vector3,
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
    const a = hw - 0.6, b = 8.5;
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

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.group.clear();
  }
}
