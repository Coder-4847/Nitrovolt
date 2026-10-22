// Authoring tool: chains blocks into level JSON, validates with the path bot, derives provisional medal times.
// Usage: npx tsx scripts/make-levels.ts
import { writeFileSync } from 'node:fs';
import { Simulation } from '../src/physics/Simulation';
import { VOLT, cloneParams } from '../src/physics/VehicleParams';
import { BLOCK_TYPE_SET } from '../src/tracks/BlockLibrary';
import { ChainItem, layoutChain } from '../src/tracks/ChainLayout';
import { PathBot } from '../src/tracks/PathBot';
import { TrackJson, validateTrackJson } from '../src/tracks/TrackSchema';
import { buildTrack } from '../src/tracks/TrackGenerator';

const S = (type: string, extra: Partial<ChainItem> = {}): ChainItem => ({ type, ...extra });
const eff = (type: string, surface: string): ChainItem => ({ type, surface: surface as ChainItem['surface'] });

/** Expand a straight of `n` cells into blocks, dropping a checkpoint into it when asked. */
function straights(n: number, checkpoint = false): ChainItem[] {
  const out: ChainItem[] = [];
  let left = n - (checkpoint ? 1 : 0);
  for (const [id, size] of [['straight4', 4], ['straight2', 2], ['straight1', 1]] as const) {
    while (left >= size) {
      out.push(S(id));
      left -= size;
    }
  }
  if (checkpoint) out.splice(Math.floor(out.length / 2), 0, S('checkpoint'));
  return out;
}

/**
 * A rectangular 4-curve circuit. Each curve2L moves 1 cell forward and 2 left, so it closes when the
 * opposite sides match: c = a + 1 (the lap line is one cell of side A) and d = b.
 */
function circuit(): ChainItem[] {
  const a = 3, b = 7;
  const items: ChainItem[] = [
    S('lapFinish'), ...straights(a), S('curve2L'), ...straights(b, true), S('curve2L'), ...straights(a + 1, true), S('curve2L'), ...straights(b), S('curve2L'),
  ];
  const { next } = layoutChain(items);
  if (next.gridPos.join() !== '0,0,0' || next.rot !== 0) throw new Error(`circuit does not close: ${next.gridPos} rot ${next.rot}`);
  return items;
}

const levels: Array<{ id: string; name: string; theme: string; laps?: number; items: ChainItem[]; closed?: boolean }> = [
  {
    id: 'sprint01',
    name: 'Sprint 01',
    theme: 'grey',
    items: [
      S('start'), S('straight2'), S('straight2'),
      S('curve2R'), S('straight2'), S('checkpoint'),
      S('jumpRamp'), S('landing1', { gap: 2, dy: -1 }), eff('straight1', 'turbo'), S('straight2'),
      S('chicaneL'), S('straight2'), S('checkpoint'),
      S('curve3L'), S('straight2'), S('slopeUp1'), S('straight4'),
      S('bank2R'), S('straight2'), S('checkpoint'), eff('straight1', 'turbo'), S('straight2'), S('finish'),
    ],
  },
  {
    id: 'boostlab',
    name: 'Boost Lab',
    theme: 'grey',
    items: [
      S('start'), S('straight2'),
      eff('straight2', 'turbo'), S('straight4'), S('checkpoint'),
      eff('straight2', 'turbo2'), S('straight4'), S('checkpoint'),
      eff('straight2', 'reactor'), S('straight4'),
      eff('straight2', 'noSteer'), S('straight2'),
      eff('straight2', 'cruise'), S('straight2'),
      eff('straight2', 'noBrake'), S('straight2'),
      eff('straight2', 'engineOff'), S('straight2'), S('checkpoint'),
      eff('straight2', 'slowMo'), S('straight2'),
      eff('straight2', 'gravity'), S('straight4'),
      eff('straight1', 'fragile'), eff('straight1', 'fragile'), eff('straight1', 'fragile'),
      S('straight2'), S('finish'),
    ],
  },
  {
    id: 'circuit01',
    name: 'Ring Road',
    theme: 'grey',
    laps: 2,
    items: circuit(),
  },
  {
    id: 'stunt01',
    name: 'Stunt Park',
    theme: 'grey',
    items: [
      S('start'), S('straight4'), S('straight4'), S('loop'), S('straight2'),
      S('checkpoint'), S('halfpipe2'), S('straight2'),
      S('curve2L'), S('straight2'), S('spiralDownR'), S('straight2'), S('checkpoint'),
      S('wallRide4R'), S('straight2'),
      S('kicker'), S('landingLong', { gap: 1, dy: -1 }), S('straight2'), S('finish'),
    ],
  },
];

async function main(): Promise<void> {
  for (const lv of levels) {
    const { blocks } = layoutChain(lv.items);
    const json: TrackJson = {
      id: lv.id, name: lv.name, car: 'volt', theme: lv.theme, seed: 1, laps: lv.laps ?? 1, blocks,
      medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
    };
    const errs = validateTrackJson(json, BLOCK_TYPE_SET);
    if (errs.length) throw new Error(`${lv.id}: ${errs.join('; ')}`);
    const track = buildTrack(json);
    const sim = await Simulation.create(track, cloneParams(VOLT), 0);
    const bot = new PathBot(track.centerline, track.centerSurface, (lv.laps ?? 1) > 1);
    bot.maxSpeed = 75;
    if (process.env.LOOKT) bot.lookTime = Number(process.env.LOOKT);
    if (process.env.SLEW) bot.steerSlew = Number(process.env.SLEW);
    if (process.env.LAT) bot.lateralBudget = Number(process.env.LAT);
    let ticks = 0;
    while (sim.run.state !== 'finished' && ticks < 20000) {
      sim.step(bot.drive(sim.vehicle));
      ticks++;
    }
    const finished = sim.run.state === 'finished';
    const t = sim.run.finishTime ?? 0;
    console.log(`${lv.id.padEnd(10)} blocks=${blocks.length} bot ${finished ? 'FINISHED' : 'FAILED'} time=${(t / 1000).toFixed(2)}s respawns=${sim.respawnCount} progress=${(bot.progress * 100).toFixed(0)}% cps=${sim.run.nextCp}/${sim.run.checkpointCount}`);
    if (finished) json.medalTimes = { author: t, gold: Math.round(t * 1.08), silver: Math.round(t * 1.2), bronze: Math.round(t * 1.45) };
    writeFileSync(`src/data/levels/${lv.id}.json`, JSON.stringify(json, null, 1) + '\n');
  }
}
main();
