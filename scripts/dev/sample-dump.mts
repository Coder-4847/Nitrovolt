// Dump centerline samples around an index. Usage: npx tsx scripts/dev/sample-dump.mts <id> <index> [radius]
import { readFileSync } from 'node:fs';
import type { TrackJson } from '../../src/tracks/TrackSchema';
import { buildTrack } from '../../src/tracks/TrackGenerator';
import { terrainHeight } from '../../src/tracks/Terrain';
const [id, at, rad] = [process.argv[2]!, Number(process.argv[3]), Number(process.argv[4] ?? 5)];
const tr = buildTrack(JSON.parse(readFileSync(`src/data/levels/${id}.json`, 'utf8')) as TrackJson);
for (let i = at - rad; i <= at + rad; i++) {
  const p = tr.centerline[i]!, f = tr.centerFrame[i]!;
  console.log(i, f.kind, p.toArray().map((x) => x.toFixed(2)).join(' '), 'u', f.u.toArray().map((x) => x.toFixed(2)).join(' '), 'hw', f.hw, 'h', terrainHeight(tr.terrain!, p.x, p.z).toFixed(2));
}
