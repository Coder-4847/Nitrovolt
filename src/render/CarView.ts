import { AdditiveBlending, CanvasTexture, Color, ConeGeometry, Group, InstancedMesh, Material, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import { CarId } from '../data/cars';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { buildDune } from './cars/dune';
import { buildFrost } from './cars/frost';
import { buildGravel } from './cars/gravel';
import { CarMaterials, CarModel, makeMaterials, makeWheel, paintLivery } from './cars/parts';
import { buildVolt } from './cars/volt';

/** Race numbers painted on each car's livery. */
const NUMBERS: Record<CarId, number> = { volt: 1, gravel: 7, frost: 22, dune: 44 };

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
  /** Shown suspension length per wheel (droop is rate-limited; see update). */
  private readonly shownSpring = [0, 0, 0, 0];
  private readonly lastSpin = [0, 0, 0, 0];
  private readonly shownSpin = [0, 0, 0, 0];
  private readonly blurAmount = [0, 0, 0, 0];
  private first = true;

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
    this.mats = makeMaterials(primary, accent, NUMBERS[id]);
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
    this.addPlate();
  }

  private plate: { ctx: CanvasRenderingContext2D; tex: CanvasTexture; shown: number } | null = null;

  /** The digital speed display on the back of the car (canvas texture, redrawn when the number changes). */
  private addPlate(): void {
    const p = this.model.plate;
    if (!p) return;
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 64;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(p.w, p.h), new MeshBasicMaterial({ map: tex }));
    mesh.position.set(p.x, p.y, p.z + 0.012);
    this.body.add(mesh);
    this.plate = { ctx: c.getContext('2d')!, tex, shown: -1 };
    this.setSpeed(0);
  }

  /** Speed (km/h) shown on the rear display. */
  setSpeed(kmh: number): void {
    const P = this.plate;
    const v = Math.max(0, Math.min(999, Math.round(kmh)));
    if (!P || v === P.shown) return;
    P.shown = v;
    const g = P.ctx;
    g.fillStyle = '#07090c';
    g.fillRect(0, 0, 192, 64);
    g.font = 'italic 700 54px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillText('888', 96, 34);
    g.fillStyle = '#f2f6ff';
    g.fillText(String(v).padStart(3, ' '), 96, 34);
    P.tex.needsUpdate = true;
  }

  private lights: { flames: Mesh[]; flameMat: MeshBasicMaterial; fire: boolean } | null = null;

  /**
   * Boost outlets: a short glow (electric cars) or flame (combustion) at each exhaust the model declares.
   * Lamps are part of the models; brake lights brighten the tail material.
   */
  addDriverLights(): void {
    const fire = this.model.flame === 'fire';
    const flameMat = new MeshBasicMaterial({
      color: fire ? new Color(1, 0.55, 0.2) : new Color(0.55, 0.8, 1),
      transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false,
    });
    const flameGeo = new ConeGeometry(fire ? 0.09 : 0.07, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const flames: Mesh[] = [];
    for (const [x, y, z] of this.model.exhaust) {
      const f = new Mesh(flameGeo, flameMat);
      f.position.set(x, y, z + 0.02);
      f.visible = false;
      f.renderOrder = 7;
      this.body.add(f);
      flames.push(f);
    }
    this.lights = { flames, flameMat, fire };
  }

  /** Brake lights (0..1) and boost outlets from the boost level (0..1); `t` flickers a flame. */
  setDrive(brake: number, boost: number, t: number): void {
    const L = this.lights;
    if (!L) return;
    const b = 0.5 + brake * 0.5;
    this.mats.tail.color.setRGB(b, 0.03 + brake * 0.05, 0.03 + brake * 0.04);
    const on = boost > 0.05;
    for (const [i, f] of L.flames.entries()) {
      f.visible = on;
      if (on) {
        const flick = L.fire ? 0.8 + 0.2 * Math.sin(t * 60 + i * 2.1) * Math.sin(t * 37 + i) : 0.95 + 0.05 * Math.sin(t * 40 + i);
        f.scale.set(1 + boost * 0.4, 1 + boost * 0.4, (0.25 + boost * 0.75) * flick);
      }
    }
    L.flameMat.opacity = Math.min(0.6, 0.2 + boost * 0.5);
  }

  private ghostMats: MeshBasicMaterial[] = [];
  private ghostOpacity = 1;

  private ghostTag: Sprite | null = null;

  /**
   * Turn this car into a translucent, unlit, shadowless ghost tinted one colour. Each part keeps its own
   * brightness (body light, tyres and glass dark), so the ghost still reads as a car, and a small tag floats
   * above it when `label` is given.
   */
  makeGhost(color: number, opacity: number, label?: string): void {
    const cache = new Map<Material, MeshBasicMaterial>();
    this.ghostOpacity = opacity;
    if (label) {
      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 64;
      const g = c.getContext('2d')!;
      const css = `#${color.toString(16).padStart(6, '0')}`;
      g.fillStyle = 'rgba(8,11,16,.82)';
      g.beginPath();
      g.roundRect(4, 8, 184, 48, 10);
      g.fill();
      g.strokeStyle = css;
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = css;
      g.font = '800 30px "Barlow Condensed", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, 96, 33);
      const tex = new CanvasTexture(c);
      tex.colorSpace = SRGBColorSpace;
      this.ghostTag = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
      this.ghostTag.scale.set(1.8, 0.6, 1);
      this.ghostTag.position.set(0, 2.3, 0);
      this.ghostTag.renderOrder = 10;
      this.root.add(this.ghostTag);
    }
    this.root.traverse((o) => {
      if (!(o instanceof Mesh || o instanceof InstancedMesh)) return;
      o.castShadow = false;
      o.receiveShadow = false;
      const src = o.material as Material;
      let g = cache.get(src);
      if (!g) {
        const base = (src as { color?: Color }).color;
        // perceived brightness of the part keeps the ghost's shape readable
        const lum = base ? 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b : 0.5;
        g = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(0.35 + 1.1 * Math.min(1, lum * 1.6)), transparent: true, opacity, depthWrite: false, fog: false });
        cache.set(src, g);
        this.ghostMats.push(g);
      }
      o.material = g;
    });
  }

  /** Ghost visibility 0..1 (fades a ghost out as it passes close to the camera). */
  setGhostFade(f: number): void {
    for (const m of this.ghostMats) m.opacity = this.ghostOpacity * f;
    if (this.ghostTag) this.ghostTag.material.opacity = f;
    this.root.visible = f > 0.02 && this.ghostShown;
  }

  /** Ghosts hidden by the session (replays) stay hidden regardless of the fade. */
  ghostShown = true;

  setLivery(primary: number, accent: number): void {
    this.mats.paint.color.setHex(primary);
    this.mats.accent.color.setHex(accent);
    const map = this.mats.livery.map as CanvasTexture | null;
    if (map) {
      paintLivery((map.image as HTMLCanvasElement).getContext('2d')!, primary, accent, NUMBERS[this.id]);
      map.needsUpdate = true;
    }
  }

  /** Hood cam: keep the hull (you see the bonnet) but hide parts that would block the view. */
  setCockpit(on: boolean): void {
    for (const m of this.model.cockpitHidden) m.visible = !on;
  }

  /**
   * Place the car and its wheels for this frame. Two things keep the wheels calm at speed: a wheel that
   * loses contact for a tick no longer flicks to full droop (extension is rate-limited, compression is
   * immediate), and a wheel spinning faster than the eye can follow shows a blurred rim that turns
   * slowly instead of strobing spokes.
   */
  update(pose: RenderPose): void {
    this.root.position.copy(pose.position);
    this.root.quaternion.copy(pose.quaternion);
    for (let k = 0; k < 4; k++) {
      const [x, z] = this.mounts[k]!;
      const wr = this.wheelRoots[k]!;
      const target = pose.springLen[k]!;
      if (this.first || target < this.shownSpring[k]!) this.shownSpring[k] = target;
      else this.shownSpring[k] = Math.min(target, this.shownSpring[k]! + 0.045);
      wr.position.set(x, this.mountY - this.shownSpring[k]!, z);
      wr.rotation.y = -pose.steer[k]!;
      const spin = pose.spin[k]!;
      const d = this.first ? 0 : spin - this.lastSpin[k]!;
      this.lastSpin[k] = spin;
      // past ~0.35 rad per frame the spokes start to alias: fade in the blur and slow the visible roll
      const fast = Math.min(1, Math.max(0, (Math.abs(d) - 0.25) / 0.2));
      this.blurAmount[k] += (fast - this.blurAmount[k]!) * 0.3;
      const step = Math.sign(d) * Math.min(Math.abs(d), 0.25 + 0.05 * this.blurAmount[k]!);
      this.shownSpin[k] = this.blurAmount[k]! > 0.5 ? this.shownSpin[k]! + step : spin;
      const w = this.wheelSpin[k]!;
      w.rotation.x = -this.shownSpin[k]!;
      const blurred = this.blurAmount[k]! > 0.5;
      const detail = w.userData.detail as Array<{ visible: boolean }> | undefined;
      if (detail) for (const o of detail) o.visible = !blurred;
      const blur = w.userData.blur as { visible: boolean } | undefined;
      if (blur) blur.visible = blurred;
    }
    this.first = false;
  }
}
