import {
  BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Shape, TorusGeometry,
} from 'three';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';

/** Extrude a side-profile polygon (x = forward, y = up) to a given width, centred on X = 0. */
function sideExtrude(points: Array<[number, number]>, width: number, bevel = 0.05): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i]![0], points[i]![1]);
  shape.closePath();
  const g = new ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  // shape-x -> -Z (forward), extrude-z -> +X
  g.rotateY(Math.PI / 2);
  g.translate(-(width - bevel * 2) / 2, 0, 0);
  return g;
}

/** Procedural Volt: a low wedge body, canopy, rear wing and four open wheels. */
export class CarView {
  readonly root = new Group();
  readonly body = new Group();
  private readonly wheelRoots: Group[] = [];
  private readonly wheelSpin: Group[] = [];
  private readonly paint: MeshStandardMaterial;
  private readonly accent: MeshStandardMaterial;
  private readonly mountY: number;
  private readonly mounts: Array<[number, number]>;

  constructor(params: VehicleParams, primary = 0xff3b2f, accent = 0x18e0ff) {
    this.mountY = params.mountY;
    this.mounts = [
      [-params.halfTrackFront, params.frontAxleZ],
      [params.halfTrackFront, params.frontAxleZ],
      [-params.halfTrackRear, params.rearAxleZ],
      [params.halfTrackRear, params.rearAxleZ],
    ];
    this.paint = new MeshStandardMaterial({ color: primary, roughness: 0.32, metalness: 0.55 });
    this.accent = new MeshStandardMaterial({ color: accent, emissive: new Color(accent), emissiveIntensity: 1.4, roughness: 0.4 });
    const dark = new MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.3 });
    const glass = new MeshStandardMaterial({ color: 0x0b1018, roughness: 0.05, metalness: 0.9 });

    const hw = 0.82;
    const hull = new Mesh(
      sideExtrude([[-2.05, -0.3], [1.95, -0.3], [2.08, -0.14], [1.7, 0.04], [0.6, 0.14], [-0.9, 0.16], [-1.95, 0.2], [-2.08, 0.04]], hw * 2),
      this.paint,
    );
    const canopy = new Mesh(sideExtrude([[0.55, 0.12], [0.1, 0.52], [-0.65, 0.54], [-1.15, 0.16]], 1.15, 0.04), glass);
    const spoilerPlane = new Mesh(new BoxGeometry(1.9, 0.05, 0.55), dark);
    spoilerPlane.position.set(0, 0.62, 1.95);
    const postL = new Mesh(new BoxGeometry(0.06, 0.42, 0.28), dark);
    postL.position.set(-0.55, 0.4, 1.95);
    const postR = postL.clone();
    postR.position.x = 0.55;
    const plateL = new Mesh(new BoxGeometry(0.05, 0.3, 0.6), this.accent);
    plateL.position.set(-0.95, 0.62, 1.95);
    const plateR = plateL.clone();
    plateR.position.x = 0.95;
    const splitter = new Mesh(new BoxGeometry(1.9, 0.05, 0.5), dark);
    splitter.position.set(0, -0.3, -2.05);
    const stripe = new Mesh(new BoxGeometry(0.3, 0.02, 3.6), this.accent);
    stripe.position.set(0, 0.17, 0.0);
    const glow = new Mesh(new BoxGeometry(1.5, 0.02, 3.4), new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 }));
    glow.position.set(0, -0.36, 0);
    const tail = new Mesh(new BoxGeometry(1.3, 0.07, 0.04), new MeshBasicMaterial({ color: 0xff2020 }));
    tail.position.set(0, 0.12, 2.09);
    const head = new Mesh(new BoxGeometry(1.2, 0.05, 0.04), new MeshBasicMaterial({ color: 0xf4fbff }));
    head.position.set(0, -0.06, -2.1);

    this.body.add(hull, canopy, spoilerPlane, postL, postR, plateL, plateR, splitter, stripe, glow, tail, head);
    this.body.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = true;
    });
    this.root.add(this.body);

    // wheels
    const r = params.wheelRadius;
    const tyreGeo = new CylinderGeometry(r, r, 0.32, 24).rotateZ(Math.PI / 2);
    const hubGeo = new CylinderGeometry(r * 0.62, r * 0.62, 0.34, 20).rotateZ(Math.PI / 2);
    const rimGeo = new TorusGeometry(r * 0.64, 0.025, 6, 24).rotateY(Math.PI / 2);
    const spokeGeo = new BoxGeometry(0.36, r * 1.15, 0.05);
    const tyreMat = new MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.9 });
    const hubMat = new MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.3, metalness: 0.9 });
    for (let k = 0; k < 4; k++) {
      const wr = new Group();
      const spin = new Group();
      const tyre = new Mesh(tyreGeo, tyreMat);
      const hub = new Mesh(hubGeo, hubMat);
      hub.scale.set(0.96, 1, 1);
      const rim = new Mesh(rimGeo, this.accent);
      const outer = k % 2 === 0 ? -1 : 1;
      rim.position.x = outer * 0.17;
      spin.add(tyre, hub, rim);
      for (let s = 0; s < 3; s++) {
        const spoke = new Mesh(spokeGeo, this.paint);
        spoke.rotation.x = (s * Math.PI) / 3;
        spin.add(spoke);
      }
      spin.traverse((o) => {
        if (o instanceof Mesh) o.castShadow = true;
      });
      wr.add(spin);
      this.root.add(wr);
      this.wheelRoots.push(wr);
      this.wheelSpin.push(spin);
    }
  }

  setLivery(primary: number, accent: number): void {
    this.paint.color.setHex(primary);
    this.accent.color.setHex(accent);
    this.accent.emissive.setHex(accent);
  }

  setVisible(bodyVisible: boolean): void {
    this.body.visible = bodyVisible;
  }

  update(pose: RenderPose): void {
    this.root.position.copy(pose.position);
    this.root.quaternion.copy(pose.quaternion);
    for (let k = 0; k < 4; k++) {
      const [x, z] = this.mounts[k]!;
      const wr = this.wheelRoots[k]!;
      wr.position.set(x, this.mountY - pose.springLen[k]!, z);
      wr.rotation.y = -pose.steer[k]!;
      this.wheelSpin[k]!.rotation.x = -pose.spin[k]!;
    }
  }
}
