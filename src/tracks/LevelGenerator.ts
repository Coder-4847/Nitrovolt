import { Rng } from '../core/Rng';
import { CarId } from '../data/cars';
import { EffectId, SurfaceId, SurfaceSpec } from '../physics/Surface';
import { ChainItem, ChainStart, layoutChain, placeItem } from './ChainLayout';
import { CellUse, Occupancy, blockCells, gapCells } from './Footprint';
import { BlockJson, Variant } from './TrackSchema';

/** Everything that shapes one generated level: which car, which ground, which tricks, how long, how hard. */
export interface GenProfile {
  season: number;
  slot: number;
  /** 0 (first level of the campaign) .. 1 (last). */
  difficulty: number;
  car: CarId;
  theme: string;
  main: SurfaceId;
  /** Short patches of other ground. */
  patches: SurfaceId[];
  /** Special pads this level may use (besides turbo, which every level may use). */
  specials: EffectId[];
  /** Set pieces this level may use. */
  sets: Array<'loop' | 'wallRide' | 'halfpipe' | 'spiral' | 'platform'>;
  /** How often a phrase is a jump (0..1 weight). */
  jumpWeight: number;
  /** Target driving length in cells (16 m). */
  cells: number;
  checkpoints: number;
  laps: number;
  /** Road width variants and their weights. */
  variants: Array<[Variant, number]>;
  /** Tight R = 8 hairpins allowed. */
  hairpins: boolean;
  /** Speed cap the bot drives with on this level (m/s), also used to size jumps. */
  vmax: number;
}

const SLIPPERY = new Set<SurfaceSpec>(['ice', 'snow']);

/** Rough speed model (m/s) the generator uses to size jumps; the validation bot has the final word. */
interface Speed {
  v: number;
  /** Cells of road still to come under an active boost (no corners allowed until it runs out). */
  boost: number;
}

interface Phrase {
  name: string;
  items: ChainItem[];
}

const R_OF: Record<string, number> = {
  curve1L: 8, curve1R: 8, curve2L: 24, curve2R: 24, curve3L: 40, curve3R: 40,
  bank2L: 31, bank2R: 31, bank3L: 52, bank3R: 52, chicaneL: 40, chicaneR: 40, chicaneWideL: 40, chicaneWideR: 40,
};
const CELLS_OF: Record<string, number> = {
  straight1: 1, straight2: 2, straight4: 4, start: 1, checkpoint: 1, finish: 1, lapFinish: 1,
  curve1L: 1, curve1R: 1, curve2L: 3, curve2R: 3, curve3L: 5, curve3R: 5, bank2L: 3, bank2R: 3, bank3L: 5, bank3R: 5,
  chicaneL: 3, chicaneR: 3, chicaneWideL: 4, chicaneWideR: 4,
  slopeUp1: 1, slopeDown1: 1, slopeUp2: 2, slopeDown2: 2, steepUp: 2, steepDown: 2,
  kicker: 2, jumpRamp: 1, jumpRampLong: 2, landing1: 1, landingLong: 2,
  platform: 1, platformBig: 3, loop: 3, halfpipe2: 2, wallRide4L: 4, wallRide4R: 4, spiralDownL: 4, spiralDownR: 4,
};

/** Measured cells flown before dropping 4 m below the lip, at lip speeds of 18, 25, 32, 40, 50, 60 m/s. */
const FLIGHT: Record<string, Record<string, number[]>> = {
  volt: { kicker: [0.7, 1.1, 1.5, 2.0, 2.6, 3.4], jumpRamp: [0.9, 1.5, 2.2, 3.2, 4.7, 6.4] },
  dune: { kicker: [0.8, 1.2, 1.8, 2.5, 3.5, 4.4], jumpRamp: [1.0, 1.7, 2.6, 4.0, 6.3, 8.9] },
  frost: { kicker: [0.7, 1.1, 1.6, 2.1, 2.9, 3.7], jumpRamp: [0.8, 1.5, 2.3, 3.4, 5.1, 7.1] },
  gravel: { kicker: [0.7, 1.1, 1.6, 2.1, 2.9, 3.7], jumpRamp: [0.8, 1.5, 2.3, 3.4, 5.2, 7.5] },
};
const FLIGHT_V = [18, 25, 32, 40, 50, 60];

/** Interpolated flight distance (cells) for a car / ramp / lip speed. */
export function flight(car: string, ramp: string, v: number): number {
  const row = (FLIGHT[car] ?? FLIGHT.volt!)[ramp] ?? FLIGHT.volt!.kicker!;
  if (v <= FLIGHT_V[0]!) return row[0]! * (v / FLIGHT_V[0]!);
  for (let i = 1; i < FLIGHT_V.length; i++) {
    if (v <= FLIGHT_V[i]!) {
      const t = (v - FLIGHT_V[i - 1]!) / (FLIGHT_V[i]! - FLIGHT_V[i - 1]!);
      return row[i - 1]! + t * (row[i]! - row[i - 1]!);
    }
  }
  return row[row.length - 1]!;
}

/** Generated level layout: chain items (the authoring form) and the placed blocks. */
export interface GenResult {
  items: ChainItem[];
  blocks: BlockJson[];
  /** Phrases used, for the report. */
  phrases: string[];
}

const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r.next() * list.length)]!;
function weighted<T>(r: Rng, list: ReadonlyArray<[T, number]>): T {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let x = r.next() * total;
  for (const [v, w] of list) {
    x -= w;
    if (x <= 0) return v;
  }
  return list[list.length - 1]![0];
}

/**
 * Seeded random walk over the block grid, one phrase (a few blocks that belong together) at a time.
 * Rules: the track never crosses or touches itself (see `Occupancy`), boost pads are always followed by
 * straights, jumps get a run-up and a run-out and are sized from the expected speed, set pieces get the
 * speed or height they need, and checkpoints are spread evenly. Returns null when the walk boxes itself in.
 */
export function generateLevel(p: GenProfile, seed: number): GenResult | null {
  const rng = new Rng(seed);
  const occ = new Occupancy();
  const items: ChainItem[] = [];
  const blocks: BlockJson[] = [];
  const phrases: string[] = [];
  /** State before each committed phrase (for backtracking). */
  const marks: Array<{ items: number; anchor: ChainStart; speed: number; cells: number; cps: number; sinceCp: number; name: string }> = [];
  let anchor: ChainStart = { gridPos: [0, 0, 0], rot: 0 };
  const speed: Speed = { v: 0, boost: 0 };
  let cells = 0;
  let cps = 0;
  let sinceCp = 0;
  let backtracks = 0;
  const variant = (): Variant => weighted(rng, p.variants);
  const accel = p.car === 'volt' ? 11 : 9;

  /** Surface for the next phrase: mostly the main ground, sometimes a patch. */
  const ground = (): SurfaceId => (p.patches.length && rng.next() < 0.22 ? pick(rng, p.patches) : p.main);
  const item = (type: string, surface: SurfaceSpec, v: Variant, extra: Partial<ChainItem> = {}): ChainItem => {
    const it: ChainItem = { type, ...extra };
    if (surface !== 'tarmac') it.surface = surface;
    if (v !== 'std') it.variant = v;
    if (SLIPPERY.has(surface) && !extra.walls) it.walls = 'both';
    return it;
  };
  const run = (n: number, s: SurfaceSpec, v: Variant): ChainItem[] => {
    const out: ChainItem[] = [];
    let left = n;
    for (const [id, size] of [['straight4', 4], ['straight2', 2], ['straight1', 1]] as const) {
      while (left >= size) {
        out.push(item(id, s, v));
        left -= size;
      }
    }
    return out;
  };

  /** Advance the speed model over one item. */
  const flow = (it: ChainItem, sp: Speed): void => {
    const t = it.type;
    const loose = it.surface === 'dirt' || it.surface === 'sand' || it.surface === 'grass' || it.surface === 'snow';
    const lat = (it.surface === 'ice' ? 4 : loose ? 10 : 17) * (p.car === 'volt' && loose ? 0.7 : 1);
    const cap = p.vmax * (it.surface === 'ice' ? 0.6 : 1);
    if (it.surface === 'turbo') { sp.v = Math.min(p.vmax * 1.3, sp.v + 12); sp.boost = 7; }
    else if (it.surface === 'turbo2') { sp.v = Math.min(p.vmax * 1.6, sp.v + 18); sp.boost = 11; }
    else if (it.surface === 'reactor') { sp.v = Math.min(p.vmax * 1.5, sp.v + 15); sp.boost = 7; }
    else sp.boost = Math.max(0, sp.boost - (CELLS_OF[t] ?? 1));
    // crests and landings at speed throw the car into the air: no corner until it is back down and settled
    const vertical = t.startsWith('slope') || t.startsWith('steep') || t === 'kicker' || t.startsWith('jumpRamp') || t.startsWith('landing');
    if (vertical && sp.v > 22) sp.boost = Math.max(sp.boost, Math.round(2 + sp.v / 14));
    const r = R_OF[t];
    if (r) sp.v = Math.min(sp.v, Math.sqrt(lat * r));
    else if (t.startsWith('slopeUp') || t === 'steepUp') sp.v *= 0.88;
    else if (t.startsWith('slopeDown') || t === 'steepDown') sp.v = Math.min(cap, sp.v * 1.04 + 3);
    else if (t.startsWith('landing')) sp.v *= 0.9;
    else if (t === 'loop') sp.v *= 0.8;
    else if (t.startsWith('spiral')) sp.v = Math.min(sp.v, 18);
    else if (t === 'halfpipe2') sp.v *= 0.95;
    const n = CELLS_OF[t] ?? 1;
    if (!r && !t.startsWith('landing') && it.surface !== 'noBrake') sp.v = Math.min(Math.max(cap, sp.v * 0.985), Math.sqrt(sp.v * sp.v + 2 * accel * 16 * n));
  };

  /**
   * Jump pieces sized from the speed expected at the lip, using flight distances measured per car
   * (`scripts/jump-lab.ts`): the gap is chosen so the car clears it even 15 % slower than expected, and
   * the landing plus the in-line run-out catch it even 20 % faster.
   */
  const jump = (s: SurfaceSpec, v: Variant, vLip: number): ChainItem[] => {
    const ramp = vLip < 30 ? (rng.next() < 0.6 ? 'jumpRamp' : 'kicker') : 'kicker';
    const lo = flight(p.car, ramp, vLip * 0.85);
    const gap = Math.max(1, Math.min(4, Math.floor(lo - 0.25)));
    return [item(ramp, s, v), item('landingLong', s, v, { gap, dy: -1 })];
  };

  /** Corner speed (m/s) the speed model expects for a block on a surface. */
  const cornerSpeed = (type: string, surface: SurfaceSpec): number => {
    const loose = surface === 'dirt' || surface === 'sand' || surface === 'grass' || surface === 'snow';
    const lat = (surface === 'ice' ? 4 : loose ? 10 : 17) * (p.car === 'volt' && loose ? 0.7 : 1);
    return Math.sqrt(lat * (R_OF[type] ?? 1000));
  };
  /**
   * Straight road to brake on before a corner: the distance needed from the expected speed down to the
   * corner speed at a cautious deceleration for the surface (boost has to run out first).
   */
  const approach = (cur: Speed, type: string, surface: SurfaceSpec, v: Variant): ChainItem[] => {
    const vc = cornerSpeed(type, surface);
    if (cur.v <= vc + 2) return [];
    const loose = surface === 'dirt' || surface === 'sand' || surface === 'grass' || surface === 'snow';
    const decel = surface === 'ice' ? 3 : loose ? 6.5 : 11;
    const dist = (cur.v * cur.v - vc * vc) / (2 * decel);
    const cellsNeeded = Math.min(14, Math.ceil(dist / 16) + cur.boost);
    // braking straights do not accelerate in the model
    const out = run(cellsNeeded, surface === 'ice' ? p.main : surface, v);
    return out;
  };

  const level = (): number => anchor.gridPos[1];
  const dir = (): 'L' | 'R' => (rng.next() < 0.5 ? 'L' : 'R');

  const makePhrase = (): Phrase => {
    const s = ground();
    const v = variant();
    const d = p.difficulty;
    const choices: Array<[string, number]> = [
      ['run', 1.4],
      ['turn', 2.2],
      ['chicane', 0.9],
      ['hill', 0.8],
      ['jump', p.jumpWeight],
      ['pad', 0.55],
      ['special', p.specials.length ? 0.55 + d * 0.5 : 0],
      ['set', p.sets.length ? 0.25 + d * 0.35 : 0],
    ];
    // still boosting: only things a boost is good for (straights, jumps, climbs)
    const boosted = speed.boost > 0;
    const kind = boosted ? weighted(rng, [['run', 2], ['hill', 0.7]] as Array<[string, number]>) : weighted(rng, choices);
    const sp: Speed = { v: speed.v, boost: speed.boost };
    const simulate = (list: ChainItem[]): ChainItem[] => {
      for (const it of list) flow(it, sp);
      return list;
    };
    switch (kind) {
      case 'run':
        return { name: 'run', items: run(boosted ? Math.min(6, speed.boost) : 1 + rng.int(0, p.season >= 2 ? 4 : 3), s, v) };
      case 'turn': {
        const sizes: Array<[string, number]> = [['curve2', 1.3], ['curve3', 1], ['bank2', 0.5 + d * 0.4], ['bank3', 0.35]];
        if (p.hairpins) sizes.push(['curve1', 0.35 + d * 0.4]);
        const c = weighted(rng, sizes) + dir();
        return { name: c.replace(/[LR]$/, ''), items: [...approach(speed, c, s, v), item(c, s, c.startsWith('bank') ? 'std' : v)] };
      }
      case 'chicane': {
        const c = `chicane${rng.next() < 0.4 ? 'Wide' : ''}${dir()}`;
        return { name: 'chicane', items: [...approach(speed, c, s, v), item(c, s, v)] };
      }
      case 'hill': {
        const up = (boosted || level() < 3) && (level() <= 0 || boosted || rng.next() < 0.55) && level() < 8;
        const steep = d > 0.45 && rng.next() < 0.3;
        const big = rng.next() < 0.5;
        const t = steep ? (up ? 'steepUp' : 'steepDown') : `slope${up ? 'Up' : 'Down'}${big ? 2 : 1}`;
        if (!up && level() < -3) return { name: 'run', items: run(2, s, v) };
        return { name: 'hill', items: [item(t, s, v), ...run(1, s, v)] };
      }
      case 'jump': {
        // a jump must work flat out, so the approach speed is bounded: scrub speed with a corner first
        // when the road before is fast, then a short run-up; the run-out is straight and in line so a
        // long flight still lands on road
        const lead: ChainItem[] = [];
        if (sp.v > 36) {
          const c = `curve3${dir()}`;
          lead.push(...approach(sp, c, s, v));
          sp.boost = 0;
          lead.push(...simulate([item(c, s, v)]));
        }
        lead.push(...simulate(run(sp.v < 20 ? 2 : 1, s, v)));
        const pieces = simulate(jump(s, v, sp.v));
        return { name: 'jump', items: [...lead, ...pieces, ...run(3, s, v)] };
      }
      case 'pad': {
        const pad: SurfaceSpec = p.difficulty > 0.2 && rng.next() < 0.35 ? 'turbo2' : 'turbo';
        // a boost is always spent on straight road: into a jump, up a climb or down a long straight
        const pre = simulate([item('straight1', pad, v), ...run(2, s, v)]);
        const r = rng.next();
        if (r < 0.4 && level() < 7) return { name: `${pad}+climb`, items: [...pre, item('slopeUp2', s, v), ...run(2, s, v)] };
        return { name: pad, items: [...pre, ...run(pad === 'turbo2' ? 7 : 4, s, v)] };
      }
      case 'special': {
        const e = pick(rng, p.specials);
        switch (e) {
          case 'noSteer': return { name: e, items: [...run(1, s, v), item('straight2', e, v), ...run(1, s, v)] };
          case 'noBrake': return { name: e, items: [item('straight1', e, v), ...run(2, s, v)] };
          case 'cruise': return { name: e, items: [item('straight1', e, v), ...run(3, s, v)] };
          case 'fragile': return { name: e, items: [...run(1, s, v), item('straight1', e, v), item('straight1', e, v), item('straight1', e, v), ...run(1, s, v)] };
          case 'engineOff': return { name: e, items: [item('slopeDown1', e, v), ...run(2, s, v)] };
          case 'slowMo': {
            const lead = simulate([...(sp.v > 36 ? [item(`curve3${dir()}`, s, v)] : []), ...run(1, s, v)]);
            return { name: e, items: [...lead, item('straight1', e, v), ...jump(s, v, sp.v * 0.95), ...run(2, s, v)] };
          }
          case 'gravity':
            return { name: e, items: [...(sp.v > 30 ? [item(`curve3${dir()}`, s, v)] : []), item('straight1', e, v), item('kicker', s, v), item('landingLong', s, v, { gap: Math.max(1, Math.min(4, Math.floor(flight(p.car, 'kicker', Math.min(sp.v, 30) * 0.85) * 1.6 - 0.25))), dy: -1 }), ...run(4, s, v)] };
          case 'reactor':
            return { name: e, items: [...(sp.v > 30 ? [item(`curve3${dir()}`, s, v)] : []), item('straight1', e, v), ...run(1, s, v), item('kicker', s, v), item('landingLong', s, v, { gap: Math.max(1, Math.min(4, Math.floor(flight(p.car, 'kicker', Math.min(sp.v, 30) + 12) - 0.25))), dy: -1 }), ...run(4, s, v)] };
          case 'turbo':
          case 'turbo2':
          default:
            return { name: 'turbo', items: [item('straight1', 'turbo', v), ...run(3, s, v)] };
        }
      }
      case 'set':
      default: {
        const set = pick(rng, p.sets);
        // set pieces are built on tarmac-like ground so the bot (and players) get the grip they need
        const hard: SurfaceSpec = p.main === 'ice' ? 'snow' : s === 'ice' ? p.main : s;
        switch (set) {
          case 'loop':
            return { name: 'loop', items: [item('straight1', 'turbo2', 'std'), item('straight4', 'tarmac', 'std'), item('loop', 'tarmac', 'std'), ...run(2, hard, v)] };
          case 'wallRide':
            return { name: 'wallRide', items: [...run(2, hard, 'std'), item(`wallRide4${dir()}`, 'tarmac', 'std'), ...run(1, hard, v)] };
          case 'halfpipe':
            return { name: 'halfpipe', items: [...run(1, hard, v), item('halfpipe2', 'tarmac', 'std'), ...run(1, hard, v)] };
          case 'spiral':
            if (level() < 2) return { name: 'hill', items: [item('slopeUp2', s, v), ...run(1, s, v)] };
            return { name: 'spiral', items: [item(`spiralDown${dir()}`, hard, 'std'), ...run(1, hard, v)] };
          case 'platform':
          default:
            return { name: 'platform', items: [item(rng.next() < 0.5 ? 'platform' : 'platformBig', s, 'std'), ...run(1, s, v)] };
        }
      }
    }
  };

  /** Try to append a list of items; on any conflict nothing is kept. */
  const tryAppend = (list: ChainItem[]): boolean => {
    let a = anchor;
    const placed: BlockJson[] = [];
    const uses: CellUse[][] = [];
    const base = blocks.length;
    for (const [k, it] of list.entries()) {
      let r;
      try {
        r = placeItem(a, it, base + k);
      } catch {
        return false;
      }
      const cellsUsed = blockCells(r.block);
      if (it.gap) {
        const lv = a.gridPos[1];
        cellsUsed.push(...gapCells(a, it.gap, lv - 1 + (it.dy ?? 0), lv + 1));
      }
      if (r.block.gridPos[1] < -6 || r.block.gridPos[1] > 12) return false;
      // earlier items of the same phrase are already in `occ`, so a phrase cannot fold onto itself either
      if (occ.conflicts(cellsUsed, base + k)) return false;
      uses.push(cellsUsed);
      occ.add(cellsUsed, base + k);
      placed.push(r.block);
      a = r.next;
    }
    // committed
    for (const [k, b] of placed.entries()) {
      blocks.push(b);
      items.push(list[k]!);
      flow(list[k]!, speed);
      const n = CELLS_OF[list[k]!.type] ?? 1;
      cells += n;
      sinceCp += n;
    }
    anchor = a;
    return true;
  };
  const rollback = (to: number): void => {
    occ.truncate(to);
  };

  // ---- start
  const sv = variant();
  if (!tryAppend([item('start', p.main, sv), ...run(2, p.main, sv)])) return null;
  phrases.push('start');
  const cpEvery = p.cells / (p.checkpoints + 1);

  let guard = 0;
  const state = (name: string) => ({ items: blocks.length, anchor, speed: speed.v, cells, cps, sinceCp, name });
  while (cells < p.cells) {
    if (++guard > 900) return null;
    if (sinceCp >= cpEvery && cps < p.checkpoints) {
      const pre = state('checkpoint');
      if (tryAppend([item('checkpoint', ground(), variant())])) {
        cps++;
        sinceCp = 0;
        marks.push(pre);
        continue;
      }
      rollback(pre.items);
    }
    let ok = false;
    for (let attempt = 0; attempt < 24 && !ok; attempt++) {
      const ph = makePhrase();
      const pre = state(ph.name);
      if (tryAppend(ph.items)) {
        marks.push(pre);
        ok = true;
      } else rollback(pre.items);
    }
    if (!ok) {
      // boxed in: undo the last few phrases and try a different way
      if (++backtracks > 120 || marks.length < 2) return null;
      const undo = Math.min(marks.length, 1 + rng.int(0, 3));
      const m = marks[marks.length - undo]!;
      marks.length -= undo;
      blocks.length = m.items;
      items.length = m.items;
      rollback(m.items);
      anchor = m.anchor;
      speed.v = m.speed;
      cells = m.cells;
      cps = m.cps;
      sinceCp = m.sinceCp;
    }
  }
  phrases.push(...marks.map((m) => m.name));
  // ---- finish (with a short run-in and a run-out past the line)
  const fv = variant();
  for (let attempt = 0; attempt < 3; attempt++) {
    const mark = blocks.length;
    if (tryAppend([...run(1, p.main, fv), item('finish', p.main, fv), ...run(2, p.main, fv)])) {
      phrases.push('finish');
      // re-check with the real layout routine (same placement, catches anything the fast path missed)
      layoutChain(items);
      return { items, blocks, phrases };
    }
    rollback(mark);
  }
  return null;
}

/**
 * Closed circuit for lap levels: a rectangle of four same-handed corners whose sides are chosen so the
 * loop closes exactly, with features (pads, chicane pairs, hills) on the long sides.
 */
export function generateCircuit(p: GenProfile, seed: number): GenResult | null {
  const rng = new Rng(seed);
  const s = p.main;
  const v: Variant = p.variants.some(([x]) => x === 'wide') && rng.next() < 0.5 ? 'wide' : 'std';
  const it = (type: string, surface: SurfaceSpec = s, extra: Partial<ChainItem> = {}): ChainItem => {
    const o: ChainItem = { type, ...extra };
    if (surface !== 'tarmac') o.surface = surface;
    if (v !== 'std' && !type.startsWith('bank')) o.variant = v;
    if (SLIPPERY.has(surface)) o.walls = 'both';
    return o;
  };
  // banked corners have walls: safe to take flat out at the end of a long side
  const corner = rng.next() < 0.5 ? 'bank3' : p.difficulty > 0.4 ? 'bank2' : 'curve3';
  const side = rng.next() < 0.5 ? 'L' : 'R';
  const straights = (n: number): ChainItem[] => {
    const out: ChainItem[] = [];
    let left = n;
    for (const [id, size] of [['straight4', 4], ['straight2', 2], ['straight1', 1]] as const) {
      while (left >= size) {
        out.push(it(id));
        left -= size;
      }
    }
    return out;
  };
  /** A long side: `n` cells, net-straight and level, with one feature (a pad, a chicane pair or a hill). */
  const longSide = (n: number, cp: boolean): ChainItem[] => {
    const out: ChainItem[] = [];
    let left = n;
    if (cp) {
      out.push(it('checkpoint'));
      left -= 1;
    }
    const r = rng.next();
    if (left >= 9 && r < 0.4) {
      // pad at the start of the side, the rest of the side to use it and brake for the corner
      out.push(it('straight1', 'turbo'));
      left -= 1;
    } else if (left >= 8 && r < 0.7) {
      const d = rng.next() < 0.5 ? 'L' : 'R';
      out.push(...straights(1), it(`chicane${d}`), it(`chicane${d === 'L' ? 'R' : 'L'}`));
      left -= 7;
    } else if (left >= 6) {
      out.push(...straights(1), it('slopeUp1'), it('straight1'), it('slopeDown1'));
      left -= 4;
    }
    out.push(...straights(Math.max(0, left)));
    return out;
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = 2 + rng.int(0, 4);
    const b = 7 + rng.int(0, 7);
    for (let c = a - 2; c <= a + 4; c++) {
      for (let d = b - 3; d <= b + 3; d++) {
        if (c < 1 || d < 3) continue;
        const items: ChainItem[] = [
          it('lapFinish'), ...straights(a), it(corner + side), ...longSide(b, true), it(corner + side), ...straights(c), it(corner + side), ...longSide(d, true), it(corner + side),
        ];
        try {
          const { blocks, next } = layoutChain(items);
          if (next.gridPos[0] === 0 && next.gridPos[1] === 0 && next.gridPos[2] === 0 && next.rot === 0) {
            // the features on the long sides must not change the side length: re-check that no block overlaps another
            const occ = new Occupancy(2.6, 1e9);
            let clash = false;
            blocks.forEach((bk, i) => {
              const cells = blockCells(bk);
              // the last corner closes onto the lap line: they are neighbours, not a clash
              if (occ.conflicts(i === blocks.length - 1 ? cells.filter((c) => !blockCells(blocks[0]!).some((d) => d.x === c.x && d.z === c.z)) : cells, i)) clash = true;
              occ.add(cells, i);
            });
            if (!clash) return { items, blocks, phrases: ['circuit', corner, `${a}x${b}`] };
          }
        } catch {
          /* off-grid combination */
        }
      }
    }
  }
  return null;
}
