// Trace one wall-ride run at a given speed. Usage: npx tsx scripts/dev/wallride-trace.mts 30
import { makeFrame } from '../../src/core/InputFrame';
import { Simulation } from '../../src/physics/Simulation';
import { VOLT, cloneParams } from '../../src/physics/VehicleParams';
import { layoutChain } from '../../src/tracks/ChainLayout';
import { buildTrack } from '../../src/tracks/TrackGenerator';
const speed = Number(process.argv[2] ?? 30);
const { blocks } = layoutChain([{ type: 'start' }, { type: 'straight4' }, { type: 'straight4' }, { type: 'wallRide4R' }, { type: 'straight2' }, { type: 'finish' }]);
const track = buildTrack({ id: 'w', name: 'w', car: 'volt', theme: 'g', seed: 1, blocks });
console.log('killY', track.killY, 'start', track.start.position.toArray());
const sim = await Simulation.create(track, cloneParams(VOLT), 0);
const v = sim.vehicle;
for (let i = 0; i < 4000 && sim.run.state !== 'finished' && sim.respawnCount === 0; i++) {
  sim.step(makeFrame(0, Math.max(0, Math.min(1, (speed - v.speed) * 0.5)), 0));
  if (i % 25 === 0) console.log(i, v.position.toArray().map((x) => x.toFixed(1)).join(' '), 'v', v.speed.toFixed(1), 'ground', v.wheels.filter((w) => w.contact).length);
  for (const e of sim.events) if (e.type !== 'tick') console.log(i, 'event', JSON.stringify(e));
}
