import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildGreyboxTrack } from '../src/tracks/GreyboxTrack';
import { PathBot } from '../src/tracks/PathBot';

async function main(): Promise<void> {
  const track = buildGreyboxTrack();
  const cl = track.centerline;
  // find the gap (distance between consecutive samples > 12)
  for (let i = 0; i < cl.length - 1; i++) {
    if (cl[i]!.distanceTo(cl[i + 1]!) > 12 && cl[i]!.distanceTo(cl[i + 1]!) < 100) console.log('gap at idx', i, cl[i]!.toArray().map((n) => n.toFixed(1)), '->', cl[i + 1]!.toArray().map((n) => n.toFixed(1)));
  }
  const sim = await Simulation.create(track, cloneParams(VOLT));
  const bot = new PathBot(cl);
  const v = sim.vehicle;
  let prevAir = false;
  for (let i = 0; i < 4000; i++) {
    sim.step(bot.drive(v));
    const air = v.wheelsOnGround === 0;
    if (air !== prevAir || (air && i % 5 === 0 && sim.time > 14.8 && sim.time < 15.5)) {
      console.log(`t=${sim.time.toFixed(2)} air=${air} pos=${v.position.toArray().map((n) => n.toFixed(1))} vel=${v.linvel.toArray().map((n) => n.toFixed(1))} ax=${v.dbgAir.ax.toFixed(1)} err=${v.dbgAir.pitchErr.toFixed(2)} wx=${v.dbgAir.wx.toFixed(2)} pin=${v.dbgAir.pitchIn} speed=${v.speed.toFixed(1)} pitch=${Math.asin(v.fwd.y).toFixed(2)}`);
      prevAir = air;
    }
    for (const e of sim.events) if (e.type !== 'bottomOut') console.log('   event', e.type, e.intensity.toFixed(1));
    sim.events.length = 0;
    if (sim.time > 26) break;
  }
}
main();
