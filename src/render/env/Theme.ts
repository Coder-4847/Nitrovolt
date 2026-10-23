import type { ArenaStyle } from './Arena';

/** Everything that gives an environment its look. Pure data: shaders, scenery and materials read from it. */
// Level files name one of the five environments; older names ('neon', 'alpine', 'coast', ...) still resolve.
export type ThemeId = 'stadium' | 'forest' | 'snow' | 'desert' | 'sunset' | 'night';
export type GroundKind = 'grass' | 'snow' | 'sand';
export type SceneryKit = 'forest' | 'snow' | 'desert' | 'sunset' | 'night';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  sky: {
    zenith: number;
    horizon: number;
    /** Colour below the horizon (seen past the ground's far edge). */
    nadir: number;
    sunColor: number;
    /** Direction toward the sun. */
    sunDir: [number, number, number];
    /** 0..1: sun disc size. */
    sunSize: number;
    sunGlow: number;
    clouds: number;
    cloudColor: number;
    /** Stars instead of a sun (night). */
    stars?: boolean;
  };
  fog: { color: number; near: number; far: number };
  light: { hemiSky: number; hemiGround: number; hemi: number; sun: number; sunColor: number; exposure: number; env: number };
  ground: { kind: GroundKind; a: number; b: number; verge?: number; rock?: number };
  road: {
    /** Multiplies every surface's albedo. */
    tint: number;
    line: number;
    kerbA: number;
    kerbB: number;
  };
  /** Barriers: base colour and the painted band along their top. */
  wall: { base: number; band: number };
  /** Arch / sign colours for the start, checkpoints and the finish. */
  gate: { start: number; checkpoint: number; finish: number };
  /** Accent used by LED boards, screens and painted road graphics. */
  accent: number;
  arena: ArenaStyle;
  scenery: SceneryKit;
  /** Floodlit night: lamps and screens glow, the stadium lights the field. */
  night?: boolean;
}

const SEATS = [0x169c9c, 0x13878f, 0x1d6fa8, 0x17908f];

const forest: ThemeDef = {
  id: 'forest',
  label: 'Forest',
  sky: { zenith: 0x2f6fd6, horizon: 0xc4dcf2, nadir: 0x9fb4c6, sunColor: 0xfff6e8, sunDir: [-0.45, 0.62, -0.5], sunSize: 0.5, sunGlow: 0.25, clouds: 0.55, cloudColor: 0xffffff },
  fog: { color: 0xc8dbec, near: 260, far: 1900 },
  light: { hemiSky: 0xcfe0ff, hemiGround: 0x5a7048, hemi: 0.8, sun: 3.0, sunColor: 0xfff4e6, exposure: 1.0, env: 0.9 },
  ground: { kind: 'grass', a: 0x55913f, b: 0x6aa64c, verge: 0x7f8a4a, rock: 0x7d6a55 },
  road: { tint: 0xffffff, line: 0xf4f6f8, kerbA: 0x2f8cff, kerbB: 0xf4f6f8 },
  wall: { base: 0x2b3038, band: 0xf2f4f6 },
  gate: { start: 0xffc21f, checkpoint: 0x2f8cff, finish: 0xe8432f },
  accent: 0x26c2d8,
  arena: { structure: 0x9aa2ac, roof: 0xe6e9ed, seats: SEATS, snow: false, accent: 0x26c2d8 },
  scenery: 'forest',
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  stadium: { ...forest, id: 'stadium', label: 'Stadium' },
  forest,
  snow: {
    id: 'snow',
    label: 'Snow',
    sky: { zenith: 0x4f82c8, horizon: 0xe6edf4, nadir: 0xd0dae4, sunColor: 0xfffaf2, sunDir: [0.3, 0.5, 0.6], sunSize: 0.5, sunGlow: 0.3, clouds: 0.6, cloudColor: 0xf6f8fb },
    fog: { color: 0xdde6ee, near: 220, far: 1600 },
    light: { hemiSky: 0xdde9ff, hemiGround: 0xa6b0bc, hemi: 0.85, sun: 2.5, sunColor: 0xfff8f0, exposure: 0.95, env: 0.95 },
    ground: { kind: 'snow', a: 0xf2f5f9, b: 0xc8d4e2, verge: 0xa9b2be, rock: 0x6c7480 },
    road: { tint: 0xf2f4f8, line: 0xffffff, kerbA: 0x2f6bd8, kerbB: 0xf4f4f4 },
    wall: { base: 0x30353e, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x2f6bd8, finish: 0xd8372b },
    accent: 0x3d8bff,
    arena: { structure: 0xa7afb9, roof: 0xf4f7fa, seats: [0x2f6bd8, 0x2a5fc0, 0xd8372b, 0x2f6bd8], snow: true, accent: 0x3d8bff },
    scenery: 'snow',
  },
  desert: {
    id: 'desert',
    label: 'Desert',
    sky: { zenith: 0x3f6fb0, horizon: 0xf0d2aa, nadir: 0xc9a27a, sunColor: 0xffe2b8, sunDir: [-0.6, 0.45, 0.45], sunSize: 0.6, sunGlow: 0.4, clouds: 0.25, cloudColor: 0xfff0e0 },
    fog: { color: 0xead4b4, near: 240, far: 1800 },
    light: { hemiSky: 0xffe2c4, hemiGround: 0x9a7048, hemi: 0.8, sun: 3.0, sunColor: 0xffe8c4, exposure: 1.0, env: 0.8 },
    ground: { kind: 'sand', a: 0xe0b582, b: 0xc8956a, verge: 0xa8805c, rock: 0xa85f3c },
    road: { tint: 0xfff2e4, line: 0xfff6e6, kerbA: 0xe06a1e, kerbB: 0xf4ecdc },
    wall: { base: 0x3a3430, band: 0xf2ece2 },
    gate: { start: 0xffc21f, checkpoint: 0x37c07a, finish: 0xe8432f },
    accent: 0x37c07a,
    arena: { structure: 0xb59a7e, roof: 0xece2d4, seats: [0xc8643a, 0xb5562f, 0x1f8a8a, 0xc8643a], snow: false, accent: 0x37c07a },
    scenery: 'desert',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    sky: { zenith: 0x34477e, horizon: 0xffa65c, nadir: 0x6a5060, sunColor: 0xffc27a, sunDir: [0.75, 0.14, -0.5], sunSize: 0.9, sunGlow: 0.7, clouds: 0.5, cloudColor: 0xffb486 },
    fog: { color: 0xe3a77e, near: 240, far: 1700 },
    light: { hemiSky: 0xffc8a4, hemiGround: 0x4a4048, hemi: 0.75, sun: 2.8, sunColor: 0xffb878, exposure: 1.02, env: 0.95 },
    ground: { kind: 'grass', a: 0x4c7a38, b: 0x5c8a42, verge: 0x7a7444, rock: 0x7a5a44 },
    road: { tint: 0xf4ecf0, line: 0xffffff, kerbA: 0x3d7eff, kerbB: 0xf4f4f6 },
    wall: { base: 0x262a33, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x3d7eff, finish: 0xe8432f },
    accent: 0x3d9bff,
    arena: { structure: 0x8a8f9a, roof: 0x2a2f3a, seats: SEATS, snow: false, accent: 0x3d9bff },
    scenery: 'sunset',
  },
  night: {
    id: 'night',
    label: 'Night',
    sky: { zenith: 0x05070d, horizon: 0x1c2436, nadir: 0x0c1018, sunColor: 0xc8d8ff, sunDir: [0.35, 0.6, 0.4], sunSize: 0.25, sunGlow: 0.08, clouds: 0.35, cloudColor: 0x4a5266, stars: true },
    fog: { color: 0x141a26, near: 200, far: 1500 },
    light: { hemiSky: 0x8ea4d8, hemiGround: 0x2a3040, hemi: 0.9, sun: 1.7, sunColor: 0xdfe8ff, exposure: 1.05, env: 0.55 },
    ground: { kind: 'grass', a: 0x2f5a2c, b: 0x386834, verge: 0x4c5636, rock: 0x4e4438 },
    road: { tint: 0xe8ecf4, line: 0xffffff, kerbA: 0x3d7eff, kerbB: 0xf4f4f6 },
    wall: { base: 0x22262e, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x3d7eff, finish: 0xe8432f },
    accent: 0x3dd0ff,
    arena: { structure: 0x5a606c, roof: 0x22262e, seats: [0x1d5fa8, 0x174f90, 0x1d6fa8, 0x14457c], snow: false, accent: 0x3dd0ff },
    scenery: 'night',
    night: true,
  },
};

/** Older level files used other theme names; map them onto the five environments. */
const ALIASES: Record<string, ThemeId> = {
  grey: 'stadium', neon: 'forest', summer: 'forest', city: 'forest', metro: 'forest', alpine: 'snow', winter: 'snow',
  canyon: 'desert', coast: 'sunset', rally: 'sunset', industry: 'sunset',
};

export function themeFor(id: string | undefined): ThemeDef {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[(id && ALIASES[id]) || 'stadium'];
}
