// Builds the 100-level campaign: keeps the hand-made levels in their slots, generates the rest with the
// seeded level generator, validates every level with the bot (finish, no respawn, in the time window),
// records the author ghost, verifies it replays exactly, derives medal times and writes docs/LEVEL_REPORT.md.
// Usage: npx tsx scripts/make-campaign.ts            (all slots)
//        ONLY=s2-05,s3-11 npx tsx scripts/make-campaign.ts   (re-make some slots, keep the rest)
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { getCar } from '../src/data/cars';
import { HANDMADE, MEDAL_FACTORS, TIME_WINDOW, levelId, slotProfile } from '../src/tracks/CampaignPlan';
import { BLOCK_TYPE_SET } from '../src/tracks/BlockLibrary';
import { generateCircuit, generateLevel } from '../src/tracks/LevelGenerator';
import { levelName } from '../src/tracks/LevelNames';
import { TrackJson, validateTrackJson } from '../src/tracks/TrackSchema';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { BotRun, validateLevel, verifyGhost } from '../src/tracks/Validate';
import { parseSurface } from '../src/physics/Surface';

interface Row {
  number: number;
  id: string;
  name: string;
  season: number;
  slot: number;
  car: string;
  laps: number;
  blocks: number;
  length: number;
  checkpoints: number;
  run: BotRun;
  medals: TrackJson['medalTimes'];
  origin: string;
  seedsTried: number;
  styleAttempts: number;
  specials: string[];
  sets: string[];
  ghostExact: boolean;
  rejects: Record<string, number>;
}

const SET_TYPES: Record<string, string> = { loop: 'loop', halfpipe2: 'half-pipe', wallRide4L: 'wall-ride', wallRide4R: 'wall-ride', spiralDownL: 'spiral', spiralDownR: 'spiral', platform: 'platform', platformBig: 'platform' };
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const SEASON_NAMES = ['Summer', 'Winter', 'Canyon', 'Sunset'];

function hash(...n: number[]): number {
  let h = 2166136261;
  for (const x of n) h = Math.imul(h ^ x, 16777619);
  return h >>> 0;
}

function lengthOf(json: TrackJson): number {
  const c = buildTrack(json).centerline;
  let d = 0;
  for (let i = 1; i < c.length; i++) {
    const s = c[i]!.distanceTo(c[i - 1]!);
    if (s < 30) d += s; // jump gaps are not driven
  }
  return d;
}

function describe(json: TrackJson): { specials: string[]; sets: string[] } {
  const specials = new Set<string>();
  const sets = new Set<string>();
  for (const b of json.blocks) {
    if (b.surface) {
      const { effect } = parseSurface(b.surface);
      if (effect) specials.add(effect);
    }
    if (SET_TYPES[b.type]) sets.add(SET_TYPES[b.type]!);
    if (b.type === 'kicker' || b.type.startsWith('jumpRamp')) sets.add('jump');
  }
  return { specials: [...specials].sort(), sets: [...sets].sort() };
}

const medalsFor = (t: number, season: number): TrackJson['medalTimes'] => {
  const [g, s, b] = MEDAL_FACTORS[season]!;
  return { author: t, gold: Math.round(t * g), silver: Math.round(t * s), bronze: Math.round(t * b) };
};

async function makeSlot(season: number, slot: number, usedNames: Set<string>): Promise<Row> {
  const handmade = Object.entries(HANDMADE).find(([, [s, k]]) => s === season && k === slot)?.[0];
  const number = season * 25 + slot + 1;
  if (handmade) {
    const json = JSON.parse(readFileSync(`src/data/levels/${handmade}.json`, 'utf8')) as TrackJson;
    usedNames.add(json.name);
    const { run, attempts } = await validateLevel(json, json.bot);
    if (!run.finished || !run.ghost) throw new Error(`hand-made ${handmade} no longer validates: ${run.failure}`);
    json.medalTimes = medalsFor(run.time, season);
    json.bot = run.hints;
    const exact = await verifyGhost(json, run.ghost);
    writeFileSync(`src/data/levels/${json.id}.json`, JSON.stringify(json, null, 1) + '\n');
    writeFileSync(`src/data/ghosts/${json.id}.json`, JSON.stringify(run.ghost) + '\n');
    const d = describe(json);
    return { number, id: json.id, name: json.name, season, slot, car: json.car, laps: json.laps ?? 1, blocks: json.blocks.length, length: lengthOf(json), checkpoints: buildTrack(json).triggers.filter((t) => t.kind === 'checkpoint').length, run, medals: json.medalTimes, origin: 'hand-made', seedsTried: 1, styleAttempts: attempts, ...d, ghostExact: exact, rejects: {} };
  }

  const p = slotProfile(season, slot);
  const [tMin, tMax] = TIME_WINDOW[season]!;
  const rejects: Record<string, number> = {};
  const reject = (why: string): void => {
    rejects[why] = (rejects[why] ?? 0) + 1;
  };
  for (let attempt = 0; attempt < 80; attempt++) {
    // after many failures, relax: shorter, fewer jumps (keeps the slot's character)
    const relax = Math.floor(attempt / 25);
    const prof = { ...p, cells: Math.round(p.cells * (1 - relax * 0.12)), jumpWeight: p.jumpWeight * (1 - relax * 0.3) };
    const seed = hash(season, slot, attempt, 0x5eed);
    const g = prof.lap ? generateCircuit(prof, seed) : generateLevel(prof, seed);
    if (!g) {
      reject('layout boxed in');
      continue;
    }
    const json: TrackJson = {
      id: p.id, name: p.id, car: p.car, theme: p.theme, seed, laps: p.laps, blocks: g.blocks,
      medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
    };
    const errs = validateTrackJson(json, BLOCK_TYPE_SET);
    if (errs.length) {
      reject('schema');
      continue;
    }
    const { run, attempts } = await validateLevel(json, undefined, tMax + 20);
    if (!run.finished || !run.ghost) {
      reject(run.failure?.replace(/ at \d+%/, '') ?? 'did not finish');
      continue;
    }
    const secs = run.time / 1000;
    if (secs < tMin) { reject('too short'); continue; }
    if (secs > tMax) { reject('too long'); continue; }
    if (run.wallHits > 6 + season * 2) { reject('bot kept hitting walls'); continue; }
    if (run.airTime > secs * 0.35) { reject('mostly airborne'); continue; }
    if (run.overshoots > 0) { reject('jump overshot its landing'); continue; }
    json.name = levelName(season, seed, p.lap, usedNames);
    json.medalTimes = medalsFor(run.time, season);
    json.bot = run.hints;
    const exact = await verifyGhost(json, run.ghost);
    if (!exact) { reject('ghost not exact'); continue; }
    writeFileSync(`src/data/levels/${json.id}.json`, JSON.stringify(json, null, 1) + '\n');
    writeFileSync(`src/data/ghosts/${json.id}.json`, JSON.stringify(run.ghost) + '\n');
    const d = describe(json);
    return { number, id: json.id, name: json.name, season, slot, car: json.car, laps: json.laps ?? 1, blocks: json.blocks.length, length: lengthOf(json), checkpoints: buildTrack(json).triggers.filter((t) => t.kind === 'checkpoint').length, run, medals: json.medalTimes, origin: `generated (${g.phrases.filter((x) => x !== 'run').length} phrases)`, seedsTried: attempt + 1, styleAttempts: attempts, ...d, ghostExact: exact, rejects };
  }
  throw new Error(`slot ${p.id}: no valid level after 80 seeds: ${JSON.stringify(rejects)}`);
}

/** Re-read a level made in an earlier run (ONLY mode) and re-validate it for the report. */
async function keepSlot(season: number, slot: number, id: string, usedNames: Set<string>): Promise<Row> {
  const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8')) as TrackJson;
  usedNames.add(json.name);
  const { run, attempts } = await validateLevel(json, json.bot);
  if (!run.finished) throw new Error(`${id} no longer validates: ${run.failure}`);
  const d = describe(json);
  const prev = existsSync('src/data/level-meta.json') ? (JSON.parse(readFileSync('src/data/level-meta.json', 'utf8')) as Record<string, { origin: string; seedsTried: number; rejects: Record<string, number> }>)[id] : undefined;
  return { number: season * 25 + slot + 1, id, name: json.name, season, slot, car: json.car, laps: json.laps ?? 1, blocks: json.blocks.length, length: lengthOf(json), checkpoints: buildTrack(json).triggers.filter((t) => t.kind === 'checkpoint').length, run, medals: json.medalTimes, origin: prev?.origin ?? 'kept', seedsTried: prev?.seedsTried ?? 1, styleAttempts: attempts, ...d, ghostExact: true, rejects: prev?.rejects ?? {} };
}

const fmt = (ms: number): string => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(Math.round(ms % 1000)).padStart(3, '0')}`;

function report(rows: Row[], seconds: number): string {
  const L: string[] = [];
  const allRejects: Record<string, number> = {};
  for (const r of rows) for (const [k, n] of Object.entries(r.rejects)) allRejects[k] = (allRejects[k] ?? 0) + n;
  const gen = rows.filter((r) => r.origin !== 'hand-made');
  L.push('# Level Validation Report', '');
  L.push('Generated by `npm run campaign` (`scripts/make-campaign.ts`). Every level below was driven start to finish by the validation bot');
  L.push('(`src/tracks/Validate.ts`) with **no respawn**, inside its season\'s time window; the bot\'s run is the **author ghost** and the');
  L.push('**Author** time, and each ghost was re-simulated to confirm it reproduces the run exactly.', '');
  L.push('## Summary', '');
  L.push(`- Levels: **${rows.length}** (${rows.length - gen.length} hand-made, ${gen.length} generated), all validated, ${rows.filter((r) => r.ghostExact).length} ghosts verified exact.`);
  L.push(`- Seeds tried for generated levels: ${gen.reduce((a, r) => a + r.seedsTried, 0)} (${(gen.reduce((a, r) => a + r.seedsTried, 0) / Math.max(1, gen.length)).toFixed(1)} per level). Build time ${(seconds / 60).toFixed(1)} min.`);
  L.push(`- Rejected candidates by reason: ${Object.entries(allRejects).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.`);
  const cars: Record<string, number> = {};
  for (const r of rows) cars[r.car] = (cars[r.car] ?? 0) + 1;
  L.push(`- Cars: ${Object.entries(cars).map(([k, n]) => `${getCar(k).label} ${n}`).join(', ')}. Lap levels: ${rows.filter((r) => r.laps > 1).length}.`);
  L.push('');
  L.push('| Season | Levels | Author time avg (min-max) | Length avg | Avg speed | Air time avg | Medal margins (gold / silver / bronze) |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (let s = 0; s < 4; s++) {
    const rs = rows.filter((r) => r.season === s);
    const t = rs.map((r) => r.run.time / 1000);
    const f = MEDAL_FACTORS[s]!;
    L.push(`| ${s + 1}. ${SEASON_NAMES[s]} | ${rs.length} | ${(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1)} s (${Math.min(...t).toFixed(1)}-${Math.max(...t).toFixed(1)}) | ${Math.round(rs.reduce((a, r) => a + r.length, 0) / rs.length)} m | ${Math.round((rs.reduce((a, r) => a + r.run.avgSpeed, 0) / rs.length) * 3.6)} km/h | ${(rs.reduce((a, r) => a + r.run.airTime, 0) / rs.length).toFixed(1)} s | +${Math.round((f[0] - 1) * 100)} % / +${Math.round((f[1] - 1) * 100)} % / +${Math.round((f[2] - 1) * 100)} % |`);
  }
  L.push('');
  L.push('Columns: **CPs** checkpoints; **Top / Avg** bot speed in km/h; **Air** seconds airborne (jumps = take-offs); **Walls** wall hits; **Style** which bot style finished it (1 = the car\'s natural pace, 2-3 = more careful, so the author time is easier); **Seeds** generator seeds tried for the slot.', '');
  for (let s = 0; s < 4; s++) {
    L.push(`## Season ${s + 1}: ${SEASON_NAMES[s]}`, '');
    L.push('| # | Id | Name | Car | Laps | Blocks | Length | CPs | Author | Gold | Silver | Bronze | Top / Avg | Air (jumps) | Walls | Specials | Set pieces | Main surfaces | Style | Seeds | Origin |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows.filter((x) => x.season === s)) {
      const surf = Object.entries(r.run.surfaces).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)}%`).join(', ');
      L.push(`| ${r.number} | \`${r.id}\` | ${r.name} | ${getCar(r.car).label} | ${r.laps} | ${r.blocks} | ${Math.round(r.length)} m | ${r.checkpoints} | ${fmt(r.medals.author)} | ${fmt(r.medals.gold)} | ${fmt(r.medals.silver)} | ${fmt(r.medals.bronze)} | ${Math.round(r.run.maxSpeed * 3.6)} / ${Math.round(r.run.avgSpeed * 3.6)} | ${r.run.airTime.toFixed(1)} s (${r.run.jumps}) | ${r.run.wallHits} | ${r.specials.join(', ') || '-'} | ${r.sets.join(', ') || '-'} | ${surf} | ${r.styleAttempts} | ${r.seedsTried} | ${r.origin} |`);
    }
    L.push('');
  }
  return L.join('\n') + '\n';
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const rows: Row[] = [];
  const usedNames = new Set<string>();
  const placed: Array<[number, number, string]> = [];
  for (let s = 0; s < 4; s++) {
    for (let k = 0; k < 25; k++) {
      const handmade = Object.entries(HANDMADE).find(([, [hs, hk]]) => hs === s && hk === k)?.[0];
      const id = handmade ?? levelId(s, k);
      const keep = only && !only.has(id) && existsSync(`src/data/levels/${id}.json`);
      const row = keep ? await keepSlot(s, k, id, usedNames) : await makeSlot(s, k, usedNames);
      rows.push(row);
      placed.push([s, k, row.id]);
      console.log(`${String(row.number).padStart(3)} ${row.id.padEnd(10)} ${row.name.padEnd(24)} ${row.car.padEnd(6)} ${(row.run.time / 1000).toFixed(2).padStart(6)}s seeds=${row.seedsTried} style=${row.styleAttempts} ${keep ? '(kept)' : ''}`);
    }
  }
  writeFileSync('src/data/campaign.json', JSON.stringify(placed) + '\n');
  const meta: Record<string, { origin: string; seedsTried: number; rejects: Record<string, number> }> = {};
  for (const r of rows) meta[r.id] = { origin: r.origin, seedsTried: r.seedsTried, rejects: r.rejects };
  writeFileSync('src/data/level-meta.json', JSON.stringify(meta, null, 1) + '\n');
  writeFileSync('docs/LEVEL_REPORT.md', report(rows, (performance.now() - t0) / 1000));
  // the test runner caches transformed modules by content; a glob's file list is not part of that key
  rmSync('node_modules/.vitest-cache', { recursive: true, force: true });
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
main();
