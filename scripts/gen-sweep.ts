// Dev: success rate of generate+validate over many slots. Usage: npx tsx scripts/gen-sweep.ts <season> [seeds=4]
import { slotProfile } from '../src/tracks/CampaignPlan';
import { generateCircuit, generateLevel } from '../src/tracks/LevelGenerator';
import { validateLevel } from '../src/tracks/Validate';
import { TrackJson, CELL } from '../src/tracks/TrackSchema';
import { blockCells } from '../src/tracks/Footprint';
const season = Number(process.argv[2] ?? 0), seeds = Number(process.argv[3] ?? 4);
const fails: Record<string, number> = {};
let ok = 0, n = 0;
for (let k = 1; k < 25; k += 2) {
  const p = slotProfile(season, k);
  let line = `${p.id} ${p.car.padEnd(6)}`;
  for (let a = 0; a < seeds; a++) {
    const seed = 1000 + a * 7919 + k * 31;
    const g = p.lap ? generateCircuit(p, seed) : generateLevel(p, seed);
    n++;
    if (!g) { line += ' gen'; fails.gen = (fails.gen ?? 0) + 1; continue; }
    const json: TrackJson = { id: p.id, name: p.id, car: p.car, theme: p.theme, seed, laps: p.laps, blocks: g.blocks, medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 } };
    const v = await validateLevel(json);
    if (v.run.finished) { ok++; line += ` ${(v.run.time / 1000).toFixed(0)}s`; continue; }
    let near = '';
    if (v.run.failPos) {
      const cx = Math.round(v.run.failPos[0] / CELL), cz = Math.round(v.run.failPos[2] / CELL);
      const hit = g.blocks.find((b) => blockCells(b).some((c) => c.x === cx && c.z === cz));
      near = hit ? hit.type : '?';
    }
    const key = `${v.run.failure?.replace(/ at \d+%/, '')}@${near}`;
    fails[key] = (fails[key] ?? 0) + 1;
    line += ` X(${near}@${(v.run.failSpeed * 3.6).toFixed(0)})`;
  }
  console.log(line);
}
console.log(`ok ${ok}/${n}`, JSON.stringify(fails));
