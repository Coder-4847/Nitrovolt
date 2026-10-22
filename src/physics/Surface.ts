/** Driving surfaces. Cars scale these base values with their own per-surface grip table. */
export type SurfaceId =
  | 'tarmac'
  | 'dirt'
  | 'grass'
  | 'ice'
  | 'snow'
  | 'sand'
  | 'wood'
  | 'plastic'
  | 'tech';

export interface SurfaceProps {
  /** Base grip multiplier (1 = tarmac). */
  grip: number;
  /** Extra rolling resistance as a fraction of normal load. */
  rolling: number;
  /** Debug/grey-box tint (sRGB hex). */
  color: number;
}

export const SURFACES: Record<SurfaceId, SurfaceProps> = {
  tarmac: { grip: 1.0, rolling: 0.012, color: 0x9096a2 },
  dirt: { grip: 0.72, rolling: 0.03, color: 0xb08052 },
  grass: { grip: 0.5, rolling: 0.12, color: 0x3e7a3a },
  ice: { grip: 0.12, rolling: 0.006, color: 0x9fd8ee },
  snow: { grip: 0.42, rolling: 0.05, color: 0xdfe8ee },
  sand: { grip: 0.55, rolling: 0.09, color: 0xd9bd7a },
  wood: { grip: 1.08, rolling: 0.015, color: 0x8a6232 },
  plastic: { grip: 0.32, rolling: 0.01, color: 0xd84a8c },
  tech: { grip: 1.0, rolling: 0.012, color: 0x7f93b0 },
};

export const SURFACE_IDS = Object.keys(SURFACES) as SurfaceId[];
