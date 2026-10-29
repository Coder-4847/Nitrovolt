// Builds the hand-made levels (scripts/levels/index.ts): lays the blocks out, checks the layout, drives every
// level with the validation bot (finish, no respawn), records the author ghost and checks it replays
// exactly, sets the target time and writes src/data/levels/*.json, src/data/ghosts/*.json,
// src/data/levels.json (the order) and docs/LEVEL_REPORT.md.
// Usage: npx tsx scripts/make-levels.mts            (all levels)
//        ONLY=c01,c02 npx tsx scripts/make-levels.mts   (rebuild some, keep the others)
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { getCar } from '../src/data/cars';
import { TrackJson } from '../src/tracks/TrackSchema';
import { BotRun, validateLevel, verifyGhost } from '../src/tracks/Validate';
import { buildLevel } from './levels/build';
import { LevelDef } from './levels/dsl';
import { LEVEL_DEFS } from './levels/index';

const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

interface Row { def: LevelDef; json: TrackJson; run: BotRun; length: number; exact: boolean; attempts: number }

const fmt = (ms: number): string => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(Math.round(ms % 1000)).padStart(3, '0')}`;

async function make(def: LevelDef): Promise<Row> {
  const b = buildLevel(def);
  if (b.overlaps.length) throw new Error(`${def.id}: road overlaps at ${b.overlaps.map((p) => p.map((n) => n.toFixed(0)).join(',')).join(' | ')}`);
  const json = b.json;
  const { run, attempts } = await validateLevel(json, def.hints, 240);
  if (!run.finished || !run.ghost) {
    const at = run.failPos ? ` near (${run.failPos.map((n) => n.toFixed(0)).join(', ')}) at ${(run.failSpeed * 3.6).toFixed(0)} km/h` : '';
    throw new Error(`${def.id}: bot failed: ${run.failure} (progress ${(run.progress * 100).toFixed(0)}%)${at}`);
  }
  const t = run.time;
  json.target = t;
  json.bot = run.hints;
  const exact = await verifyGhost(json, run.ghost);
  if (!exact) throw new Error(`${def.id}: author ghost does not replay exactly`);
  writeFileSync(`src/data/levels/${json.id}.json`, JSON.stringify(json, null, 1) + '\n');
  writeFileSync(`src/data/ghosts/${json.id}.json`, JSON.stringify(run.ghost) + '\n');
  return { def, json, run, length: b.length, exact, attempts };
}

function keep(def: LevelDef): Row | null {
  const path = `src/data/levels/${def.id}.json`;
  if (!existsSync(path)) return null;
  const json = JSON.parse(readFileSync(path, 'utf8')) as TrackJson;
  const b = buildLevel(def);
  if (JSON.stringify(b.json.blocks) !== JSON.stringify(json.blocks)) return null; // layout changed: rebuild
  const prev = report.get(def.id);
  if (!prev) return null;
  return { def, json, run: prev, length: b.length, exact: true, attempts: 1 };
}

// runs recorded by an earlier build (for the report when only some levels are rebuilt)
const report = new Map<string, BotRun>();
if (existsSync('scripts/levels/.runs.json')) for (const [k, v] of Object.entries(JSON.parse(readFileSync('scripts/levels/.runs.json', 'utf8')) as Record<string, BotRun>)) report.set(k, v);

const WORLD_NAME: Record<string, string> = { forest: 'Summer', sunset: 'Autumn', snow: 'Winter', desert: 'Desert', night: 'Night' };

async function main(): Promise<void> {
  const t0 = performance.now();
  const rows: Row[] = [];
  const failed: string[] = [];
  for (const def of LEVEL_DEFS) {
    const kept = only && !only.has(def.id) ? keep(def) : null;
    let row: Row;
    try {
      row = kept ?? (await make(def));
    } catch (e) {
      // report every broken level in one pass, then stop before writing anything shared
      failed.push((e as Error).message);
      console.log(`FAIL ${(e as Error).message}`);
      continue;
    }
    rows.push(row);
    report.set(def.id, { ...row.run, ghost: null });
    const cars = [...new Set([def.car, ...row.json.blocks.filter((x) => x.type.startsWith('gate')).map((x) => x.type.slice(4).toLowerCase())])];
    console.log(`${def.id.padEnd(5)} ${def.name.padEnd(22)} ${WORLD_NAME[def.theme]!.padEnd(8)} ${cars.join('>').padEnd(22)} ${(row.run.time / 1000).toFixed(2).padStart(6)} s  ${Math.round(row.length)} m  style ${row.attempts}${kept ? ' (kept)' : ''}`);
  }
  if (failed.length) throw new Error(`${failed.length} level(s) failed:\n${failed.join('\n')}`);
  // drop files of levels that no longer exist
  const ids = new Set(LEVEL_DEFS.map((d) => d.id));
  for (const dir of ['src/data/levels', 'src/data/ghosts']) for (const f of readdirSync(dir)) if (f.endsWith('.json') && !ids.has(f.slice(0, -5))) rmSync(`${dir}/${f}`);
  writeFileSync('src/data/levels.json', JSON.stringify(LEVEL_DEFS.map((d) => ({ id: d.id, world: d.theme, blurb: d.blurb })), null, 1) + '\n');
  writeFileSync('scripts/levels/.runs.json', JSON.stringify(Object.fromEntries(report)) + '\n');
  writeFileSync('docs/LEVEL_REPORT.md', reportMd(rows, (performance.now() - t0) / 1000));
  rmSync('node_modules/.vitest-cache', { recursive: true, force: true });
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

function reportMd(rows: Row[], secs: number): string {
  const L: string[] = ['# Level Report', ''];
  L.push('Built by `npx tsx scripts/make-levels.mts` from the definitions in `scripts/levels/`. Every level was driven start to');
  L.push('finish by the validation bot (`src/tracks/Validate.ts`) with **no respawn**; that run is the **author ghost** and the');
  L.push('**target time**, and each ghost was re-simulated to confirm it reproduces the run exactly.', '');
  L.push(`Levels: **${rows.length}**. Build time ${secs.toFixed(0)} s.`, '');
  L.push('| # | World | Id | Name | Cars | Length | Target | Class | Top / avg km/h | Air (jumps) | Wall hits |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  rows.forEach((r, i) => {
    const cars = [r.def.car, ...r.json.blocks.filter((x) => x.type.startsWith('gate')).map((x) => x.type.slice(4).toLowerCase())].filter((c, k, a) => k === 0 || c !== a[k - 1]).map((c) => getCar(c).label).join(' > ');
    const t = r.json.target ?? 0;
    const cls = t < 50000 ? 'Sprint' : t < 82000 ? 'Standard' : 'Marathon';
    L.push(`| ${i + 1} | ${WORLD_NAME[r.def.theme]} | \`${r.def.id}\` | ${r.def.name} | ${cars} | ${Math.round(r.length)} m | ${fmt(t)} | ${cls} | ${Math.round(r.run.maxSpeed * 3.6)} / ${Math.round(r.run.avgSpeed * 3.6)} | ${r.run.airTime.toFixed(1)} s (${r.run.jumps}) | ${r.run.wallHits} |`);
  });
  return L.join('\n') + '\n';
}

void (main() as Promise<void>).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
export type { Tier };
