import { carParams } from '../../src/data/cars';
import { Simulation } from '../../src/physics/Simulation';
import { PathBot, applyBotHints } from '../../src/tracks/PathBot';
import { buildLevel } from '../levels/build';
import { LEVEL_DEFS } from '../levels/index';
const def = LEVEL_DEFS.find((d) => d.id === 'lab')!;
const { track } = buildLevel(def);
for (const lat of [45, 70, 100, 140]) {
  const sim = await Simulation.create(track, carParams('volt'), false, undefined, undefined, 'volt');
  const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params);
  applyBotHints(bot, { maxSpeed: 85, lateralBudget: lat });
  const v = sim.vehicle;
  let entry = 0, minW = 4, lostAt = -1;
  for (let i = 0; i < 1600; i++) {
    sim.step(bot.drive(v));
    if (!entry && v.position.x > 118) entry = v.speed * 3.6;
    if (v.position.x > 118 && bot.progress < 0.13) { if (v.wheelsOnGround < minW) minW = v.wheelsOnGround; if (v.wheelsOnGround === 0 && lostAt < 0) lostAt = bot.progress; }
  }
  console.log(`lat ${lat}: entry ${entry.toFixed(0)} km/h, min wheels ${minW}, lost contact at ${lostAt.toFixed(3)}, progress ${(bot.progress * 100).toFixed(1)}%`);
}
