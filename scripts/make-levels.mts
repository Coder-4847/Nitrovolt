// Builds the hand-made levels (scripts/levels/index.ts): lays the blocks out, checks the layout, drives every
// level with the validation bot (finish, no respawn), records the author ghost and checks it replays
// exactly, sets the medal times and writes src/data/levels/*.json, src/data/ghosts/*.json,
// src/data/levels.json (the order) and docs/LEVEL_REPORT.md.
// Usage: npx tsx scripts/make-levels.mts            (all levels)
//        ONLY=c01,c02 npx tsx scripts/make-levels.mts   (rebuild some, keep the others)
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { getCar } from '../src/data/cars';
import { TrackJson } from '../src/tracks/TrackSchema';
import { BotRun, validateLevel, verifyGhost } from '../src/tracks/Validate';
import { buildLevel } from './levels/build';
import { LevelDef, Tier } from './levels/dsl';
import { LEVEL_DEFS } from './levels/index';

/** Gold / silver / bronze as multiples of the author time, per tier (training is gentle, black is tight). */
const MEDALS: Record<string, [number, number, number]> = {
  training: [1.1, 1.3, 1.6], 0: [1.08, 1.25, 1.55], 1: [1.07, 1.22, 1.5], 2: [1.06, 1.2, 1.45], 3: [1.05, 1.18, 1.4], 4: [1.045, 1.15, 1.35],
};
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
  const [g, s, br] = MEDALS[String(def.tier)]!;
  const t = run.time;
  json.medalTimes = { author: t, gold: Math.round(t * g), silver: Math.round(t * s), bronze: Math.round(t * br) };
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

const TIER_NAME: Record<string, string> = { training: 'Training', 0: 'White', 1: 'Green', 2: 'Blue', 3: 'Red', 4: 'Black' };

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
    console.log(`${def.id.padEnd(5)} ${def.name.padEnd(22)} ${TIER_NAME[String(def.tier)]!.padEnd(8)} ${cars.join('>').padEnd(22)} ${(row.run.time / 1000).toFixed(2).padStart(6)} s  ${Math.round(row.length)} m  style ${row.attempts}${kept ? ' (kept)' : ''}`);
  }
  if (failed.length) throw new Error(`${failed.length} level(s) failed:\n${failed.join('\n')}`);
  // drop files of levels that no longer exist
  const ids = new Set(LEVEL_DEFS.map((d) => d.id));
  for (const dir of ['src/data/levels', 'src/data/ghosts']) for (const f of readdirSync(dir)) if (f.endsWith('.json') && !ids.has(f.slice(0, -5))) rmSync(`${dir}/${f}`);
  writeFileSync('src/data/levels.json', JSON.stringify(LEVEL_DEFS.map((d) => ({ id: d.id, tier: d.tier, blurb: d.blurb })), null, 1) + '\n');
  writeFileSync('scripts/levels/.runs.json', JSON.stringify(Object.fromEntries(report)) + '\n');
  writeFileSync('docs/LEVEL_REPORT.md', reportMd(rows, (performance.now() - t0) / 1000));
  rmSync('node_modules/.vitest-cache', { recursive: true, force: true });
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}

function reportMd(rows: Row[], secs: number): string {
  const L: string[] = ['# Level Report', ''];
  L.push('Built by `npx tsx scripts/make-levels.mts` from the definitions in `scripts/levels/`. Every level was driven start to');
  L.push('finish by the validation bot (`src/tracks/Validate.ts`) with **no respawn**; that run is the **author ghost** and the');
  L.push('**Author** time, and each ghost was re-simulated to confirm it reproduces the run exactly.', '');
  L.push(`Levels: **${rows.length}**. Build time ${secs.toFixed(0)} s.`, '');
  L.push('| Tier | Id | Name | Environment | Cars | Length | Author | Gold | Silver | Bronze | Top / avg km/h | Air (jumps) | Wall hits |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const m = r.json.medalTimes;
    const cars = [r.def.car, ...r.json.blocks.filter((x) => x.type.startsWith('gate')).map((x) => x.type.slice(4).toLowerCase())].map((c) => getCar(c).label).join(' > ');
    L.push(`| ${TIER_NAME[String(r.def.tier)]} | \`${r.def.id}\` | ${r.def.name} | ${r.def.theme} | ${cars} | ${Math.round(r.length)} m | ${fmt(m.author)} | ${fmt(m.gold)} | ${fmt(m.silver)} | ${fmt(m.bronze)} | ${Math.round(r.run.maxSpeed * 3.6)} / ${Math.round(r.run.avgSpeed * 3.6)} | ${r.run.airTime.toFixed(1)} s (${r.run.jumps}) | ${r.run.wallHits} |`);
  }
  return L.join('\n') + '\n';
}

void (main() as Promise<void>).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
export type { Tier };
