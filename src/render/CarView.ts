import {
  AdditiveBlending, Box3, BoxGeometry, Color, ConeGeometry, Group, Material, Mesh, MeshBasicMaterial, Object3D, SpotLight,
} from 'three';
import { CarId } from '../data/cars';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { buildDune } from './cars/dune';
import { buildFrost } from './cars/frost';
import { buildGravel } from './cars/gravel';
import { CarMaterials, CarModel, makeMaterials, makeWheel } from './cars/parts';
import { buildVolt } from './cars/volt';

const BUILDERS: Record<CarId, (m: CarMaterials) => CarModel> = {
  volt: buildVolt,
  gravel: buildGravel,
  frost: buildFrost,
  dune: buildDune,
};

/** Procedural car: a distinct silhouette per car, four wheels driven by the suspension state, livery colours. */
export class CarView {
  readonly root = new Group();
  readonly body: Group;
  private readonly wheelRoots: Group[] = [];
  private readonly wheelSpin: Group[] = [];
  private readonly mats: CarMaterials;
  private readonly model: CarModel;
  private readonly mountY: number;
  private readonly mounts: Array<[number, number]>;

  constructor(
    readonly id: CarId,
    params: VehicleParams,
    primary: number,
    accent: number,
  ) {
    this.mountY = params.mountY;
    this.mounts = [
      [-params.halfTrackFront, params.frontAxleZ],
      [params.halfTrackFront, params.frontAxleZ],
      [-params.halfTrackRear, params.rearAxleZ],
      [params.halfTrackRear, params.rearAxleZ],
    ];
    this.mats = makeMaterials(primary, accent);
    this.model = BUILDERS[id](this.mats);
    this.body = this.model.body;
    this.body.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = true;
    });
    this.root.add(this.body);

    for (let k = 0; k < 4; k++) {
      const wr = new Group();
      const spin = makeWheel(this.model.tyre, params.wheelRadius, this.model.tyreWidth, k % 2 === 0 ? -1 : 1, this.mats);
      wr.add(spin);
      this.root.add(wr);
      this.wheelRoots.push(wr);
      this.wheelSpin.push(spin);
    }
  }

  private lights: { head: MeshBasicMaterial; tail: MeshBasicMaterial; flames: Mesh[]; flameMat: MeshBasicMaterial; beam: SpotLight | null } | null = null;

  /**
   * Head / tail / brake lights and exhaust flames, placed from the body's bounding box so every car gets
   * them. The colours are pushed above 1 so the bloom pass picks them up.
   */
  addDriverLights(): void {
    const bb = new Box3().setFromObject(this.body);
    const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
    const head = new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.2) });
    const tail = new MeshBasicMaterial({ color: new Color(1.4, 0.06, 0.04) });
    const lamp = new BoxGeometry(w * 0.16, h * 0.09, 0.05);
    for (const sx of [-1, 1]) {
      const hl = new Mesh(lamp, head);
      hl.position.set(sx * w * 0.32, bb.min.y + h * 0.36, bb.min.z - 0.015);
      const tl = new Mesh(lamp, tail);
      tl.position.set(sx * w * 0.34, bb.min.y + h * 0.42, bb.max.z + 0.015);
      this.body.add(hl, tl);
    }
    const flameMat = new MeshBasicMaterial({ color: new Color(2.4, 1.1, 0.35), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
    const flameGeo = new ConeGeometry(0.11, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const flames: Mesh[] = [];
    for (const sx of [-1, 1]) {
      const f = new Mesh(flameGeo, flameMat);
      f.position.set(sx * w * 0.16, bb.min.y + h * 0.2, bb.max.z + 0.05);
      f.visible = false;
      f.renderOrder = 7;
      this.body.add(f);
      flames.push(f);
    }
    this.lights = { head, tail, flames, flameMat, beam: null };
  }

  /** Headlight beam for night levels (one spot light, no shadows). */
  setBeam(on: boolean): void {
    if (!this.lights) return;
    if (on && !this.lights.beam) {
      const s = new SpotLight(0xe8f0ff, 60, 110, 0.55, 0.65, 1.4);
      s.position.set(0, 0.4, -1.8);
      const target = new Object3D();
      target.position.set(0, -1.2, -24);
      this.body.add(s, target);
      s.target = target;
      this.lights.beam = s;
    }
    if (this.lights.beam) this.lights.beam.visible = on;
  }

  /** Brake lights (0..1) and exhaust flames from the boost level (0..1); `t` flickers the flame. */
  setDrive(brake: number, boost: number, t: number): void {
    const L = this.lights;
    if (!L) return;
    const b = 1 + brake * 3.2;
    L.tail.color.setRGB(1.4 * b, 0.06 * b, 0.04 * b);
    const on = boost > 0.05;
    for (const [i, f] of L.flames.entries()) {
      f.visible = on;
      if (on) {
        const flick = 0.75 + 0.25 * Math.sin(t * 60 + i * 2.1) * Math.sin(t * 37 + i);
        f.scale.set(1 + boost * 0.6, 1 + boost * 0.6, (0.4 + boost * 1.4) * flick);
      }
    }
    L.flameMat.opacity = Math.min(0.9, 0.3 + boost);
  }

  /** Turn this car into a translucent, unlit, shadowless ghost of one flat colour. */
  makeGhost(color: number, opacity: number): void {
    const cache = new Map<Material, MeshBasicMaterial>();
    this.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = false;
      o.receiveShadow = false;
      const src = o.material as Material;
      let g = cache.get(src);
      if (!g) {
        g = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false });
        cache.set(src, g);
      }
      o.material = g;
    });
  }

  setLivery(primary: number, accent: number): void {
    this.mats.paint.color.setHex(primary);
    this.mats.accent.color.setHex(accent);
    this.mats.accent.emissive.setHex(accent);
  }

  /** Hood cam: keep the hull (you see the bonnet) but hide parts that would block the view. */
  setCockpit(on: boolean): void {
    for (const m of this.model.cockpitHidden) m.visible = !on;
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
