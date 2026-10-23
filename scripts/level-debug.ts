// npx tsx scripts/level-debug.ts <levelId> [maxSpeed] : bot drive log with the level's car
import { readFileSync } from 'node:fs';
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { PathBot } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson } from '../src/tracks/TrackSchema';

const id = process.argv[2] ?? 'stunt01';
const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8')) as TrackJson;
const track = buildTrack(json);
const def = getCar(json.car);
const sim = await Simulation.create(track, carParams(def.id), 0, undefined, def.behavior);
const bot = new PathBot(track.centerline, track.centerSurface, (json.laps ?? 1) > 1, sim.vehicle.params, track.centerFrame);
bot.maxSpeed = Number(process.argv[3] ?? 60);
if (process.env.LOOK) bot.lookTime = Number(process.env.LOOK);
if (process.env.SLEW) bot.steerSlew = Number(process.env.SLEW);
if (process.env.LAT) bot.lateralBudget = Number(process.env.LAT);
const v = sim.vehicle;
let lastRespawn = 0;
for (let i = 0; i < 12000 && sim.run.state !== 'finished'; i++) {
  const f = bot.drive(v);
  sim.step(f);
  if (i % 25 === 0) console.log(`t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(0)}% spd=${v.speed.toFixed(0)}m/s pos=${v.position.toArray().map((n) => n.toFixed(0))} surf=${v.dominantSurface()} in=${f.steer.toFixed(2)}/${f.accel.toFixed(1)}/${f.brake.toFixed(1)} slip=${(v.bodySlip * 57).toFixed(0)} c=${v.wheelsOnGround} rs=${sim.respawnCount}`);
  if (sim.respawnCount > lastRespawn) { lastRespawn = sim.respawnCount; if (lastRespawn > 1) break; }
}
