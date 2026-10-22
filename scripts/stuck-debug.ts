import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildGreyboxTrack } from '../src/tracks/GreyboxTrack';
import { PathBot } from '../src/tracks/PathBot';

async function main(): Promise<void> {
  const track = buildGreyboxTrack();
  const sim = await Simulation.create(track, cloneParams(VOLT));
  const bot = new PathBot(track.centerline, track.centerSurface);
  const v = sim.vehicle;
  const t0 = Number(process.argv[2] ?? 17), t1 = Number(process.argv[3] ?? 23);
  for (let i = 0; i < 100 * t1; i++) {
    const f = bot.drive(v);
    sim.step(f);
    if (sim.time >= t0 && i % 10 === 0) console.log(`t=${sim.time.toFixed(2)} pos=${v.position.toArray().map((n) => n.toFixed(1))} spd=${v.speed.toFixed(1)} in=${f.steer.toFixed(2)}/${f.accel.toFixed(1)}/${f.brake.toFixed(1)} slip=${v.bodySlip.toFixed(2)} yaw=${v.angvel.y.toFixed(2)} c=${v.wheelsOnGround} surf=${v.wheels[0]!.surface} up=${v.up.y.toFixed(2)}`);
    for (const e of sim.events) if (e.type !== 'bottomOut') console.log('   event', e.type, e.intensity.toFixed(1));
    sim.events.length = 0;
  }
}
main();
