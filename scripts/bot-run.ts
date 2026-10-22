import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildGreyboxTrack } from '../src/tracks/GreyboxTrack';
import { PathBot } from '../src/tracks/PathBot';

async function main(): Promise<void> {
  const track = buildGreyboxTrack();
  const sim = await Simulation.create(track, cloneParams(VOLT));
  const bot = new PathBot(track.centerline, track.centerSurface);
  const v = sim.vehicle;
  let rs = 0;
  for (let i = 0; i < 12000 && !bot.finished; i++) {
    sim.step(bot.drive(v));
    if (sim.respawnCount > rs) { rs = sim.respawnCount; console.log(`RESPAWN at t=${sim.time.toFixed(2)} progress ${(bot.progress * 100).toFixed(1)}%`); }
    if (i % 100 === 0 && sim.respawnCount) console.log(`t=${sim.time.toFixed(1)} prog=${(bot.progress * 100).toFixed(0)}% spd=${(v.speed * 3.6).toFixed(0)} pos=${v.position.toArray().map((n) => n.toFixed(0))}`);
  }
  console.log('finished', bot.finished, 'time', sim.time.toFixed(2), 'respawns', sim.respawnCount, 'state', sim.run.state, 'cps', sim.run.nextCp);
}
main();
