// Quick check of level layouts without writing anything: overlaps, driving length, bot time and failure reason.
// Usage: npx tsx scripts/levels/try.mts [id,id,...]   (default: every level)
import { validateLevel } from '../../src/tracks/Validate';
import { buildLevel } from './build';
import { LEVEL_DEFS, DEV_DEFS } from './index';

/** Jump hygiene: a ramp needs a straight run-up (the bot, and a player, arrive square and at speed) and room after the landing. */
function lint(def: (typeof defs)[number]): string[] {
  const out: string[] = [];
  const len = (t: string): number => (t === 'straight4' ? 128 : t === 'straight2' ? 64 : t === 'straight1' || t.startsWith('gate') || t === 'checkpoint' || t === 'finish' || t === 'start' ? 32 : 0);
  const items = def.items;
  items.forEach((it, i) => {
    if (!(it.type === 'kicker' || it.type.startsWith('jumpRamp'))) return;
    let run = 0;
    for (let k = i - 1; k >= 0 && len(items[k]!.type) > 0; k--) run += len(items[k]!.type);
    if (run < 96) out.push(`run-up before ${it.type} #${i} is only ${run} m`);
    let after = 0;
    for (let k = i + 2; k < items.length && len(items[k]!.type) > 0; k++) after += len(items[k]!.type);
    if (after < 32) out.push(`only ${after} m of straight after the landing of ${it.type} #${i}`);
  });
  return out;
}

const only = process.argv[2]?.split(',');
const defs = [...LEVEL_DEFS, ...DEV_DEFS].filter((d) => (only ? only.includes(d.id) : !DEV_DEFS.includes(d)));
const fmt = (ms: number): string => `${Math.floor(ms / 60000)}:${(ms % 60000 / 1000).toFixed(1).padStart(4, '0')}`;

for (const def of defs) {
  const t0 = performance.now();
  try {
    const b = buildLevel(def);
    const warn = lint(def);
    const cars = [def.car, ...b.json.blocks.filter((x) => x.type.startsWith('gate')).map((x) => x.type.slice(4).toLowerCase())].join('>');
    const head = `${def.id.padEnd(4)} ${def.name.padEnd(20)} ${cars.padEnd(30)} ${String(Math.round(b.length)).padStart(5)} m`;
    if (b.overlaps.length) {
      console.log(`${head}  OVERLAP at ${b.overlaps.slice(0, 4).map((p) => p.map((n) => n.toFixed(0)).join(',')).join(' | ')}`);
      if (!process.env.FORCE) continue;
    }
    for (const w of warn) console.log(`${def.id.padEnd(4)} lint: ${w}`);
    const { run, attempts } = await validateLevel(b.json, def.hints, 260);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (run.finished) console.log(`${head}  ${fmt(run.time)}  top ${Math.round(run.maxSpeed * 3.6)} avg ${Math.round(run.avgSpeed * 3.6)} km/h  air ${run.airTime.toFixed(1)}s  walls ${run.wallHits} style ${attempts}  (${secs}s)`);
    else console.log(`${head}  FAIL ${run.failure} ${(run.progress * 100).toFixed(0)}% near ${run.failPos?.map((n) => n.toFixed(0)).join(',')} at ${(run.failSpeed * 3.6).toFixed(0)} km/h  (${secs}s)`);
  } catch (e) {
    console.log(`${def.id.padEnd(4)} ${def.name.padEnd(20)} ERROR ${(e as Error).message}`);
  }
}
