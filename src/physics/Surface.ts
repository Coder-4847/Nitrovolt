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

/** Special block behaviours attached to a road surface. */
export type EffectId =
  | 'turbo'
  | 'turbo2'
  | 'reactor'
  | 'noSteer'
  | 'noBrake'
  | 'cruise'
  | 'fragile'
  | 'slowMo'
  | 'engineOff'
  | 'gravity';

export interface EffectProps {
  /** Grip/friction comes from this base surface. */
  base: SurfaceId;
  /** Render colour and glow (sRGB hex). */
  color: number;
  glow: number;
}

export const EFFECTS: Record<EffectId, EffectProps> = {
  turbo: { base: 'tech', color: 0xff8a1f, glow: 0xff6a00 },
  turbo2: { base: 'tech', color: 0xff2a3a, glow: 0xff1030 },
  reactor: { base: 'tech', color: 0xb34dff, glow: 0x9a2bff },
  noSteer: { base: 'tech', color: 0x2f6bff, glow: 0x1a50ff },
  noBrake: { base: 'tech', color: 0xffd21f, glow: 0xffc400 },
  cruise: { base: 'tech', color: 0x2fe38f, glow: 0x14d977 },
  fragile: { base: 'tarmac', color: 0xd8c9a8, glow: 0x000000 },
  slowMo: { base: 'tech', color: 0x8fe8ff, glow: 0x4fd8ff },
  engineOff: { base: 'tech', color: 0x7a7f8a, glow: 0x30343c },
  gravity: { base: 'tech', color: 0xff5fd2, glow: 0xff2fbf },
};

export const EFFECT_IDS = Object.keys(EFFECTS) as EffectId[];

/** A block's `surface` field is either a plain surface or a special effect. */
export type SurfaceSpec = SurfaceId | EffectId;

export function isEffect(s: string): s is EffectId {
  return s in EFFECTS;
}

export function isSurface(s: string): s is SurfaceId {
  return s in SURFACES;
}

export function parseSurface(spec: SurfaceSpec): { surface: SurfaceId; effect?: EffectId } {
  return isEffect(spec) ? { surface: EFFECTS[spec].base, effect: spec } : { surface: spec };
}
