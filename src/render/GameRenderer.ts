import {
  Color, DirectionalLight, Material, Fog, HemisphereLight, InstancedMesh, Mesh, NeutralToneMapping, PCFShadowMap, PMREMGenerator,
  PerspectiveCamera, Scene, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { CarDef } from '../data/cars';
import { RenderPose, Vehicle } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { TrackData } from '../tracks/TrackTypes';
import { CameraRig } from './CameraRig';
import { CarView } from './CarView';
import { Arena } from './env/Arena';
import { Ground } from './env/Ground';
import { buildPillars } from './env/Pillars';
import { Scenery } from './env/Scenery';
import { planScenery } from './env/SceneryPlan';
import { Sky } from './env/Sky';
import { THEMES, ThemeDef, themeFor } from './env/Theme';
import { QUALITY, QualityLevel, ResolutionGovernor } from './Quality';
import { SkidMarks } from './SkidMarks';
import { Sparks } from './Sparks';
import { TrackView } from './TrackView';
import { WheelFx } from './WheelFx';

const idHash = (s: string): number => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

const _v = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _f = new Vector3();
/** Ghost cars fade out when they come this close to the camera (m: transparent at the first, full at the second). */
const GHOST_FADE: [number, number] = [2.5, 9];

/**
 * Owns the Three.js scene: themed sky / fog / light / ground / scenery, the track, the car, cameras and
 * effects. It renders straight to the canvas (native MSAA, tone mapping in the materials); quality presets
 * scale resolution, shadows, scenery density and particle budgets.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  car: CarView;
  def: CarDef;
  /** Extra camera (replay orbit / free / menu backdrop); replaces the chase rig's view while set. */
  viewCamera: PerspectiveCamera | null = null;
  /** Dev only: render from an arbitrary camera instead of the rig (overview screenshots). */
  debugCam: PerspectiveCamera | null = null;
  trackView: TrackView | null = null;
  /** Ray query against the track colliders (set by the driving session); enables chase-camera collision. */
  sightProbe: ((origin: Vector3, dir: Vector3, max: number) => number | null) | null = null;
  /** Hold ~60 fps by lowering the render scale (Settings > Graphics). */
  dynamicResolution = true;
  wheelFx: WheelFx;
  readonly governor = new ResolutionGovernor();

  private readonly sky = new Sky();
  private readonly envSky = new Sky();
  private readonly ground = new Ground();
  private readonly hemi = new HemisphereLight(0xbcd4ff, 0x6a5440, 0.95);
  private readonly sun: DirectionalLight;
  private readonly ghosts = new Set<CarView>();
  private readonly pmrem: PMREMGenerator;
  private envRT: WebGLRenderTarget | null = null;
  private scenery: Scenery | null = null;
  private arena: Arena | null = null;
  private pillars: InstancedMesh | null = null;
  private skid: SkidMarks;
  private readonly sparks = new Sparks();
  private quality: QualityLevel;
  private theme: ThemeDef = THEMES.stadium;
  private track: TrackData | null = null;
  private clock = 0;
  private brake = 0;
  private boost = 0;

  constructor(
    private readonly container: HTMLElement,
    def: CarDef,
    params: VehicleParams,
    quality: QualityLevel,
    livery: { primary: number; accent: number },
  ) {
    this.def = def;
    this.quality = quality;
    const q = QUALITY[quality];
    this.renderer = new WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    // neutral tone mapping keeps paint and signage colours true instead of pushing them toward a filmic grade
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.info.autoReset = false; // count every pass of a frame (debug overlay)
    container.appendChild(this.renderer.domElement);
    this.pmrem = new PMREMGenerator(this.renderer);

    this.scene.add(this.sky.mesh, this.ground.mesh, this.hemi);
    this.sun = new DirectionalLight(0xfff0d8, 2.6);
    this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);
    this.envSky.mesh.scale.setScalar(0.05);

    this.car = new CarView(def.id, params, livery.primary, livery.accent);
    this.car.addDriverLights();
    this.rig.style = def.camera;
    this.wheelFx = new WheelFx(q.particles);
    this.scene.add(this.wheelFx.particles.points, this.car.root, this.sparks.mesh);
    this.skid = new SkidMarks(q.skidSegments, this.theme.fog);
    this.scene.add(this.skid.mesh);

    this.applyTheme(THEMES.stadium);
    this.applyQuality(quality);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  get themeDef(): ThemeDef {
    return this.theme;
  }

  /** Swap the player's car (the level declares which one drives it). */
  setCar(def: CarDef, params: VehicleParams, livery: { primary: number; accent: number }): void {
    this.scene.remove(this.car.root);
    this.def = def;
    this.car = new CarView(def.id, params, livery.primary, livery.accent);
    this.car.addDriverLights();
    this.scene.add(this.car.root);
    this.rig.style = def.camera;
    this.rig.snap();
    this.wheelFx.clear();
    this.skid.clear();
    this.skid.width = params.wheelRadius * 0.85;
  }

  /** A translucent ghost car in the scene; call `view.update(pose)` each frame. */
  addGhost(params: VehicleParams, carId: CarDef['id'], color: number, opacity = 0.42): CarView {
    const view = new CarView(carId, params, color, color);
    view.makeGhost(color, opacity);
    this.scene.add(view.root);
    this.ghosts.add(view);
    return view;
  }

  removeGhost(view: CarView): void {
    this.scene.remove(view.root);
    this.ghosts.delete(view);
  }

  // ------------------------------------------------------------------ theme

  private applyTheme(t: ThemeDef): void {
    this.theme = t;
    this.sky.apply(t);
    this.envSky.apply(t);
    this.ground.apply(t, this.sky.sunDir);
    this.scene.fog = new Fog(t.fog.color, t.fog.near, t.fog.far);
    this.scene.background = new Color(t.fog.color);
    this.hemi.color.setHex(t.light.hemiSky);
    this.hemi.groundColor.setHex(t.light.hemiGround);
    this.hemi.intensity = t.light.hemi;
    this.sun.color.setHex(t.light.sunColor);
    this.sun.intensity = t.light.sun;
    this.renderer.toneMappingExposure = t.light.exposure;
    // reflections: the themed sky baked into a prefiltered environment map
    const envScene = new Scene();
    envScene.add(this.envSky.mesh);
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.02, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = t.light.env;
    this.scene.remove(this.skid.mesh);
    this.skid.dispose();
    this.skid = new SkidMarks(QUALITY[this.quality].skidSegments, t.fog);
    this.scene.add(this.skid.mesh);
  }

  /** Show a track. `scenery: false` skips the scenery (editor: faster rebuilds, clear view of the grid). */
  setTrack(track: TrackData, opts: { scenery?: boolean } = {}): void {
    this.track = track;
    this.sceneryOn = opts.scenery !== false;
    const theme = themeFor(track.theme);
    if (theme !== this.theme) this.applyTheme(theme);
    if (this.trackView) {
      this.scene.remove(this.trackView.group);
      this.trackView.dispose();
    }
    this.trackView = new TrackView(track, theme);
    this.scene.add(this.trackView.group);
    let minY = Infinity;
    for (const p of track.centerline) minY = Math.min(minY, p.y);
    this.ground.mesh.position.y = Math.min(minY, track.killY + 30) - 12;
    this.buildScenery();
    this.skid.clear();
    this.sparks.clear();
  }

  private sceneryOn = true;

  private buildScenery(): void {
    if (this.scenery) {
      this.scene.remove(this.scenery.group);
      this.scenery.dispose();
      this.scenery = null;
    }
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
      this.arena = null;
    }
    if (this.pillars) {
      this.scene.remove(this.pillars);
      this.pillars.geometry.dispose();
      (this.pillars.material as Material).dispose();
      this.pillars = null;
    }
    if (!this.track || !this.sceneryOn) return;
    const groundY = this.ground.mesh.position.y;
    const seed = (this.track.seed ^ idHash(this.track.id)) >>> 0;
    const props = planScenery({ centerline: this.track.centerline, seed, groundY }, this.theme.scenery, QUALITY[this.quality].scenery);
    this.scenery = new Scenery(props, this.theme);
    this.arena = new Arena(this.track.centerline, groundY, this.theme.arena, seed);
    this.pillars = buildPillars(this.track.centerline, groundY);
    this.scene.add(this.scenery.group, this.arena.group);
    if (this.pillars) this.scene.add(this.pillars);
  }

  // ------------------------------------------------------------------ quality

  applyQuality(level: QualityLevel): void {
    const changedDensity = QUALITY[level].scenery !== QUALITY[this.quality].scenery;
    this.quality = level;
    const q = QUALITY[level];
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    const r = q.shadowRange;
    const c = this.sun.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 400;
    c.updateProjectionMatrix();
    this.sun.shadow.radius = q.softShadows ? 2.5 : 1;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.scene.traverse((o) => {
      if (o instanceof Mesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    this.scene.remove(this.skid.mesh);
    this.skid.dispose();
    this.skid = new SkidMarks(q.skidSegments, this.theme.fog);
    this.scene.add(this.skid.mesh);
    if (changedDensity) this.buildScenery();
    this.scene.remove(this.wheelFx.particles.points);
    this.wheelFx.particles.dispose();
    this.wheelFx = new WheelFx(q.particles);
    this.scene.add(this.wheelFx.particles.points);
    this.resize();
  }

  /** Current pixel ratio: device ratio capped by the preset, times the dynamic-resolution scale. */
  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio, QUALITY[this.quality].pixelRatioCap) * (this.dynamicResolution ? this.governor.scale : 1);
  }

  /** Dev only: look at `target` from `pos`; pass null to return to the normal camera. */
  debugView(pos: [number, number, number] | null, target: [number, number, number] = [0, 0, 0], fov = 50): void {
    if (!pos) {
      this.debugCam = null;
      return;
    }
    const c = new PerspectiveCamera(fov, this.rig.camera.aspect, 0.5, 5000);
    c.position.set(...pos);
    c.lookAt(...target);
    this.debugCam = c;
  }

  // ------------------------------------------------------------------ effects

  /** Brake lights and exhaust flames for this frame. */
  setDrive(brake: number, boost: number): void {
    this.brake = brake;
    this.boost = boost;
  }

  /** Spawn / update wheel particles, skid marks and sparks for the current physics state. */
  updateFx(dt: number, v: Vehicle): void {
    const h = this.renderer.domElement.height || 720;
    const fov = (this.rig.camera.fov * Math.PI) / 360;
    this.wheelFx.setScale(h / (2 * Math.tan(fov)));
    this.wheelFx.update(dt, v, this.def.particles);
    this.skid.update(dt, v);
    this.sparks.update(dt);
  }

  /** Touch-down puff (and sparks on a hard landing on a hard surface). */
  landingBurst(v: Vehicle, intensity: number): void {
    this.wheelFx.burst(v, intensity, this.def.particles);
    if (intensity > 14) this.sparks.burst(_v.copy(v.position).addScaledVector(v.up, -0.4), v.linvel, v.up, Math.min(40, intensity * 1.2), 0.6);
  }

  /** Wall / barrier hit: sparks off the side that hit, thrown back along the travel direction. */
  impactBurst(v: Vehicle, intensity: number): void {
    const side = this.clock % 2 < 1 ? 1 : -1;
    const at = _v.copy(v.position).addScaledVector(v.right, side * 0.9).addScaledVector(v.up, -0.2);
    _r.copy(v.right).multiplyScalar(side).addScaledVector(v.fwd, -0.6).normalize();
    this.sparks.burst(at, v.linvel, _r, Math.min(70, 10 + intensity * 3), 1);
  }

  /** Chassis scraping the ground. */
  scrapeBurst(v: Vehicle, intensity: number): void {
    this.sparks.burst(_v.copy(v.position).addScaledVector(v.up, -0.45), v.linvel, _r.copy(v.fwd).negate(), Math.min(30, 6 + intensity * 2), 0.5);
  }

  clearFx(): void {
    this.wheelFx.clear();
    this.skid.clear();
    this.sparks.clear();
    this.trackView?.gates.reset();
  }

  // ------------------------------------------------------------------ frame

  private resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.rig.resize(w, h);
  };

  /** Draw calls / triangles of the last frame, all passes included. */
  get frameStats(): { calls: number; triangles: number; scale: number } {
    return { calls: this.lastCalls, triangles: this.lastTris, scale: this.dynamicResolution ? this.governor.scale : 1 };
  }
  private lastCalls = 0;
  private lastTris = 0;

  render(dt: number, pose: RenderPose, velocity: Vector3, speed: number, boost = 0): void {
    this.lastCalls = this.renderer.info.render.calls;
    this.lastTris = this.renderer.info.render.triangles;
    this.renderer.info.reset();
    this.clock += dt;
    if (this.dynamicResolution && this.governor.update(dt)) this.resize();
    this.trackView?.update(this.clock, dt);
    this.scenery?.update(this.clock);
    this.arena?.update(this.clock);
    this.sky.update(this.clock);
    this.car.update(pose);
    this.car.setDrive(this.brake, Math.max(boost, this.boost), this.clock);
    this.car.setSpeed(speed * 3.6);
    this.rig.update(dt, pose, velocity, speed, boost);
    if (this.rig.mode !== 'hood') this.keepCameraInView(pose.position);
    const cam = this.rig.camera;
    this.car.setCockpit(this.rig.mode === 'hood' && !this.viewCamera && !this.debugCam);

    const view = this.viewCamera;
    if (view && view.aspect !== cam.aspect) {
      view.aspect = cam.aspect;
      view.updateProjectionMatrix();
    }
    const eye = this.debugCam ?? view ?? cam;
    // ghosts that drive right past the lens would cover the screen: fade them out up close
    for (const g of this.ghosts) {
      const d = g.root.position.distanceTo(eye.position);
      g.setGhostFade(Math.min(1, Math.max(0, (d - GHOST_FADE[0]) / (GHOST_FADE[1] - GHOST_FADE[0]))));
    }
    // sky + ground follow the camera, sun shadow follows the car
    this.sky.mesh.position.copy(eye.position);
    this.ground.update(this.clock, eye.position);
    this.placeSun(pose.position);
    this.renderer.render(this.scene, eye);
  }

  /**
   * Pull the chase camera in front of any track geometry between it and the car (tight corners lined with
   * barriers, tunnels, overhanging blocks), so a wall never fills the screen.
   */
  private keepCameraInView(car: Vector3): void {
    const probe = this.sightProbe;
    if (!probe) return;
    const cam = this.rig.camera;
    _v.copy(car).addScaledVector(cam.up, 0.9);
    _r.subVectors(cam.position, _v);
    const dist = _r.length();
    if (dist < 1.5) return;
    _r.divideScalar(dist);
    const hit = probe(_v, _r, dist);
    if (hit === null) return;
    this.rig.constrain(Math.max(1.2, hit - 0.4), _v, _r);
  }

  /**
   * The sun's shadow camera follows the car, snapped to whole shadow-map texels in light space so the
   * shadows do not crawl or shimmer as the car moves.
   */
  private placeSun(target: Vector3): void {
    const q = QUALITY[this.quality];
    const texel = (q.shadowRange * 2) / q.shadowMapSize;
    const dir = this.sky.sunDir;
    // light-space basis
    _f.copy(dir).negate();
    _u.set(0, 1, 0);
    if (Math.abs(_f.y) > 0.99) _u.set(0, 0, 1);
    _r.crossVectors(_u, _f).normalize();
    _u.crossVectors(_f, _r).normalize();
    const x = Math.round(target.dot(_r) / texel) * texel;
    const y = Math.round(target.dot(_u) / texel) * texel;
    const z = target.dot(_f);
    _v.set(0, 0, 0).addScaledVector(_r, x).addScaledVector(_u, y).addScaledVector(_f, z);
    this.sun.target.position.copy(_v);
    this.sun.position.copy(_v).addScaledVector(dir, 160);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.scenery?.dispose();
    this.arena?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
