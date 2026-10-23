import type { ArenaStyle } from './Arena';

/** Everything that gives a season its look. Pure data: shaders, scenery and materials read from it. */
// The ids are historical (level files and share codes carry them): 'neon' is the summer stadium,
// 'alpine' the winter stadium, 'desert' the canyon, 'coast' the sunset stadium.
export type ThemeId = 'stadium' | 'neon' | 'alpine' | 'desert' | 'coast';
export type GroundKind = 'grass' | 'snow' | 'sand';
export type SceneryKit = 'stadium' | 'winter' | 'canyon' | 'sunset';

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
  };
  fog: { color: number; near: number; far: number };
  light: { hemiSky: number; hemiGround: number; hemi: number; sun: number; sunColor: number; exposure: number; env: number };
  ground: { kind: GroundKind; a: number; b: number };
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
}

const SEATS = [0x169c9c, 0x13878f, 0x1d6fa8, 0x17908f];

export const THEMES: Record<ThemeId, ThemeDef> = {
  stadium: {
    id: 'stadium',
    label: 'Stadium',
    sky: { zenith: 0x2f6fd6, horizon: 0xc4dcf2, nadir: 0x9fb4c6, sunColor: 0xfff6e8, sunDir: [0.4, 0.72, 0.3], sunSize: 0.5, sunGlow: 0.25, clouds: 0.5, cloudColor: 0xffffff },
    fog: { color: 0xc8dbec, near: 220, far: 1600 },
    light: { hemiSky: 0xcfe0ff, hemiGround: 0x5a7048, hemi: 0.85, sun: 2.9, sunColor: 0xfff4e6, exposure: 1.0, env: 0.9 },
    ground: { kind: 'grass', a: 0x4c8a3a, b: 0x5e9a48 },
    road: { tint: 0xffffff, line: 0xf4f6f8, kerbA: 0x2f8cff, kerbB: 0xf4f6f8 },
    wall: { base: 0x2b3038, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x2f8cff, finish: 0xe8432f },
    accent: 0x26c2d8,
    arena: { structure: 0x9aa2ac, roof: 0xe6e9ed, seats: SEATS, snow: false, accent: 0x26c2d8 },
    scenery: 'stadium',
  },
  neon: {
    id: 'neon',
    label: 'Summer Stadium',
    sky: { zenith: 0x2f6fd6, horizon: 0xc4dcf2, nadir: 0x9fb4c6, sunColor: 0xfff6e8, sunDir: [-0.45, 0.68, -0.5], sunSize: 0.5, sunGlow: 0.25, clouds: 0.55, cloudColor: 0xffffff },
    fog: { color: 0xc8dbec, near: 220, far: 1600 },
    light: { hemiSky: 0xcfe0ff, hemiGround: 0x5a7048, hemi: 0.85, sun: 2.9, sunColor: 0xfff4e6, exposure: 1.0, env: 0.9 },
    ground: { kind: 'grass', a: 0x4c8a3a, b: 0x5e9a48 },
    road: { tint: 0xffffff, line: 0xf4f6f8, kerbA: 0x2f8cff, kerbB: 0xf4f6f8 },
    wall: { base: 0x2b3038, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x2f8cff, finish: 0xe8432f },
    accent: 0x26c2d8,
    arena: { structure: 0x9aa2ac, roof: 0xe6e9ed, seats: SEATS, snow: false, accent: 0x26c2d8 },
    scenery: 'stadium',
  },
  alpine: {
    id: 'alpine',
    label: 'Winter Stadium',
    sky: { zenith: 0x5f86c2, horizon: 0xe6edf4, nadir: 0xd0dae4, sunColor: 0xfffaf2, sunDir: [0.3, 0.5, 0.6], sunSize: 0.5, sunGlow: 0.3, clouds: 0.65, cloudColor: 0xf6f8fb },
    fog: { color: 0xdde6ee, near: 160, far: 1200 },
    light: { hemiSky: 0xdde9ff, hemiGround: 0xa6b0bc, hemi: 0.9, sun: 2.4, sunColor: 0xfff8f0, exposure: 0.95, env: 0.95 },
    ground: { kind: 'snow', a: 0xeef2f7, b: 0xc3cfdc },
    road: { tint: 0xf2f4f8, line: 0xffffff, kerbA: 0x2f6bd8, kerbB: 0xf4f4f4 },
    wall: { base: 0x30353e, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x2f6bd8, finish: 0xd8372b },
    accent: 0x3d8bff,
    arena: { structure: 0xa7afb9, roof: 0xf4f7fa, seats: [0x2f6bd8, 0x2a5fc0, 0xd8372b, 0x2f6bd8], snow: true, accent: 0x3d8bff },
    scenery: 'winter',
  },
  desert: {
    id: 'desert',
    label: 'Canyon',
    sky: { zenith: 0x4a6fa5, horizon: 0xf2c79a, nadir: 0xc9a27a, sunColor: 0xffdcb0, sunDir: [-0.6, 0.3, 0.45], sunSize: 0.65, sunGlow: 0.45, clouds: 0.3, cloudColor: 0xfff0e0 },
    fog: { color: 0xe6caa6, near: 200, far: 1500 },
    light: { hemiSky: 0xffe2c4, hemiGround: 0x8a6440, hemi: 0.8, sun: 2.8, sunColor: 0xffe2b8, exposure: 1.0, env: 0.8 },
    ground: { kind: 'sand', a: 0xd2a776, b: 0xb98a5c },
    road: { tint: 0xfff2e4, line: 0xfff6e6, kerbA: 0xe06a1e, kerbB: 0xf4ecdc },
    wall: { base: 0x3a3430, band: 0xf2ece2 },
    gate: { start: 0xffc21f, checkpoint: 0x37c07a, finish: 0xe8432f },
    accent: 0x37c07a,
    arena: { structure: 0xb59a7e, roof: 0xece2d4, seats: [0xc8643a, 0xb5562f, 0x1f8a8a, 0xc8643a], snow: false, accent: 0x37c07a },
    scenery: 'canyon',
  },
  coast: {
    id: 'coast',
    label: 'Sunset Stadium',
    sky: { zenith: 0x34477e, horizon: 0xffa65c, nadir: 0x6a5060, sunColor: 0xffc27a, sunDir: [0.75, 0.1, -0.5], sunSize: 0.9, sunGlow: 0.7, clouds: 0.5, cloudColor: 0xffb486 },
    fog: { color: 0xe3a77e, near: 200, far: 1400 },
    light: { hemiSky: 0xffc8a4, hemiGround: 0x4a4048, hemi: 0.8, sun: 2.6, sunColor: 0xffb878, exposure: 1.02, env: 0.95 },
    ground: { kind: 'grass', a: 0x3f6e36, b: 0x4d7c40 },
    road: { tint: 0xf4ecf0, line: 0xffffff, kerbA: 0x3d7eff, kerbB: 0xf4f4f6 },
    wall: { base: 0x262a33, band: 0xf2f4f6 },
    gate: { start: 0xffc21f, checkpoint: 0x3d7eff, finish: 0xe8432f },
    accent: 0x3d9bff,
    arena: { structure: 0x8a8f9a, roof: 0x2a2f3a, seats: SEATS, snow: false, accent: 0x3d9bff },
    scenery: 'sunset',
  },
};

/** Older level files used free-form theme names; map them onto the four seasons (+ the dev stadium). */
const ALIASES: Record<string, ThemeId> = { grey: 'stadium', rally: 'coast', city: 'neon', metro: 'neon', summer: 'neon', snow: 'alpine', winter: 'alpine', canyon: 'desert', industry: 'coast', sunset: 'coast' };

export function themeFor(id: string | undefined): ThemeDef {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[(id && ALIASES[id]) || 'stadium'];
}
