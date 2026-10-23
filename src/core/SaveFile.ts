import { GhostData } from './Ghost';
import { GhostStore } from './GhostStore';
import { Settings } from './Settings';
import { UserLevel, UserLevels } from '../editor/UserLevels';

const PREFIX = 'nitrovolt.';
export const SAVE_FORMAT = 'nitrovolt-save';

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  /** 1 = Phase 4 (no player tracks), 2 = with player tracks. Both import. */
  version: 1 | 2;
  exportedAt: string;
  /** Every `nitrovolt.*` localStorage entry (records, settings, bindings, liveries, tuning, audio...). */
  storage: Record<string, string>;
  /** Personal-best ghosts. */
  ghosts: GhostData[];
  /** Tracks made in the editor (version 2). */
  userLevels?: UserLevel[];
}

/** Everything the game saved, as one JSON-able object. */
export async function exportSave(): Promise<SaveFile> {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? '';
    }
  } catch {
    /* storage unavailable */
  }
  return { format: SAVE_FORMAT, version: 2, exportedAt: new Date().toISOString(), storage: data, ghosts: await GhostStore.all(), userLevels: await UserLevels.list() };
}

/** Validate an untrusted save file; returns problems (empty = ok). */
export function validateSave(x: unknown): string[] {
  const errs: string[] = [];
  const s = x as Partial<SaveFile> | null;
  if (!s || typeof s !== 'object') return ['not a JSON object'];
  if (s.format !== SAVE_FORMAT) errs.push('not a Nitrovolt save file');
  if (s.version !== 1 && s.version !== 2) errs.push('unsupported save version');
  if (s.userLevels !== undefined) {
    if (!Array.isArray(s.userLevels)) errs.push('bad track list');
    else for (const l of s.userLevels) if (!l || typeof l.id !== 'string' || !l.id.startsWith('u-') || !l.json || !Array.isArray(l.json.blocks)) errs.push('bad track entry');
  }
  if (!s.storage || typeof s.storage !== 'object') errs.push('missing storage block');
  else {
    for (const [k, v] of Object.entries(s.storage)) {
      if (!k.startsWith(PREFIX)) errs.push(`foreign key ${k}`);
      if (typeof v !== 'string') errs.push(`bad value for ${k}`);
    }
  }
  if (!Array.isArray(s.ghosts)) errs.push('missing ghosts list');
  else for (const g of s.ghosts) if (!g || g.v !== 1 || typeof g.trackId !== 'string' || typeof g.input !== 'string') errs.push('bad ghost entry');
  return errs;
}

/** Replace the current save with the file's contents. Throws on an invalid file. */
export async function importSave(x: unknown): Promise<void> {
  const errs = validateSave(x);
  if (errs.length) throw new Error(errs.slice(0, 3).join('; '));
  const s = x as SaveFile;
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(s.storage)) localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
  await GhostStore.clear();
  for (const g of s.ghosts) await GhostStore.save(g);
  // player tracks are merged (an import never deletes a track you made on this device)
  for (const l of s.userLevels ?? []) await UserLevels.save(l);
  Settings.reload();
}
