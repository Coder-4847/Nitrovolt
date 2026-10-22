import { readFileSync } from 'node:fs';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { PathBot } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { TrackJson } from '../src/tracks/TrackSchema';

const id = process.argv[2] ?? 'stunt01';
const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8')) as TrackJson;
const track = buildTrack(json);
const sim = await Simulation.create(track, cloneParams(VOLT), 0);
const bot = new PathBot(track.centerline, track.centerSurface);
bot.maxSpeed = 75;
bot.lookTime = 0.45; bot.steerSlew = 0.15;
const v = sim.vehicle;
let lastRespawn = 0;
for (let i = 0; i < 12000 && sim.run.state !== 'finished'; i++) {
  sim.step(bot.drive(v));
  if (i % 50 === 0) console.log(`t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(0)}% spd=${(v.speed * 3.6).toFixed(0)} pos=${v.position.toArray().map((n) => n.toFixed(0))} c=${v.wheelsOnGround} up=${v.up.y.toFixed(2)} rs=${sim.respawnCount}`);
  if (sim.respawnCount > lastRespawn) { lastRespawn = sim.respawnCount; if (lastRespawn > 2) break; }
}
