import { Quaternion, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';

/** Measures high-frequency body motion (the "vibration") and event spam while the bot drives a level. */
async function main(): Promise<void> {
  const id = process.argv[2] ?? 'c01';
  const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8'));
  const track = buildTrack(json);
  const def = getCar(json.car);
  const sim = await Simulation.create(track, carParams(json.car), false, undefined, def.behavior);
  const bot = new PathBot(track.centerline, track.centerSurface, track.laps > 1, sim.vehicle.params, track.centerFrame);
  applyBotHints(bot, json.bot);
  const v = sim.vehicle;
  const ev: Record<string, number> = {};
  let flips = 0, hfPitch = 0, hfRoll = 0, hfYaw = 0, hfSpring = 0, n = 0, contactLoss = 0;
  let prevW = new Vector3(), prevD = new Vector3(), prevS = [0, 0, 0, 0], prevC = [true, true, true, true];
  const q = new Quaternion();
  for (let i = 0; i < 20000 && sim.run.state !== 'finished'; i++) {
    sim.step(bot.drive(v));
    for (const e of sim.events) ev[e.type] = (ev[e.type] ?? 0) + 1;
    sim.events.length = 0;
    q.copy(v.quaternion).invert();
    const w = v.angvel.clone().applyQuaternion(q);
    const d = w.clone().sub(prevW);
    if (v.wheelsOnGround === 4 && v.speed > 20) {
      n++;
      hfPitch += Math.abs(d.x); hfYaw += Math.abs(d.y); hfRoll += Math.abs(d.z);
      if (d.x * prevD.x < 0 && Math.abs(d.x) > 0.02) flips++;
      for (let k = 0; k < 4; k++) hfSpring += Math.abs(v.wheels[k]!.springLen - prevS[k]!);
    }
    for (let k = 0; k < 4; k++) { if (prevC[k] && !v.wheels[k]!.contact && v.speed > 20) contactLoss++; prevC[k] = v.wheels[k]!.contact; prevS[k] = v.wheels[k]!.springLen; }
    prevW = w; prevD = d;
  }
  console.log(id, 'time', sim.time.toFixed(2), 'state', sim.run.state);
  console.log('events', ev);
  console.log(`per tick (4 wheels, >72kmh): dPitch ${(hfPitch / n).toFixed(4)} dYaw ${(hfYaw / n).toFixed(4)} dRoll ${(hfRoll / n).toFixed(4)} rad/s, spring ${(hfSpring / n * 1000).toFixed(2)} mm, pitch flips ${(flips / n * 100).toFixed(1)}%, contact losses ${contactLoss}`);
}
main();
