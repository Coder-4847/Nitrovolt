import {
  AdditiveBlending, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, RingGeometry, Scene, SphereGeometry,
  Texture, Vector3, WebGLRenderTarget, BufferGeometry,
} from 'three';
import { CarDef } from '../data/cars';
import { CarView } from './CarView';
import { Arena } from './env/Arena';
import { Ground } from './env/Ground';
import { Scenery } from './env/Scenery';
import { Prop } from './env/SceneryPlan';
import { roadLogoTexture } from './env/Signage';
import { Sky } from './env/Sky';
import { THEMES, ThemeDef } from './env/Theme';
import { Rng } from '../core/Rng';

/**
 * The menu backdrop: the player's car turning slowly on a lit podium in a snowy stadium, with the driver
 * standing beside it. Its own scene and camera; the camera's view is offset so the car sits in the right
 * half of the screen, clear of the menu on the left.
 */
export class Showroom {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(32, 16 / 9, 0.1, 4000);
  private readonly turntable = new Group();
  private readonly sky = new Sky();
  private readonly ground = new Ground();
  private readonly arena: Arena;
  private readonly scenery: Scenery;
  private readonly driver: Group;
  private car: CarView | null = null;
  private carId = '';
  private time = 0;
  private envRT: WebGLRenderTarget | null = null;
  private readonly ledRing: MeshBasicMaterial;
  /** 0..1: how far right the car sits on screen (the menu layout decides). */
  shift = 0.18;

  constructor(pmrem: PMREMGenerator, theme: ThemeDef = THEMES.snow) {
    const s = this.scene;
    this.sky.apply(theme);
    this.ground.apply(theme, this.sky.sunDir);
    this.ground.mesh.position.y = -0.02;
    s.add(this.sky.mesh, this.ground.mesh);
    s.fog = new Fog(theme.fog.color, 120, 900);
    s.background = new Color(theme.fog.color);
    const hemi = new HemisphereLight(0xe6efff, 0x8a96a8, 1.1);
    const key = new DirectionalLight(0xfff4e8, 2.6);
    key.position.set(-6, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const c = key.shadow.camera;
    c.left = -6; c.right = 6; c.top = 6; c.bottom = -6; c.near = 1; c.far = 30;
    key.shadow.bias = -0.0004;
    const rim = new DirectionalLight(0xbcd6ff, 1.4);
    rim.position.set(6, 4, -7);
    s.add(hemi, key, rim);
    // reflections from the sky
    const envScene = new Scene();
    const envSky = new Sky();
    envSky.apply(theme);
    envSky.mesh.scale.setScalar(0.05);
    envScene.add(envSky.mesh);
    this.envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    s.environment = this.envRT.texture as Texture;
    s.environmentIntensity = 1.1;

    // the podium: a dark stepped turntable with a glowing ring and the logo on top
    const steel = new MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.35, metalness: 0.7 });
    const top = new MeshPhysicalMaterial({ color: 0x1c2027, roughness: 0.25, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 });
    const base = new Mesh(new CylinderGeometry(3.7, 4.0, 0.3, 64), steel);
    base.position.y = 0.15;
    base.receiveShadow = true;
    const plate = new Mesh(new CylinderGeometry(3.2, 3.3, 0.22, 64), top);
    plate.position.y = 0.41;
    plate.receiveShadow = true;
    this.ledRing = new MeshBasicMaterial({ color: new Color(theme.accent).lerp(new Color(0xffffff), 0.35), transparent: true, opacity: 0.9, blending: AdditiveBlending });
    const ring = new Mesh(new RingGeometry(3.3, 3.42, 96).rotateX(-Math.PI / 2), this.ledRing);
    ring.position.y = 0.525;
    const logo = new Mesh(new CircleGeometry(1.9, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: roadLogoTexture(theme.accent), transparent: true, opacity: 0.35, depthWrite: false }));
    logo.position.y = 0.524;
    this.turntable.add(plate, ring, logo);
    this.turntable.position.y = 0;
    s.add(base, this.turntable);

    // the stadium round about, and snowy pines between it and the podium
    this.arena = new Arena([-120, -160, 120, 80], 70, 0, theme.arena, 7);
    s.add(this.arena.group);
    const rng = new Rng(11);
    const props: Prop[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(42, 150);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > -20 && Math.abs(x) < 60) continue; // keep the view behind and around the camera open
      const h = rng.range(8, 17);
      props.push({ kind: 'pine', x, y: 0, z, rot: rng.range(0, 6.28), sx: h * 0.42, sy: h, sz: h * 0.42, color: 0x2e5a44, near: 999 });
    }
    for (let i = 0; i < 14; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(9, 24);
      const sz = rng.range(1.5, 3.5);
      props.push({ kind: 'rock', x: Math.cos(a) * r, y: -0.3, z: Math.sin(a) * r, rot: rng.range(0, 6.28), sx: sz, sy: sz * 0.6, sz, color: 0xe8eef5, near: 999 });
    }
    this.scenery = new Scenery(props, theme, false);
    s.add(this.scenery.group);

    this.driver = buildDriver(0xd31f2d, 0xf2f4f6);
    this.driver.position.set(2.5, 0.52, 1.6);
    this.driver.rotation.y = -0.25; // facing the camera
    s.add(this.driver);
    this.camera.position.set(-1.6, 2.1, 9.2);
    this.camera.lookAt(0.5, 0.8, 0);
  }

  /** Put this car on the podium (no-op when it is already there). */
  setCar(def: CarDef, livery: { primary: number; accent: number }): void {
    const key = `${def.id}:${livery.primary}:${livery.accent}`;
    if (key === this.carId) return;
    this.carId = key;
    if (this.car) this.turntable.remove(this.car.root);
    const p = def.params;
    const view = new CarView(def.id, p, livery.primary, livery.accent);
    view.addDriverLights();
    const rest = p.springLenMax * 0.75;
    // sit the wheels on the turntable top
    const y = 0.52 - (p.mountY - rest - p.wheelRadius);
    view.update({ position: new Vector3(0, y, 0), quaternion: view.root.quaternion.clone(), springLen: [rest, rest, rest, rest], steer: [0.32, 0.32, 0, 0], spin: [0, 0, 0, 0] });
    view.setSpeed(0);
    view.root.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = true;
    });
    this.car = view;
    this.turntable.add(view.root);
    recolorDriver(this.driver, livery.primary, livery.accent);
  }

  update(dt: number, width: number, height: number): void {
    this.time += dt;
    this.turntable.rotation.y = this.time * 0.22;
    this.ledRing.opacity = 0.75 + 0.2 * Math.sin(this.time * 2.2);
    this.arena.update(this.time);
    this.scenery.update(this.time);
    this.sky.update(this.time);
    this.sky.mesh.position.copy(this.camera.position);
    // gentle drift of the camera so the scene breathes
    const a = Math.sin(this.time * 0.11) * 0.25;
    this.camera.position.set(-1.6 + a * 2, 2.1 + Math.sin(this.time * 0.17) * 0.12, 9.2 - a);
    this.camera.lookAt(0.5, 0.8, 0);
    this.camera.aspect = width / height;
    // push the car to the right of the screen (the menu takes the left)
    this.camera.setViewOffset(width, height, -width * this.shift, 0, width, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.arena.dispose();
    this.scenery.dispose();
    this.envRT?.dispose();
  }
}

/** A racing driver in overalls and helmet, standing with one hand on the hip. Built from capsules. */
function buildDriver(suit: number, trim: number): Group {
  const g = new Group();
  const suitMat = new MeshStandardMaterial({ color: suit, roughness: 0.65 });
  const trimMat = new MeshStandardMaterial({ color: trim, roughness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.55 });
  const helmet = new MeshPhysicalMaterial({ color: trim, roughness: 0.22, clearcoat: 1 });
  const visor = new MeshPhysicalMaterial({ color: 0x14202c, roughness: 0.04, metalness: 0.6, clearcoat: 1 });
  const part = (geo: BufferGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number, rz = 0, rx = 0, sx = 1, sz = 1): Mesh => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.scale.set(sx, 1, sz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  // legs: thigh, shin, boot
  for (const sx of [-1, 1]) {
    part(new CapsuleGeometry(0.1, 0.36, 4, 12), suitMat, sx * 0.12, 0.74, 0, sx * 0.03);
    part(new CapsuleGeometry(0.085, 0.36, 4, 12), suitMat, sx * 0.13, 0.33, 0.01);
    part(new CapsuleGeometry(0.075, 0.14, 4, 10).rotateX(Math.PI / 2), dark, sx * 0.13, 0.07, 0.06);
    // side stripe
    part(new CylinderGeometry(0.012, 0.012, 0.8, 6), trimMat, sx * 0.215, 0.55, 0);
  }
  // hips, torso and chest, collar
  part(new CapsuleGeometry(0.17, 0.1, 6, 14), suitMat, 0, 0.98, 0, Math.PI / 2, 0, 1, 0.75);
  part(new CapsuleGeometry(0.2, 0.36, 6, 16), suitMat, 0, 1.22, 0, 0, 0, 1.18, 0.7);
  part(new CylinderGeometry(0.235, 0.235, 0.07, 18), trimMat, 0, 1.31, 0, 0, 0, 1, 0.7);
  part(new CylinderGeometry(0.2, 0.2, 0.05, 16), dark, 0, 0.96, 0, 0, 0, 1.1, 0.72);
  // shoulders and arms: left hanging relaxed, right with the hand on the hip
  for (const sx of [-1, 1]) part(new SphereGeometry(0.09, 14, 10), suitMat, sx * 0.26, 1.44, 0);
  part(new CapsuleGeometry(0.07, 0.26, 4, 10), suitMat, -0.3, 1.27, 0, -0.12);
  part(new CapsuleGeometry(0.062, 0.24, 4, 10), suitMat, -0.33, 1.0, 0.02, -0.05);
  part(new SphereGeometry(0.065, 12, 10), dark, -0.34, 0.83, 0.03);
  part(new CapsuleGeometry(0.07, 0.24, 4, 10), suitMat, 0.36, 1.3, 0, -0.75);
  part(new CapsuleGeometry(0.062, 0.22, 4, 10), suitMat, 0.36, 1.08, 0.03, 0.85);
  part(new SphereGeometry(0.065, 12, 10), dark, 0.24, 0.98, 0.05);
  // neck, helmet with a visor and a stripe
  part(new CylinderGeometry(0.06, 0.07, 0.1, 10), dark, 0, 1.53, 0);
  part(new SphereGeometry(0.16, 24, 18), helmet, 0, 1.7, 0);
  part(new SphereGeometry(0.163, 24, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.2), visor, 0, 1.7, 0);
  part(new SphereGeometry(0.162, 24, 4, 0, Math.PI * 2, Math.PI * 0.12, Math.PI * 0.06), suitMat, 0, 1.7, 0);
  g.userData.suit = suitMat;
  g.userData.trim = trimMat;
  g.userData.helmet = helmet;
  return g;
}

function recolorDriver(g: Group, suit: number, trim: number): void {
  (g.userData.suit as MeshStandardMaterial).color.setHex(suit);
  (g.userData.trim as MeshStandardMaterial).color.setHex(trim);
  (g.userData.helmet as MeshStandardMaterial).color.setHex(trim);
}
