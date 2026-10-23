import { BLOCK_TYPE_SET } from '../tracks/BlockLibrary';
import { TrackJson, validateTrackJson } from '../tracks/TrackSchema';
import { GRID_LIMIT, LEVEL_LIMIT, MAX_BLOCKS } from './EditorModel';

/** Only the fields that define a level travel in a share code (no thumbnails, no bot hints). */
function essentials(j: TrackJson): TrackJson {
  return { id: j.id, name: j.name, car: j.car, theme: j.theme, seed: j.seed, laps: j.laps ?? 1, blocks: j.blocks, medalTimes: j.medalTimes };
}

const toB64url = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * A compact, URL-safe code for a level: "z" + base64url(deflate(JSON)) where the browser supports
 * compression streams, otherwise "j" + base64url(JSON). A typical 40-block level is ~0.6 KB.
 */
export async function encodeLevel(json: TrackJson): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(essentials(json)));
  if (typeof CompressionStream !== 'undefined') return 'z' + toB64url(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'j' + toB64url(raw);
}

/** Decode and validate an untrusted share code. Throws with a readable message. */
export async function decodeLevel(code: string): Promise<TrackJson> {
  const c = code.trim();
  let bytes: Uint8Array;
  try {
    if (c[0] === 'z') bytes = await pipe(fromB64url(c.slice(1)), new DecompressionStream('deflate-raw'));
    else if (c[0] === 'j') bytes = fromB64url(c.slice(1));
    else throw new Error();
  } catch {
    throw new Error('not a Nitrovolt track code');
  }
  let json: TrackJson;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes)) as TrackJson;
  } catch {
    throw new Error('damaged track code');
  }
  assertSafeLevel(json);
  return json;
}

/** Schema check plus size limits, for anything that comes from outside (files, links). */
export function assertSafeLevel(json: TrackJson): void {
  if (!json || typeof json !== 'object' || !Array.isArray(json.blocks)) throw new Error('not a track');
  if (json.blocks.length > MAX_BLOCKS) throw new Error(`too many blocks (${json.blocks.length})`);
  for (const b of json.blocks) {
    if (!Array.isArray(b.gridPos) || Math.abs(b.gridPos[0]) > GRID_LIMIT || Math.abs(b.gridPos[2]) > GRID_LIMIT || Math.abs(b.gridPos[1]) > LEVEL_LIMIT) throw new Error('block outside the building area');
  }
  if (typeof json.name !== 'string' || json.name.length > 60) throw new Error('bad name');
  const errs = validateTrackJson(json, BLOCK_TYPE_SET);
  if (errs.length) throw new Error(errs.slice(0, 2).join('; '));
  if (![1, 2, 3, 4, 5].includes(json.laps ?? 1)) throw new Error('bad lap count');
}
