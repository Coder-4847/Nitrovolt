/** Everything that gives a season its look. Pure data: shaders, scenery and materials read from it. */
// 'neon' is the historical id of the city season; level files and share codes still carry it.
export type ThemeId = 'stadium' | 'neon' | 'alpine' | 'desert' | 'coast';
export type GroundKind = 'grass' | 'urban' | 'snow' | 'sand' | 'water';
export type SceneryKit = 'stadium' | 'city' | 'alpine' | 'desert' | 'coast';

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
    /** Multiplies every surface's albedo (desert roads warmer, snow roads paler). */
    tint: number;
    line: number;
    kerbA: number;
    kerbB: number;
  };
  /** Barriers: base colour and the painted band along their top. */
  wall: { base: number; band: number };
  gate: { checkpoint: number; finish: number };
  scenery: SceneryKit;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  stadium: {
    id: 'stadium',
    label: 'Stadium',
    sky: { zenith: 0x3f78c8, horizon: 0xcadcee, nadir: 0x9fb0bf, sunColor: 0xfff6e8, sunDir: [0.4, 0.75, 0.3], sunSize: 0.5, sunGlow: 0.2, clouds: 0.35, cloudColor: 0xffffff },
    fog: { color: 0xc6d4e1, near: 180, far: 1400 },
    light: { hemiSky: 0xcfe0ff, hemiGround: 0x5a6b4a, hemi: 0.8, sun: 2.8, sunColor: 0xfff4e6, exposure: 1.0, env: 0.8 },
    ground: { kind: 'grass', a: 0x4c7838, b: 0x5d8a43 },
    road: { tint: 0xffffff, line: 0xf2f2f2, kerbA: 0xd23a32, kerbB: 0xf0f0f0 },
    wall: { base: 0xe9ebee, band: 0x2a6fdb },
    gate: { checkpoint: 0x2a6fdb, finish: 0xe23b2e },
    scenery: 'stadium',
  },
  neon: {
    id: 'neon',
    label: 'Metro',
    sky: { zenith: 0x4a7fc0, horizon: 0xdde3e7, nadir: 0xa9b0b5, sunColor: 0xfff0dc, sunDir: [-0.45, 0.5, -0.55], sunSize: 0.55, sunGlow: 0.25, clouds: 0.3, cloudColor: 0xf8f8fa },
    fog: { color: 0xcad1d7, near: 170, far: 1300 },
    light: { hemiSky: 0xd6e2f2, hemiGround: 0x6c6a66, hemi: 0.85, sun: 2.6, sunColor: 0xffefd8, exposure: 1.0, env: 0.9 },
    ground: { kind: 'urban', a: 0x9a9ea3, b: 0x45494e },
    road: { tint: 0xeceef2, line: 0xffffff, kerbA: 0x3b74d9, kerbB: 0xf2f2f2 },
    wall: { base: 0xd9dcdf, band: 0x3b74d9 },
    gate: { checkpoint: 0x3b74d9, finish: 0xe8432f },
    scenery: 'city',
  },
  alpine: {
    id: 'alpine',
    label: 'Alpine',
    sky: { zenith: 0x3a73c6, horizon: 0xe3ecf5, nadir: 0xd0dae4, sunColor: 0xffffff, sunDir: [0.3, 0.5, 0.6], sunSize: 0.5, sunGlow: 0.3, clouds: 0.45, cloudColor: 0xffffff },
    fog: { color: 0xdbe4ee, near: 140, far: 1100 },
    light: { hemiSky: 0xdde9ff, hemiGround: 0xa6b0bc, hemi: 0.85, sun: 2.5, sunColor: 0xfff8f0, exposure: 0.95, env: 0.9 },
    ground: { kind: 'snow', a: 0xeef2f7, b: 0xbfcbd8 },
    road: { tint: 0xf2f4f8, line: 0xffffff, kerbA: 0x2f6bd8, kerbB: 0xf4f4f4 },
    wall: { base: 0xf1f3f5, band: 0xd8372b },
    gate: { checkpoint: 0xd8372b, finish: 0x2f6bd8 },
    scenery: 'alpine',
  },
  desert: {
    id: 'desert',
    label: 'Desert Canyon',
    sky: { zenith: 0x3b6fbf, horizon: 0xf1dcbc, nadir: 0xc9a27a, sunColor: 0xfff0d6, sunDir: [-0.55, 0.42, 0.4], sunSize: 0.6, sunGlow: 0.3, clouds: 0.12, cloudColor: 0xfff6ea },
    fog: { color: 0xe9d3b4, near: 180, far: 1400 },
    light: { hemiSky: 0xffe9cc, hemiGround: 0x8a6440, hemi: 0.75, sun: 3.0, sunColor: 0xffeacc, exposure: 1.0, env: 0.75 },
    ground: { kind: 'sand', a: 0xdcb98a, b: 0xc09468 },
    road: { tint: 0xfff4e6, line: 0xfff6dc, kerbA: 0xe06a1e, kerbB: 0xf4ecdc },
    wall: { base: 0xefe6d6, band: 0xe06a1e },
    gate: { checkpoint: 0xe06a1e, finish: 0x2d8a5a },
    scenery: 'desert',
  },
  coast: {
    id: 'coast',
    label: 'Coast & Harbour',
    sky: { zenith: 0x3b6aa8, horizon: 0xf0d7bf, nadir: 0x5a7587, sunColor: 0xffe2c0, sunDir: [0.6, 0.28, -0.45], sunSize: 0.7, sunGlow: 0.45, clouds: 0.4, cloudColor: 0xfff0e6 },
    fog: { color: 0xd3d6d8, near: 160, far: 1300 },
    light: { hemiSky: 0xd2def0, hemiGround: 0x505860, hemi: 0.8, sun: 2.4, sunColor: 0xffe0bc, exposure: 1.0, env: 0.85 },
    ground: { kind: 'water', a: 0x1d4258, b: 0x5f8aa3 },
    road: { tint: 0xececf0, line: 0xffd23a, kerbA: 0xf0c419, kerbB: 0x2a2e35 },
    wall: { base: 0x3a3f47, band: 0xf0c419 },
    gate: { checkpoint: 0xf0c419, finish: 0xe8432f },
    scenery: 'coast',
  },
};

/** Older level files used free-form theme names; map them onto the four seasons (+ the dev stadium). */
const ALIASES: Record<string, ThemeId> = { grey: 'stadium', rally: 'coast', city: 'neon', metro: 'neon', snow: 'alpine', canyon: 'desert', industry: 'coast' };

export function themeFor(id: string | undefined): ThemeDef {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[(id && ALIASES[id]) || 'stadium'];
}
