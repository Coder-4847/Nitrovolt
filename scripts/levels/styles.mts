// Runs the bot's three driving styles on one level and prints how each ends. Usage: npx tsx scripts/levels/styles.mts <id>
import { botRun, hintLadder } from '../../src/tracks/Validate';
import { buildLevel } from './build';
import { findDef } from './index';

const def = findDef(process.argv[2]!)!;
const b = buildLevel(def);
for (const [i, h] of hintLadder(def.car, def.hints).entries()) {
  const r = await botRun(b.json, h, 260);
  console.log(`style ${i} ${JSON.stringify(h)} -> ${r.finished ? `finished ${(r.time / 1000).toFixed(1)} s` : `FAIL ${r.failure} at ${(r.progress * 100).toFixed(0)}% near ${r.failPos?.map((n) => n.toFixed(0))} ${(r.failSpeed * 3.6).toFixed(0)} km/h`} (off ${r.offroad.toFixed(1)} s, overshoots ${r.overshoots}, hard ${r.hardLandings})`);
}
