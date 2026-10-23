import { GhostData, GhostPlayer, GhostRecorder, levelFingerprint } from '../core/Ghost';
import { carParams, getCar } from '../data/cars';
import { Simulation } from '../physics/Simulation';
import { SurfaceId } from '../physics/Surface';
import { blockCells } from './Footprint';
import { PathBot, applyBotHints } from './PathBot';
import { BotHints, CELL, TrackJson } from './TrackSchema';
import { buildTrack } from './TrackGenerator';

export interface BotRun {
  finished: boolean;
  /** Finish time (ms) or 0. */
  time: number;
  respawns: number;
  ticks: number;
  /** Why the run stopped early, if it did. */
  failure: string | null;
  progress: number;
  /** Where the car last touched the road before the run failed (for diagnostics). */
  failPos: [number, number, number] | null;
  /** Speed (m/s) and airborne state just before the failure. */
  failSpeed: number;
  maxSpeed: number;
  avgSpeed: number;
  /** Seconds with no wheel on the ground. */
  airTime: number;
  jumps: number;
  /** Jumps off a ramp that came down beyond the landing block (on the road after it, or off the track). */
  overshoots: number;
  hardLandings: number;
  wallHits: number;
  /** Seconds with a wheel off the road (on the landscape). */
  offroad: number;
  /** Share of driving time per surface. */
  surfaces: Partial<Record<SurfaceId, number>>;
  hints: BotHints;
  ghost: GhostData | null;
}

/** Bot styles to try in turn: the car's natural style first, then more careful ones. */
export function hintLadder(car: string, base?: BotHints): BotHints[] {
  const soft = car === 'volt' ? { maxSpeed: 75 } : { maxSpeed: car === 'dune' ? 62 : car === 'frost' ? 50 : 55, lookTime: 0.7, steerSlew: 0.05, lateralBudget: 12 };
  const first = { ...soft, ...(base ?? {}) };
  return [
    first,
    { ...first, maxSpeed: Math.round((first.maxSpeed ?? 70) * 0.82), lateralBudget: (first.lateralBudget ?? 20) * 0.8 },
    { ...first, maxSpeed: Math.round((first.maxSpeed ?? 70) * 0.68), lateralBudget: (first.lateralBudget ?? 20) * 0.65, lookTime: Math.max(first.lookTime ?? 0.45, 0.6) },
  ];
}

/**
 * Drive a level with the validation bot. A valid level is finished with no respawn (falling off,
 * being stuck or missing a checkpoint all fail it). The successful run is recorded as a ghost.
 */
export interface RunOptions {
  /** Yield to the event loop every N ticks (browser: keep the page responsive). */
  yieldEvery?: number;
  /** Progress 0..1 along the track. */
  onProgress?: (p: number) => void;
  /** Return true to abandon the run. */
  cancelled?: () => boolean;
}

export async function botRun(json: TrackJson, hints: BotHints, maxSeconds = 150, opts: RunOptions = {}): Promise<BotRun> {
  const track = buildTrack(json);
  const def = getCar(json.car);
  const sim = await Simulation.create(track, carParams(def.id), false, undefined, def.behavior);
  const bot = new PathBot(track.centerline, track.centerSurface, (json.laps ?? 1) > 1, sim.vehicle.params, track.centerFrame);
  applyBotHints(bot, hints);
  const rec = new GhostRecorder();
  rec.start(sim);
  const surf: Partial<Record<SurfaceId, number>> = {};
  let ticks = 0, air = 0, maxV = 0, sumV = 0, jumps = 0, hard = 0, walls = 0, off = 0;
  let failure: string | null = null;
  let bestProgress = 0, lastGain = 0;
  let wasAir = false;
  let wraps = 0, prevProgress = 0;
  // ramp and landing cells: a flight that starts on a ramp should come down on its landing
  const cellsOf = (pred: (t: string) => boolean): Set<string> => {
    const out = new Set<string>();
    for (const b of json.blocks) if (pred(b.type)) for (const c of blockCells(b)) out.add(`${c.x},${c.z}`);
    return out;
  };
  const rampCells = [...cellsOf((t) => t === 'kicker' || t.startsWith('jumpRamp'))].map((k) => k.split(',').map(Number) as [number, number]);
  // take-off happens at the lip, right at the edge of the ramp's last cell
  const nearRamp = (x: number, z: number): boolean => rampCells.some(([cx, cz]) => Math.hypot(x - cx * CELL, z - cz * CELL) < 26);
  const landingCells = cellsOf((t) => t.startsWith('landing'));
  const cellKey = (x: number, z: number): string => `${Math.round(x / CELL)},${Math.round(z / CELL)}`;
  let takeoffOnRamp = false, flightTicks = 0, overshoots = 0;
  let lastSpeed = 0;
  const lastPos: [number, number, number] = [0, 0, 0];
  const limit = maxSeconds * 100;
  while (sim.run.state !== 'finished') {
    const frame = bot.drive(sim.vehicle);
    rec.push(frame);
    sim.step(frame);
    rec.afterStep(sim);
    ticks++;
    const v = sim.vehicle;
    if (sim.respawnCount === 0 && v.wheelsOnGround > 0) {
      lastSpeed = v.speed;
      lastPos[0] = v.position.x; lastPos[1] = v.position.y; lastPos[2] = v.position.z;
    }
    maxV = Math.max(maxV, v.speed);
    sumV += v.speed;
    if (v.wheels.some((w) => w.contact && w.offroad)) off++;
    // a valid run stays on the road: leaving it means the layout throws cars off somewhere
    if (off > 60 && !failure) { failure = 'left the road'; break; }
    const inAir = v.wheelsOnGround === 0;
    if (inAir) air++;
    if (inAir && !wasAir) {
      jumps++;
      takeoffOnRamp = nearRamp(v.position.x, v.position.z);
      flightTicks = 0;
    }
    if (inAir) flightTicks++;
    if (!inAir && wasAir && takeoffOnRamp && flightTicks > 35 && !landingCells.has(cellKey(v.position.x, v.position.z))) overshoots++;
    wasAir = inAir;
    const s = v.dominantSurface();
    if (s) surf[s] = (surf[s] ?? 0) + 1;
    for (const e of sim.events) {
      if (e.type === 'landing' && e.intensity > 14) hard++;
      if (e.type === 'impact' && e.intensity > 6) walls++;
    }
    sim.events.length = 0;
    // closed circuits wrap the bot's progress back to 0 every lap
    if (bot.progress < prevProgress - 0.5) wraps++;
    prevProgress = bot.progress;
    const prog = wraps + bot.progress;
    if (prog > bestProgress + 0.002) {
      bestProgress = prog;
      lastGain = ticks;
    }
    if (opts.yieldEvery && ticks % opts.yieldEvery === 0) {
      opts.onProgress?.(bestProgress / Math.max(1, json.laps ?? 1));
      await new Promise((r) => setTimeout(r, 0));
      if (opts.cancelled?.()) { failure = 'cancelled'; break; }
    }
    if (sim.respawnCount > 0) { failure = 'respawn (fell off or flipped)'; break; }
    if (ticks - lastGain > 1500) { failure = `stuck at ${((bestProgress / Math.max(1, json.laps ?? 1)) * 100).toFixed(0)}%`; break; }
    if (ticks > limit) { failure = 'too slow'; break; }
  }
  const finished = sim.run.state === 'finished' && failure === null;
  const total = Object.values(surf).reduce((a, b) => a + b, 0) || 1;
  const shares: Partial<Record<SurfaceId, number>> = {};
  for (const [k, n] of Object.entries(surf)) shares[k as SurfaceId] = n / total;
  const ghost = finished ? rec.finish(sim, { trackId: json.id, carId: def.id, levelHash: levelFingerprint(json.blocks, json.car, json.laps ?? 1) }) : null;
  const out: BotRun = {
    finished,
    time: finished ? sim.run.finishTime ?? 0 : 0,
    respawns: sim.respawnCount,
    ticks,
    failure: finished ? null : failure ?? 'did not finish',
    progress: bestProgress / Math.max(1, json.laps ?? 1),
    failPos: finished ? null : [...lastPos],
    failSpeed: lastSpeed,
    maxSpeed: maxV,
    avgSpeed: sumV / Math.max(1, ticks),
    airTime: air / 100,
    jumps,
    overshoots,
    offroad: off / 100,
    hardLandings: hard,
    wallHits: walls,
    surfaces: shares,
    hints,
    ghost,
  };
  sim.dispose();
  return out;
}

/** Try the hint ladder until one style finishes cleanly. */
export async function validateLevel(json: TrackJson, base?: BotHints, maxSeconds = 150, opts: RunOptions = {}): Promise<{ run: BotRun; attempts: number }> {
  const ladder = hintLadder(json.car, base);
  let last: BotRun | null = null;
  for (const [i, h] of ladder.entries()) {
    const r = await botRun(json, h, maxSeconds, opts);
    if (r.failure === 'cancelled') return { run: r, attempts: i + 1 };
    if (r.finished) return { run: r, attempts: i + 1 };
    last = r;
  }
  return { run: last!, attempts: ladder.length };
}

/** Re-simulate a recorded ghost and confirm it reproduces the run exactly. */
export async function verifyGhost(json: TrackJson, ghost: GhostData): Promise<boolean> {
  const track = buildTrack(json);
  const def = getCar(json.car);
  const player = await GhostPlayer.create(track, carParams(def.id), def.behavior, ghost, levelFingerprint(json.blocks, json.car, json.laps ?? 1));
  player.go();
  let worst = 0;
  while (!player.ended) {
    player.step();
    worst = Math.max(worst, player.snapshotError());
  }
  const exact = player.mode === 'exact' && worst < 1e-3;
  player.dispose();
  return exact;
}
