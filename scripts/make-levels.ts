// Authoring tool for the hand-made levels: chains blocks into level JSON, validates with the path bot,
// records the author ghost and derives medal times. Usage: npx tsx scripts/make-levels.ts
// (`npm run campaign` re-validates these and generates the other 93 campaign levels.)
import { writeFileSync } from 'node:fs';
import { CarId, carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { BLOCK_TYPE_SET } from '../src/tracks/BlockLibrary';
import { ChainItem, layoutChain } from '../src/tracks/ChainLayout';
import { GhostRecorder, levelFingerprint } from '../src/core/Ghost';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { TrackJson, validateTrackJson } from '../src/tracks/TrackSchema';
import { HANDMADE, MEDAL_FACTORS } from '../src/tracks/CampaignPlan';
import { buildTrack } from '../src/tracks/TrackGenerator';

const S = (type: string, extra: Partial<ChainItem> = {}): ChainItem => ({ type, ...extra });
const on = (surface: string) => (type: string, extra: Partial<ChainItem> = {}): ChainItem => ({ type, surface: surface as ChainItem['surface'], ...extra });
const d = on('dirt'), g = on('grass'), sd = on('sand'), ic = (type: string, extra: Partial<ChainItem> = {}): ChainItem => ({ type, surface: 'ice', walls: 'both', ...extra }), sa = on('sand');
/** snow with rails on both sides: slippery tracks get barriers */
const sn = (type: string, extra: Partial<ChainItem> = {}): ChainItem => ({ type, surface: 'snow', walls: 'both', ...extra });
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

const levels: Array<{ id: string; name: string; theme: string; car?: CarId; maxSpeed?: number; look?: number; slew?: number; lat?: number; laps?: number; items: ChainItem[]; closed?: boolean }> = [
  {
    id: 'sprint01',
    name: 'Sprint 01',
    theme: 'neon',
    items: [
      S('start'), S('straight2'), S('straight2'),
      S('curve2R'), S('straight2'), S('checkpoint'),
      S('jumpRamp'), S('landingXL', { gap: 1, dy: -1 }), S('straight2'),
      S('chicaneL'), S('straight2'), S('checkpoint'),
      S('curve3L'), S('straight2'), S('slopeUp1'), S('straight4'),
      S('bank2R'), S('straight2'), S('checkpoint'), eff('straight1', 'turbo'), S('straight2'), S('finish'),
    ],
  },
  {
    id: 'boostlab',
    name: 'Boost Lab',
    theme: 'neon',
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
    theme: 'neon',
    laps: 2,
    items: circuit(),
  },
  {
    id: 'gravel01',
    look: 0.7, slew: 0.05, lat: 12,
    name: 'Dirt Road',
    theme: 'coast',
    car: 'gravel',
    maxSpeed: 55,
    items: [
      d('start'), d('straight2'), d('curve2L'), d('straight2'), d('chicaneR'), d('straight2'),
      d('checkpoint'), d('curve3R', { walls: 'both' }), d('straight2'),
      g('straight2'), g('curve2L'), g('straight1'),
      d('straight2'), d('checkpoint'), d('kicker'), d('landingXL', { gap: 1, dy: -1 }), d('straight1'),
      sd('straight2'), sd('curve2R'), sd('straight2'),
      d('straight1'), d('checkpoint'), d('chicaneL'), d('straight2'), d('curve2R'), d('straight2'), S('finish', { surface: 'dirt' }), d('straight2'),
    ],
  },
  {
    id: 'frost01',
    look: 0.7, slew: 0.05, lat: 12,
    name: 'Ice Pass',
    theme: 'alpine',
    car: 'frost',
    maxSpeed: 50,
    items: [
      sn('start'), sn('straight2'), sn('straight2'), sn('curve3L'), sn('straight2'), sn('checkpoint'),
      ic('straight2'), ic('straight2'), sn('straight2'), sn('straight2'), sn('chicaneL'), sn('straight2'),
      sn('slopeUp2'), sn('straight2'), sn('bank3R', { walls: 'both' }), sn('straight2'), sn('checkpoint'),
      sn('slopeDown2'), sn('straight2'), sn('kicker'), sn('landingXL', { gap: 1, dy: -1 }), sn('straight1'),
      ic('straight2'), ic('curve3L'), ic('straight1'), sn('straight2'), sn('checkpoint'), sn('curve2R'), sn('straight2'), S('finish', { surface: 'snow' }), sn('straight2'),
    ],
  },
  {
    id: 'dune01',
    look: 0.7, slew: 0.05, lat: 12,
    name: 'Dune Run',
    theme: 'desert',
    car: 'dune',
    maxSpeed: 62,
    items: [
      sa('start'), sa('straight2'), sa('straight2'), sa('curve3L'), sa('straight1'), sa('checkpoint'),
      sa('slopeUp1'), sa('straight1'), sa('slopeDown1'), sa('straight2'),
      sa('jumpRamp'), sa('landingXL', { gap: 1, dy: -1 }), sa('straight2'), sa('checkpoint'),
      sa('curve2R'), sa('straight2'), sa('bank3L', { walls: 'both' }), sa('straight2'),
      sa('kicker'), sa('landing1', { gap: 1, dy: -1 }), sa('straight2'), sa('checkpoint'),
      sa('chicaneWideL'), sa('straight2'), sa('curve2R'), sa('straight2'), S('finish', { surface: 'sand' }), sa('straight2'),
    ],
  },
  {
    id: 'stunt01',
    name: 'Stunt Park',
    theme: 'neon',
    items: [
      S('start'), S('straight4'), S('straight4'), S('loop'), S('straight2'),
      S('checkpoint'), S('halfpipe2'), S('straight2'),
      S('curve2L'), S('straight2'), S('spiralDownR'), S('straight2'), S('checkpoint'),
      S('wallRide4R'), S('straight2'),
      S('kicker'), S('landingXL', { gap: 1, dy: -1 }), S('straight1'), S('finish'),
    ],
  },
];

async function main(): Promise<void> {
  for (const lv of levels) {
    const { blocks } = layoutChain(lv.items);
    const json: TrackJson = {
      id: lv.id, name: lv.name, car: lv.car ?? 'volt', theme: lv.theme, seed: 1, laps: lv.laps ?? 1, blocks,
      medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 },
    };
    const errs = validateTrackJson(json, BLOCK_TYPE_SET);
    if (errs.length) throw new Error(`${lv.id}: ${errs.join('; ')}`);
    const track = buildTrack(json);
    const def = getCar(lv.car ?? 'volt');
    const sim = await Simulation.create(track, carParams(def.id), 0, undefined, def.behavior);
    const bot = new PathBot(track.centerline, track.centerSurface, (lv.laps ?? 1) > 1, sim.vehicle.params);
    json.bot = { maxSpeed: lv.maxSpeed ?? 75, ...(lv.look ? { lookTime: lv.look } : {}), ...(lv.slew ? { steerSlew: lv.slew } : {}), ...(lv.lat ? { lateralBudget: lv.lat } : {}) };
    applyBotHints(bot, json.bot);
    if (process.env.LOOKT) bot.lookTime = Number(process.env.LOOKT);
    if (process.env.SLEW) bot.steerSlew = Number(process.env.SLEW);
    if (process.env.LAT) bot.lateralBudget = Number(process.env.LAT);
    let ticks = 0;
    const rec = new GhostRecorder();
    rec.start(sim);
    while (sim.run.state !== 'finished' && ticks < 20000) {
      const frame = bot.drive(sim.vehicle);
      rec.push(frame);
      sim.step(frame);
      rec.afterStep(sim);
      ticks++;
    }
    const finished = sim.run.state === 'finished';
    const t = sim.run.finishTime ?? 0;
    console.log(`${lv.id.padEnd(10)} blocks=${blocks.length} bot ${finished ? 'FINISHED' : 'FAILED'} time=${(t / 1000).toFixed(2)}s respawns=${sim.respawnCount} progress=${(bot.progress * 100).toFixed(0)}% cps=${sim.run.nextCp}/${sim.run.checkpointCount}`);
    if (finished) {
      // same margins as the rest of the campaign (season of the slot the level sits in)
      const [g, sv, b] = MEDAL_FACTORS[HANDMADE[lv.id]?.[0] ?? 0]!;
      json.medalTimes = { author: t, gold: Math.round(t * g), silver: Math.round(t * sv), bronze: Math.round(t * b) };
      // the bot's run is the author ghost
      const ghost = rec.finish(sim, { trackId: lv.id, carId: def.id, levelHash: levelFingerprint(json.blocks, json.car, json.laps ?? 1) });
      writeFileSync(`src/data/ghosts/${lv.id}.json`, JSON.stringify(ghost) + '\n');
    }
    writeFileSync(`src/data/levels/${lv.id}.json`, JSON.stringify(json, null, 1) + '\n');
  }
}
main();
