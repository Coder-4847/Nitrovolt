import { carParams } from '../../src/data/cars';
import { makeFrame } from '../../src/core/InputFrame';
import { Simulation } from '../../src/physics/Simulation';
import { PathBot, applyBotHints } from '../../src/tracks/PathBot';
import { buildLevel } from '../levels/build';
import { LEVEL_DEFS } from '../levels/index';
const def = LEVEL_DEFS.find((d) => d.id === 'lab')!;
const { track } = buildLevel(def);
const car = process.argv[2] ?? 'volt';
for (const kmh of [80, 110, 140, 170, 200, 240]) {
  const S = kmh / 3.6;
  const sim = await Simulation.create(track, carParams(car), false, undefined, undefined, car);
  const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params);
  applyBotHints(bot, { maxSpeed: 85 });
  const v = sim.vehicle;
  let minW = 4, maxH = 0, lost = -1;
  for (let i = 0; i < 1600; i++) {
    const f = bot.drive(v);
    const near = v.position.x > 90 && bot.progress < 0.135;
    const err = S - v.speed;
    sim.step(near ? makeFrame(f.steer, Math.max(0, Math.min(1, err * 0.6)), err < -2 ? 0.4 : 0) : f);
    if (v.position.x > 118 && bot.progress < 0.13) { minW = Math.min(minW, v.wheelsOnGround); maxH = Math.max(maxH, v.position.y); if (!v.wheelsOnGround && lost < 0) lost = sim.time; }
  }
  console.log(`${car} ${kmh} km/h: min wheels ${minW}, max height ${maxH.toFixed(1)}, lost ${lost.toFixed(2)}, progress ${(bot.progress * 100).toFixed(1)}%, respawns ${sim.respawnCount}`);
}
