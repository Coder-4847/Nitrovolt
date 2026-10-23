// Wall-turn variants on a raised road: centre pivot vs edge pivot, different bank and ease, fixed speeds.
import { Vector3 } from 'three';
import { carParams } from '../../src/data/cars';
import { makeFrame } from '../../src/core/InputFrame';
import { Simulation } from '../../src/physics/Simulation';
import { PathBot } from '../../src/tracks/PathBot';
import { TrackBuilder } from '../../src/tracks/TrackBuilder';

function build(R: number, angle: number, bank: number, wall: boolean, ease: number) {
  const t = new TrackBuilder();
  t.place(new Vector3(0, 16, 0), 0);
  t.straight(300, { width: 24 });
  t.setSpawn();
  t.straight(40, { width: 24 });
  t.arc(R, angle, bank, { width: 24, walls: 'both', step: 1.5 }, wall, ease);
  t.straight(300, { width: 24 });
  const tr = t.finish('w', 'w', t.spawn!, -50);
  tr.start = { position: new Vector3(0, 16.8, -20), quaternion: tr.start.quaternion };
  return tr;
}
for (const [R, ang, bank, wall, ease] of [[48, 180, 78, true, 0.32], [48, 180, 78, false, 0.32], [48, 180, 60, true, 0.32], [48, 180, 78, true, 0.5], [80, 180, 78, true, 0.4], [48, 180, 45, true, 0.32]] as const) {
  const track = build(R, ang, bank, wall, ease);
  const line: string[] = [];
  for (const kmh of [100, 150, 200, 250]) {
    const S = kmh / 3.6;
    const sim = await Simulation.create(track, carParams('volt'), false, undefined, undefined, 'volt');
    const bot = new PathBot(track.centerline, track.centerSurface, false, sim.vehicle.params);
    bot.maxSpeed = 90;
    const v = sim.vehicle;
    let ok = true;
    for (let i = 0; i < 2000; i++) {
      const f = bot.drive(v);
      const err = S - v.speed;
      sim.step(makeFrame(f.steer, Math.max(0, Math.min(1, err * 0.6)), err < -2 ? 0.4 : 0));
      if (v.position.z < -300 && v.wheelsOnGround === 0) ok = false;
      if (bot.progress > 0.9) break;
    }
    line.push(`${kmh}:${ok && bot.progress > 0.85 ? 'OK' : 'off@' + (bot.progress * 100).toFixed(0)}`);
  }
  console.log(`R${R} ${ang}deg bank ${bank} ${wall ? 'edge' : 'centre'} ease ${ease}: ${line.join(' ')}`);
}
