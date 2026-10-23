// Dev: generate + validate one slot. Usage: npx tsx scripts/gen-try.ts <season> <slot> [seed]
import { slotProfile } from '../src/tracks/CampaignPlan';
import { generateCircuit, generateLevel } from '../src/tracks/LevelGenerator';
import { validateLevel } from '../src/tracks/Validate';
import { TrackJson, CELL } from '../src/tracks/TrackSchema';
import { blockCells } from '../src/tracks/Footprint';

const [s, k, sd] = process.argv.slice(2).map(Number);
const p = slotProfile(s ?? 0, k ?? 1);
for (let a = 0; a < 6; a++) {
  const seed = (sd ?? 1000) + a * 7919;
  const t0 = performance.now();
  const g = p.lap ? generateCircuit(p, seed) : generateLevel(p, seed);
  const t1 = performance.now();
  if (!g) { console.log(seed, 'gen failed', (t1 - t0).toFixed(0), 'ms'); continue; }
  const json: TrackJson = { id: p.id, name: p.id, car: p.car, theme: p.theme, seed, laps: p.laps, blocks: g.blocks, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 } };
  const v = await validateLevel(json);
  const t2 = performance.now();
  let where = '';
  if (!v.run.finished && v.run.failPos) {
    const [x, , z] = v.run.failPos;
    const cx = Math.round(x / CELL), cz = Math.round(z / CELL);
    const hits = g.blocks.map((b, i) => [i, b] as const).filter(([, b]) => blockCells(b).some((c) => Math.abs(c.x - cx) + Math.abs(c.z - cz) <= 1));
    where = ` at ${v.run.failPos.map((n) => n.toFixed(0))} v=${(v.run.failSpeed * 3.6).toFixed(0)}km/h near ${hits.map(([i, b]) => `#${i}:${b.type}${b.surface ? '/' + b.surface : ''}`).join(',')}`;
  }
  console.log(seed, where, `blocks=${g.blocks.length} gen ${(t1 - t0).toFixed(0)}ms val ${(t2 - t1).toFixed(0)}ms`, v.run.finished ? `OK ${(v.run.time / 1000).toFixed(2)}s attempts=${v.attempts} air=${v.run.airTime.toFixed(1)} maxV=${(v.run.maxSpeed * 3.6).toFixed(0)}` : `FAIL ${v.run.failure} ${(v.run.progress * 100).toFixed(0)}%`, g.phrases.join(' '));
}
