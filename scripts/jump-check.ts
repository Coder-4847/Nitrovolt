// Floors every jump in the campaign: the bot drives, but for the last 60 m before each ramp lip it holds
// full throttle and never brakes (like a player going for it). Reports where each car touched down
// relative to the landing block and whether the run survived. Usage: npx tsx scripts/jump-check.ts
import { readFileSync } from 'node:fs';
import { carParams, getCar } from '../src/data/cars';
import { Simulation } from '../src/physics/Simulation';
import { PathBot, applyBotHints } from '../src/tracks/PathBot';
import { buildTrack } from '../src/tracks/TrackGenerator';
import { blockCells } from '../src/tracks/Footprint';
import { CELL } from '../src/tracks/TrackSchema';

const campaign = JSON.parse(readFileSync('src/data/campaign.json', 'utf8')) as Array<[number, number, string]>;
let jumps = 0, onLanding = 0, onRoadAfter = 0, failed = 0, lostApproach = 0, lostAfter = 0;
const bad: string[] = [];
for (const [, , id] of campaign) {
  const json = JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8'));
  const ramps = json.blocks.filter((b: { type: string }) => b.type === 'kicker' || b.type.startsWith('jumpRamp'));
  if (!ramps.length) continue;
  const track = buildTrack(json);
  const def = getCar(json.car);
  const sim = await Simulation.create(track, carParams(def.id), 0, undefined, def.behavior);
  const bot = new PathBot(track.centerline, track.centerSurface, (json.laps ?? 1) > 1, sim.vehicle.params);
  applyBotHints(bot, json.bot ?? {});
  // ramp lips (cell centre + half a cell along the block heading) and landing cells
  const lips = ramps.map((b: { gridPos: number[] }) => ({ x: b.gridPos[0]! * CELL, z: b.gridPos[2]! * CELL }));
  // which cells belong to landing blocks
  const landingCells = new Set<string>();
  for (const b of json.blocks) if (b.type.startsWith('landing')) for (const c of blockCells(b)) landingCells.add(`${c.x},${c.z}`);
  const used = new Set<number>();
  let flying = -1, flight = 0, lipSpeed = 0, resp = 0, sinceLanding = 1e9;
  let tx = 0, tz = 0;
  for (let i = 0; i < 20000 && sim.run.state !== 'finished'; i++) {
    const v = sim.vehicle;
    // the ramp being approached: within 50 m of its cell and not jumped yet
    const k = flying >= 0 ? -1 : lips.findIndex((l: { x: number; z: number }, j: number) => !used.has(j) && Math.hypot(v.position.x - l.x, v.position.z - l.z) < 30);
    const f = bot.drive(v);
    sim.step(k >= 0 ? { ...f, accel: 1, brake: 0 } : f);
    if (k >= 0 && v.wheelsOnGround === 0) { flying = k; flight = 0; lipSpeed = v.speed; tx = v.position.x; tz = v.position.z; }
    if (flying >= 0) {
      flight += 1 / 100;
      if (v.wheelsOnGround > 0 && flight > 0.25) {
        used.add(flying);
        jumps++;
        const on = landingCells.has(`${Math.round(v.position.x / CELL)},${Math.round(v.position.z / CELL)}`);
        if (on) onLanding++;
        else onRoadAfter++;
        if (process.env.DETAIL) {
          const ramp = ramps[flying]!, i = json.blocks.indexOf(ramp), land = json.blocks[i + 1]!;
          const lx = land.gridPos[0] * CELL, lz = land.gridPos[2] * CELL;
          const dLand = Math.hypot(lx - tx, lz - tz);
          console.log(`${id} ${ramp.type}->${land.type} lip ${(lipSpeed * 3.6).toFixed(0)} km/h: flew ${Math.hypot(v.position.x - tx, v.position.z - tz).toFixed(0)} m, landing cell centre at ${dLand.toFixed(0)} m${on ? ' (on landing)' : ''}`);
        }
        sinceLanding = 0;
        flying = -1;
      } else if (v.wheelsOnGround > 0) flying = -1;
    }
    sinceLanding += 0.01;
    if (sim.respawnCount > resp) {
      resp = sim.respawnCount;
      if (flying >= 0) { failed++; bad.push(`${id} (${json.car}, lip ${(lipSpeed * 3.6).toFixed(0)} km/h)`); }
      else if (k >= 0) lostApproach++;
      else if (sinceLanding < 3) lostAfter++;
      if (flying >= 0) used.add(flying);
      flying = -1;
    }
    if (sim.respawnCount > 3) break;
  }
}
console.log(`flat-out jumps: ${jumps}; touched down on the landing block ${onLanding}, on the road after it ${onRoadAfter}`);
console.log(`lost the car in flight ${failed}, on the floored run-up ${lostApproach}, within 3 s after landing ${lostAfter}`);
if (bad.length) console.log('lost in flight:', bad.join(', '));
