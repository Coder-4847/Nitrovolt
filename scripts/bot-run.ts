import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildGreyboxTrack } from '../src/tracks/GreyboxTrack';
import { PathBot } from '../src/tracks/PathBot';

async function main(): Promise<void> {
  const track = buildGreyboxTrack();
  let minY = Infinity;
  for (const p of track.centerline) minY = Math.min(minY, p.y);
  console.log('centerline pts', track.centerline.length, 'minY', minY.toFixed(1), 'checkpoints', track.checkpoints.length);
  const sim = await Simulation.create(track, cloneParams(VOLT));
  const bot = new PathBot(track.centerline, track.centerSurface);
  const v = sim.vehicle;
  let lastLog = -1;
  for (let i = 0; i < 12000 && !bot.finished; i++) {
    sim.step(bot.drive(v));
    const sec = Math.floor(sim.time);
    if (sec !== lastLog && sec % 2 === 0) {
      lastLog = sec;
      console.log(`t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(0)}% spd=${(v.speed * 3.6).toFixed(0)} pos=${v.position.toArray().map((n) => n.toFixed(0))} air=${v.airTime.toFixed(2)} contacts=${v.wheelsOnGround} respawns=${sim.respawnCount}`);
    }
    for (const e of sim.events) if (e.type !== 'bottomOut') console.log('  event', sim.time.toFixed(2), e.type, e.intensity.toFixed(1));
    sim.events.length = 0;
  }
  console.log('finished', bot.finished, 'time', sim.time.toFixed(2), 'respawns', sim.respawnCount);
}
main();
