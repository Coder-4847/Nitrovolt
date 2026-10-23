import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { RenderPose } from '../src/physics/Vehicle';
import { CameraRig } from '../src/render/CameraRig';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';

/** Renders the chase camera at a fixed frame rate (no GPU) and measures how much the car jitters on screen. */
async function main(): Promise<void> {
  const id = process.argv[2] ?? 'c01';
  const fps = Number(process.argv[3] ?? 60);
  const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8'));
  const track = buildTrack(json);
  const def = getCar(json.car);
  const sim = await Simulation.create(track, carParams(json.car), false, undefined, def.behavior);
  const bot = new PathBot(track.centerline, track.centerSurface, track.laps > 1, sim.vehicle.params, track.centerFrame);
  applyBotHints(bot, json.bot);
  const v = sim.vehicle;
  const rig = new CameraRig();
  rig.style = def.camera;
  rig.resize(1600, 900);
  const pose: RenderPose = { position: new Vector3(), quaternion: new Quaternion(), springLen: [0, 0, 0, 0], steer: [0, 0, 0, 0], spin: [0, 0, 0, 0] };
  let acc = 0;
  const frameDt = 1 / fps;
  const ndc: Vector3[] = [];
  let constrained = 0, frames = 0;
  const _o = new Vector3(), _d = new Vector3();
  for (let f = 0; f < fps * 60 && sim.run.state !== 'finished'; f++) {
    acc += frameDt;
    while (acc >= 0.01) { sim.step(bot.drive(v)); acc -= 0.01; }
    v.interpolate(acc / 0.01, pose);
    rig.update(frameDt, pose, v.linvel, v.speed, 0);
    const cam = rig.camera;
    _o.copy(pose.position).addScaledVector(cam.up, 0.9);
    _d.subVectors(cam.position, _o);
    const dist = _d.length();
    if (dist > 1.5) {
      _d.divideScalar(dist);
      const hit = v.sightDistance(_o, _d, dist);
      if (hit !== null) { rig.constrain(Math.max(1.2, hit - 0.4), _o, _d); constrained++; }
    }
    cam.updateMatrixWorld();
    ndc.push(pose.position.clone().project(cam));
    frames++;
  }
  // second difference of the car's screen position = jitter
  let j = 0, jmax = 0, big = 0;
  for (let i = 2; i < ndc.length; i++) {
    const dd = ndc[i]!.clone().sub(ndc[i - 1]!).sub(ndc[i - 1]!.clone().sub(ndc[i - 2]!));
    const m = Math.hypot(dd.x * 800, dd.y * 450);
    j += m; jmax = Math.max(jmax, m);
    if (m > 3) big++;
  }
  console.log(`${id} @${fps}fps frames ${frames} constrained ${constrained} | screen jerk avg ${(j / ndc.length).toFixed(2)} px max ${jmax.toFixed(1)} px, frames >3px ${big}`);
}
main();
