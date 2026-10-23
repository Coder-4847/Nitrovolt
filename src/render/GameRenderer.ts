import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, Mesh, PCFShadowMap,
  PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three';
import { RenderPose } from '../physics/Vehicle';
import { CarDef } from '../data/cars';
import { Vehicle } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { TrackData } from '../tracks/TrackTypes';
import { CameraRig } from './CameraRig';
import { CarView } from './CarView';
import { QUALITY, QualityLevel } from './Quality';
import { Sky } from './Sky';
import { SpeedFx } from './SpeedFx';
import { TrackView } from './TrackView';
import { WheelFx } from './WheelFx';

const FOG_COLOR = 0xe6c9ae;

/** Owns the Three.js scene: sky, lights, track, car, camera and speed effects. */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  car: CarView;
  def: CarDef;
  /** Extra camera (replay orbit / free / menu backdrop); replaces the chase rig's view while set. */
  viewCamera: PerspectiveCamera | null = null;
  private readonly ghosts = new Set<CarView>();
  private readonly sky = new Sky();
  private readonly sun: DirectionalLight;
  private readonly ground: Mesh;
  trackView: TrackView | null = null;
  private clock = 0;
  private speedFx: SpeedFx;
  private quality: QualityLevel;
  speedFxEnabled = true;
  /** Dev only: render from an arbitrary camera instead of the rig (overview screenshots). */
  debugCam: PerspectiveCamera | null = null;

  readonly wheelFx = new WheelFx();

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
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new Color(FOG_COLOR);
    this.scene.fog = new Fog(FOG_COLOR, 120, 1100);
    this.scene.add(this.sky.mesh);
    this.scene.add(new HemisphereLight(0xbcd4ff, 0x6a5440, 0.95));

    this.sun = new DirectionalLight(0xfff0d8, 2.6);
    this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new Mesh(
      new PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2),
      new ShaderMaterial({
        fog: false,
        transparent: false,
        uniforms: { uFog: { value: new Color(FOG_COLOR) } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `
          uniform vec3 uFog; varying vec3 vW;
          void main(){
            vec2 g = abs(fract(vW.xz/50.0 - 0.5) - 0.5) / fwidth(vW.xz/50.0);
            float line = 1.0 - min(min(g.x, g.y), 1.0);
            vec3 base = vec3(0.16,0.19,0.26);
            vec3 col = mix(base, vec3(0.38,0.46,0.62), line*0.8);
            float d = length(vW.xz - cameraPosition.xz);
            col = mix(col, uFog, smoothstep(300.0, 2400.0, d));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    this.scene.add(this.ground);

    this.car = new CarView(def.id, params, livery.primary, livery.accent);
    this.rig.style = def.camera;
    this.scene.add(this.wheelFx.particles.points);
    this.scene.add(this.car.root);

    this.speedFx = new SpeedFx(q.speedLines);
    this.scene.add(this.speedFx.mesh);

    this.applyQuality(quality);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  /** Swap the player's car (the level declares which one drives it). */
  setCar(def: CarDef, params: VehicleParams, livery: { primary: number; accent: number }): void {
    this.scene.remove(this.car.root);
    this.def = def;
    this.car = new CarView(def.id, params, livery.primary, livery.accent);
    this.scene.add(this.car.root);
    this.rig.style = def.camera;
    this.rig.snap();
    this.wheelFx.clear();
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

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  applyQuality(level: QualityLevel): void {
    this.quality = level;
    const q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatioCap));
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
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.scene.traverse((o) => {
      if (o instanceof Mesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
    this.resize();
    this.speedFx.dispose();
    this.scene.remove(this.speedFx.mesh);
    this.speedFx = new SpeedFx(q.speedLines);
    this.scene.add(this.speedFx.mesh);
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

  /** Spawn / update wheel particles for the current physics state. */
  updateFx(dt: number, v: Vehicle): void {
    const h = this.renderer.domElement.height || 720;
    const fov = (this.rig.camera.fov * Math.PI) / 360;
    this.wheelFx.setScale(h / (2 * Math.tan(fov)));
    this.wheelFx.update(dt, v, this.def.particles);
  }

  /** Touch-down puff. */
  landingBurst(v: Vehicle, intensity: number): void {
    this.wheelFx.burst(v, intensity, this.def.particles);
  }

  setTrack(track: TrackData): void {
    if (this.trackView) {
      this.scene.remove(this.trackView.group);
      this.trackView.dispose();
    }
    this.trackView = new TrackView(track);
    this.scene.add(this.trackView.group);
    let minY = Infinity;
    for (const p of track.centerline) minY = Math.min(minY, p.y);
    this.ground.position.y = Math.min(minY, track.killY + 30) - 12;
  }

  private resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.rig.resize(w, h);
  };

  render(dt: number, pose: RenderPose, velocity: Vector3, speed: number, boost = 0): void {
    this.clock += dt;
    this.trackView?.update(this.clock);
    this.car.update(pose);
    this.rig.update(dt, pose, velocity, speed, boost);
    const cam = this.rig.camera;
    this.car.setCockpit(this.rig.mode === 'hood');

    const camRight = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const camUp = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const camFwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.speedFx.update(dt, cam.position, camRight, camUp, camFwd, velocity, speed, this.speedFxEnabled, boost);

    // sky + ground follow the camera, sun shadow follows the car
    this.sky.mesh.position.copy(cam.position);
    this.ground.position.x = Math.round(cam.position.x / 50) * 50;
    this.ground.position.z = Math.round(cam.position.z / 50) * 50;
    this.sun.target.position.copy(pose.position);
    this.sun.position.copy(pose.position).addScaledVector(this.sky.sunDir, 160);

    const view = this.viewCamera;
    if (view && view.aspect !== cam.aspect) {
      view.aspect = cam.aspect;
      view.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.debugCam ?? view ?? cam);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
