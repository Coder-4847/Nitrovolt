import { storage } from './Storage';

export type CountdownMode = 'instant' | 'quick' | 'classic';
export type GhostShow = 'pb' | 'author' | 'both' | 'off';

export interface SettingsData {
  countdown: CountdownMode;
  /** Which ghosts race alongside you. */
  ghosts: GhostShow;
  /** HUD size multiplier (accessibility). */
  hudScale: number;
  /** Colour-blind-safe medal palette (shapes are always shown). */
  cbMedals: boolean;
  /** Everything unlocked (accessibility / dev). */
  unlockAll: boolean;
  reducedMotion: boolean;
  speedFx: boolean;
  showFps: boolean;
  /** Lower the render resolution automatically to hold the frame rate. */
  dynamicResolution: boolean;
}

const KEY = 'nitrovolt.settings.v1';

const DEFAULTS: SettingsData = {
  countdown: 'quick',
  ghosts: 'pb',
  hudScale: 1,
  cbMedals: false,
  unlockAll: false,
  reducedMotion: false,
  speedFx: true,
  showFps: false,
  dynamicResolution: true,
};

type Listener = (s: SettingsData) => void;
const listeners = new Set<Listener>();
let cache: SettingsData | null = null;

/**
 * Typed settings with change notification. Older keys written by Phases 1-3 (countdown, reduced motion,
 * speed lines) are migrated on first read.
 */
export const Settings = {
  get(): SettingsData {
    if (!cache) {
      const saved = storage.get<Partial<SettingsData> | null>(KEY, null);
      cache = { ...DEFAULTS, ...(saved ?? {}) };
      if (!saved) {
        cache.countdown = storage.get<CountdownMode>('nitrovolt.countdown', DEFAULTS.countdown);
        cache.reducedMotion = storage.get<boolean>('nitrovolt.reducedMotion', DEFAULTS.reducedMotion);
        cache.speedFx = storage.get<boolean>('nitrovolt.speedFx', DEFAULTS.speedFx);
      }
    }
    return cache;
  },

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    const s = { ...Settings.get(), [key]: value };
    cache = s;
    storage.set(KEY, s);
    for (const l of listeners) l(s);
  },

  onChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Drop the cache so the next read hits storage (after an import). */
  reload(): void {
    cache = null;
  },
};

export const COUNTDOWN_SECONDS: Record<CountdownMode, number> = { instant: 0, quick: 1.2, classic: 3 };
