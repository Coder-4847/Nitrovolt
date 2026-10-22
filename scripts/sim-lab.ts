import { makeFrame } from '../src/core/InputFrame';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { buildFlatPad } from '../src/tracks/TestTracks';

const kmh = (v: number): number => Math.round(v * 3.6);
const hold = (target: number, v: number): number => Math.max(0, Math.min(1, (target - v) * 0.4));

async function main(): Promise<void> {
  const params = cloneParams(VOLT);
  const sim = await Simulation.create(buildFlatPad(), params);
  const v = sim.vehicle;

  console.log('--- accel (straight)');
  let t100 = 0, t200 = 0, t300 = 0;
  for (let i = 0; i < 1100; i++) {
    sim.step(makeFrame(0, 1, 0));
    if (!t100 && v.speed * 3.6 >= 100) t100 = sim.time;
    if (!t200 && v.speed * 3.6 >= 200) t200 = sim.time;
    if (!t300 && v.speed * 3.6 >= 300) t300 = sim.time;
  }
  console.log('0-100', t100, '0-200', t200, '0-300', t300, 'speed@11s', kmh(v.speed), 'dist', (-v.position.z + 300).toFixed(0));

  console.log('--- brake from top');
  const z0 = v.position.z;
  let tb = 0;
  while (v.speed > 1 && tb < 1500) { sim.step(makeFrame(0, 0, 1)); tb++; }
  console.log('stop time', tb / 100, 'dist', (z0 - v.position.z).toFixed(1), 'pitch', v.fwd.y.toFixed(3));

  console.log('--- constant-steer circles at held speed');
  for (const target of [15, 25, 40, 55, 70]) {
    sim.restart();
    for (let i = 0; i < 4000 && v.speed < target; i++) sim.step(makeFrame(0, 1, 0));
    let sumLat = 0, n = 0, maxSlip = 0;
    for (let i = 0; i < 500; i++) {
      sim.step(makeFrame(1, hold(target, v.speed), 0));
      if (i > 250) { sumLat += v.speed * Math.abs(v.angvel.y); n++; maxSlip = Math.max(maxSlip, Math.abs(v.bodySlip)); }
    }
    const R = v.speed / Math.max(0.01, Math.abs(v.angvel.y));
    console.log(`held ${kmh(target)}km/h -> speed ${kmh(v.speed)} lat ${(sumLat / n / 19.6).toFixed(2)} g' radius ${R.toFixed(0)}m max|slip| ${maxSlip.toFixed(2)} steerAng ${v.steerAngle.toFixed(2)}`);
  }

  console.log('--- slalom at 60 m/s, keyboard-style full flicks every 0.6s');
  sim.restart();
  for (let i = 0; i < 4000 && v.speed < 60; i++) sim.step(makeFrame(0, 1, 0));
  for (let i = 0; i < 360; i++) {
    const st = Math.floor(i / 60) % 2 === 0 ? 1 : -1;
    sim.step(makeFrame(st, hold(60, v.speed), 0));
    if (i % 30 === 0) console.log(`i=${i} x=${v.position.x.toFixed(1)} yaw=${v.angvel.y.toFixed(2)} slip=${v.bodySlip.toFixed(2)} spd=${kmh(v.speed)}`);
  }

  console.log('--- brake-drift: 50 m/s, steer right + brake tap + throttle');
  sim.restart();
  for (let i = 0; i < 4000 && v.speed < 50; i++) sim.step(makeFrame(0, 1, 0));
  for (let i = 0; i < 300; i++) {
    const brake = i < 25 ? 1 : 0;
    const steer = i < 120 ? 0.7 : 0;
    sim.step(makeFrame(steer, 1, brake));
    if (i % 20 === 0) console.log(`i=${i} yaw=${v.angvel.y.toFixed(2)} slip=${v.bodySlip.toFixed(2)} spd=${kmh(v.speed)} steerAng=${v.steerAngle.toFixed(2)}`);
  }
}
main();
