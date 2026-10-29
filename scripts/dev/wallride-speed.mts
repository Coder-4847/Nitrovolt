// Lowest speed the wall-ride block holds the car at. Usage: npx tsx scripts/dev/wallride-speed.mts
import { makeFrame } from '../../src/core/InputFrame';
import { Simulation } from '../../src/physics/Simulation';
import { VOLT, cloneParams } from '../../src/physics/VehicleParams';
import { layoutChain } from '../../src/tracks/ChainLayout';
import { buildTrack } from '../../src/tracks/TrackGenerator';
for (const speed of [20, 25, 30, 33, 36, 40, 45, 60]) {
  const { blocks } = layoutChain([{ type: 'start' }, { type: 'straight4' }, { type: 'straight4' }, { type: 'wallRide4R' }, { type: 'straight2' }, { type: 'finish' }]);
  const track = buildTrack({ id: 'w', name: 'w', car: 'volt', theme: 'g', seed: 1, blocks });
  const sim = await Simulation.create(track, cloneParams(VOLT), 0);
  const v = sim.vehicle;
  let maxH = -1e9, entry = 0;
  for (let i = 0; i < 4000 && sim.run.state !== 'finished' && sim.respawnCount === 0; i++) {
    sim.step(makeFrame(0, Math.max(0, Math.min(1, (speed - v.speed) * 0.5)), 0));
    maxH = Math.max(maxH, v.position.y);
    if (!entry && v.position.z < -260) entry = v.speed;
  }
  console.log(speed, 'respawns', sim.respawnCount, sim.run.state, 'maxY', maxH.toFixed(1), 'x', v.position.x.toFixed(1), 'z', v.position.z.toFixed(1));
}
