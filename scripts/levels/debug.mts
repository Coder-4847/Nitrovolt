// Bot drive log for one level definition. Usage: FROM=0.9 TO=1 npx tsx scripts/levels/debug.mts <id> [maxSpeed]
import { carParams, getCar } from '../../src/data/cars';
import { Simulation } from '../../src/physics/Simulation';
import { PathBot, applyBotHints } from '../../src/tracks/PathBot';
import { hintLadder } from '../../src/tracks/Validate';
import { buildLevel } from './build';
import { findDef } from './index';

const id = process.argv[2]!;
const def = findDef(id)!;
const b = buildLevel(def);
const car = getCar(def.car);
const sim = await Simulation.create(b.track, carParams(car.id), false, undefined, car.behavior);
const bot = new PathBot(b.track.centerline, b.track.centerSurface, false, sim.vehicle.params, b.track.centerFrame);
const hints = hintLadder(def.car, def.hints)[Number(process.env.STYLE ?? 0)]!;
applyBotHints(bot, hints);
if (process.argv[3]) bot.maxSpeed = Number(process.argv[3]);
const from = Number(process.env.FROM ?? 0), to = Number(process.env.TO ?? 1), every = Number(process.env.EVERY ?? 25);
const v = sim.vehicle;
let wasAir = false;
for (let i = 0; i < 20000 && sim.run.state !== 'finished'; i++) {
  const f = bot.drive(v);
  sim.step(f);
  const air = v.wheelsOnGround === 0;
  if (process.env.AIR && air !== wasAir) console.log(`${air ? 'TAKEOFF' : 'LAND   '} t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(1)}% spd=${(v.speed * 3.6).toFixed(0)}km/h pos=${v.position.toArray().map((n) => n.toFixed(0))} car=${sim.carId}`);
  wasAir = air;
  if (process.env.OFF && v.wheels.some((w) => w.contact && w.offroad) && i % 10 === 0) console.log(`OFFROAD t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(1)}% spd=${(v.speed * 3.6).toFixed(0)}km/h pos=${v.position.toArray().map((n) => n.toFixed(0))} steer=${f.steer.toFixed(2)}`);
  if (!process.env.AIR && i % every === 0 && sim.time >= Number(process.env.T0 ?? 0) && sim.time <= Number(process.env.T1 ?? 1e9)) console.log(`t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(1)}% spd=${(v.speed * 3.6).toFixed(0)}km/h pos=${v.position.toArray().map((n) => n.toFixed(0))} car=${sim.carId} surf=${v.dominantSurface()} in=${f.steer.toFixed(2)}/${f.accel.toFixed(1)}/${f.brake.toFixed(1)} slip=${(v.bodySlip * 57).toFixed(0)} c=${v.wheelsOnGround} rs=${sim.respawnCount}`);
  if (sim.respawnCount > 0) break;
}
