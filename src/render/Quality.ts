export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  shadowRange: number;
  antialias: boolean;
  speedLines: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 1024, shadowRange: 50, antialias: false, speedLines: 40 },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, shadowRange: 70, antialias: true, speedLines: 80 },
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, shadowRange: 90, antialias: true, speedLines: 120 },
  ultra: { pixelRatioCap: 2.5, shadows: true, shadowMapSize: 4096, shadowRange: 110, antialias: true, speedLines: 160 },
};

const KEY = 'nitrovolt.quality';

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
}

/** Pick a sensible default; refined by the auto-benchmark in Phase 5. */
export function detectQuality(): QualityLevel {
  try {
    const saved = localStorage.getItem(KEY) as QualityLevel | null;
    if (saved && saved in QUALITY) return saved;
  } catch {
    /* storage unavailable */
  }
  if (isTouchDevice()) return 'low';
  const cores = navigator.hardwareConcurrency ?? 4;
  return cores >= 8 ? 'high' : 'medium';
}

export function saveQuality(q: QualityLevel): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* ignore */
  }
}
