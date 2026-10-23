// Report road samples where the terrain comes up through the road. Usage: npx tsx scripts/dev/terrain-check.mts [id...]
import { readFileSync, readdirSync } from 'node:fs';
import type { TrackJson } from '../../src/tracks/TrackSchema';
import { buildTrack } from '../../src/tracks/TrackGenerator';
import { terrainHeight } from '../../src/tracks/Terrain';
const ids = process.argv.slice(2);
const LEVELS: TrackJson[] = readdirSync('src/data/levels').map((f) => JSON.parse(readFileSync(`src/data/levels/${f}`, 'utf8')) as TrackJson);
for (const lv of LEVELS.filter((l) => !ids.length || ids.includes(l.id))) {
  const tr = buildTrack(lv);
  const t = tr.terrain!;
  const bad: string[] = [];
  tr.centerline.forEach((p, i) => {
    const h = terrainHeight(t, p.x, p.z);
    if (h > p.y - 0.1) bad.push(`${i}:${tr.centerFrame[i]!.kind} y=${p.y.toFixed(1)} h=${h.toFixed(1)} u=${tr.centerFrame[i]!.u.y.toFixed(2)}`);
  });
  if (bad.length) console.log(lv.id, bad.length, bad.slice(0, 6).join(' | '));
}
