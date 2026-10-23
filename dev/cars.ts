// Dev-only car viewer: every car from four angles on a grey pad. Open /dev/cars.html?car=volt (or all).
import '@fontsource/barlow-condensed/700.css';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer, Quaternion, Vector3 } from 'three';
import { CAR_IDS, CARS, CarId } from '../src/data/cars';
import { CarView } from '../src/render/CarView';

const q = new URLSearchParams(location.search);
const ids = (q.get('car') ?? 'all') === 'all' ? CAR_IDS : [q.get('car') as CarId];
const W = 1600, H = 300 * ids.length;
const r = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H);
r.setScissorTest(true);
document.body.appendChild(r.domElement);
const scene = new Scene();
scene.background = new Color(0x9aa7b4);
scene.add(new HemisphereLight(0xdde8ff, 0x556070, 1.2), new AmbientLight(0xffffff, 0.2));
const sun = new DirectionalLight(0xffffff, 2.4);
sun.position.set(-4, 8, -3);
scene.add(sun);
const pad = new Mesh(new PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0x6b7078, roughness: 0.9 }));
scene.add(pad);
const views: Array<[number, number, number]> = [[-4.5, 1.6, -4.2], [0, 1.8, 6.4], [6.2, 0.9, 0.2], [3.4, 4.2, -3.2]];
await document.fonts.load('700 20px "Barlow Condensed"');
ids.forEach((id, row) => {
  const def = CARS[id];
  const p = def.params;
  const view = new CarView(id, p, def.livery.primary, def.livery.accent);
  view.addDriverLights();
  const x = row * 30;
  const groundY = p.mountY - p.springLenMax * 0.8 - p.wheelRadius;
  view.update({ position: new Vector3(x, -groundY, 0), quaternion: new Quaternion(), springLen: [0, 1, 2, 3].map(() => p.springLenMax * 0.8), steer: [0.25, 0.25, 0, 0], spin: [0, 0, 0, 0] });
  view.setSpeed(272);
  scene.add(view.root);
  views.forEach(([cx, cy, cz], k) => {
    const cam = new PerspectiveCamera(34, W / 4 / 300, 0.1, 100);
    cam.position.set(x + cx, cy, cz);
    cam.lookAt(x, 0.45, 0);
    r.setViewport((k * W) / 4, H - (row + 1) * 300, W / 4, 300);
    r.setScissor((k * W) / 4, H - (row + 1) * 300, W / 4, 300);
    r.render(scene, cam);
  });
});
document.title = 'ready';
