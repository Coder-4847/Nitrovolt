import { Group, Mesh } from 'three';
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
