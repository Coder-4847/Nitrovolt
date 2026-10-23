export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
/** What the settings store: a fixed level, or 'auto' (benchmark once, then dynamic resolution). */
export type QualityChoice = QualityLevel | 'auto';

export interface QualitySettings {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  shadowRange: number;
  /** Wider shadow filtering (softer edges). */
  softShadows: boolean;
  /** Native canvas MSAA. */
  antialias: boolean;
  /** Scenery density multiplier (1 = full). */
  scenery: number;
  particles: number;
  skidSegments: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 1024, shadowRange: 50, softShadows: false, antialias: false, scenery: 0.35, particles: 700, skidSegments: 700 },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, shadowRange: 60, softShadows: false, antialias: true, scenery: 0.6, particles: 1100, skidSegments: 1400 },
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, shadowRange: 80, softShadows: true, antialias: true, scenery: 1, particles: 1400, skidSegments: 2400 },
  ultra: { pixelRatioCap: 2.5, shadows: true, shadowMapSize: 4096, shadowRange: 100, softShadows: true, antialias: true, scenery: 1.35, particles: 2000, skidSegments: 3600 },
};

export const QUALITY_LEVELS: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

const KEY = 'nitrovolt.quality';

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
}

/** Starting guess before the benchmark has run (or for a fixed choice, that level). */
export function initialQuality(choice: QualityChoice): QualityLevel {
  if (choice !== 'auto') return choice;
  if (isTouchDevice()) return 'low';
  const cores = navigator.hardwareConcurrency ?? 4;
  return cores >= 8 ? 'high' : 'medium';
}

export function loadQualityChoice(): QualityChoice {
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (q && (q in QUALITY || q === 'auto')) return q as QualityChoice;
    const saved = localStorage.getItem(KEY) as QualityChoice | null;
    if (saved && (saved in QUALITY || saved === 'auto')) return saved;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

/** Kept for older callers: the level to start with. */
export function detectQuality(): QualityLevel {
  return initialQuality(loadQualityChoice());
}

export function saveQuality(q: QualityChoice): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* ignore */
  }
}

/**
 * Benchmark verdict from frame times (ms) measured on the menu backdrop: step down while frames are slow,
 * step up once when there is lots of headroom. Pure so it is unit-tested.
 */
export function benchmarkStep(frameMs: readonly number[], current: QualityLevel, touch: boolean): QualityLevel {
  if (frameMs.length < 20) return current;
  const sorted = [...frameMs].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)]!;
  const i = QUALITY_LEVELS.indexOf(current);
  if (p75 > 24 && i > 0) return QUALITY_LEVELS[i - 1]!;
  if (p75 < 9 && i < QUALITY_LEVELS.length - 1 && !(touch && i >= 1)) return QUALITY_LEVELS[i + 1]!;
  return current;
}

/**
 * Dynamic resolution: nudges the render scale (0.55..1) to hold ~60 fps. Hysteresis and a cooldown keep it
 * from pumping; it changes at most every 1.5 s in steps of 0.1.
 */
export class ResolutionGovernor {
  scale = 1;
  private acc = 0;
  private frames = 0;
  private cooldown = 0;
  enabled = true;
  constructor(private readonly targetMs = 17.5) {}

  /** Feed one frame; returns true when the scale changed. */
  update(dtSeconds: number): boolean {
    if (!this.enabled) {
      const changed = this.scale !== 1;
      this.scale = 1;
      return changed;
    }
    this.cooldown -= dtSeconds;
    this.acc += dtSeconds;
    this.frames++;
    if (this.acc < 1.5 || this.cooldown > 0) return false;
    const avg = (this.acc / this.frames) * 1000;
    this.acc = 0;
    this.frames = 0;
    let next = this.scale;
    if (avg > this.targetMs * 1.15) next = Math.max(0.55, this.scale - 0.1);
    else if (avg < this.targetMs * 0.72) next = Math.min(1, this.scale + 0.1);
    if (next === this.scale) return false;
    this.scale = Math.round(next * 100) / 100;
    this.cooldown = 1.5;
    return true;
  }
}
