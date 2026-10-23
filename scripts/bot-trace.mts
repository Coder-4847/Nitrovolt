// Drive one hand-made level with the validation bot and print its state over time (debugging layouts).
// Usage: npx tsx scripts/bot-trace.mts <id> [fromSeconds] [toSeconds] [every ticks] (env: STYLE=0..2 hint ladder rung)
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { hintLadder } from '../src/tracks/Validate';
import { buildLevel } from './levels/build';
import { findDef } from './levels/index';

const [, , id = 'lab', from = '0', to = '999', every = '10'] = process.argv;
const def = findDef(id)!;
const { json, track } = buildLevel(def);
const car = getCar(json.car);
const sim = await Simulation.create(track, carParams(car.id), false, undefined, car.behavior, car.id);
const bot = new PathBot(track.centerline, track.centerSurface, (json.laps ?? 1) > 1, sim.vehicle.params, track.centerFrame);
const hints = hintLadder(json.car, def.hints)[Number(process.env.STYLE ?? 0)]!;
applyBotHints(bot, hints);
console.log('hints', JSON.stringify(hints));
const v = sim.vehicle;
for (let i = 0; i < 30000 && sim.run.state !== 'finished'; i++) {
  const f = bot.drive(v);
  sim.step(f);
  for (const e of sim.events) if (e.type === 'car' || e.type === 'checkpoint' || e.type === 'impact') console.log(`  t=${sim.time.toFixed(2)} event ${JSON.stringify(e)}`);
  sim.events.length = 0;
  const t = sim.time;
  if (t >= Number(from) && t <= Number(to) && i % Number(every) === 0) {
    console.log(`t=${t.toFixed(2)} car=${sim.carId} pos=${v.position.toArray().map((n) => n.toFixed(1)).join(',')} up=${v.up.toArray().map((n) => n.toFixed(2)).join(',')} kmh=${(v.speed * 3.6).toFixed(0)} wheels=${v.wheelsOnGround} slip=${(v.bodySlip * 57.3).toFixed(0)} in=${f.steer.toFixed(2)}/${f.accel.toFixed(2)}/${f.brake.toFixed(2)} prog=${(bot.progress * 100).toFixed(1)}% resp=${sim.respawnCount}`);
  }
  if (t > Number(to)) break;
}
console.log('state', sim.run.state, 'time', sim.time.toFixed(2), 'respawns', sim.respawnCount);
