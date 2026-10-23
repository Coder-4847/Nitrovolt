/** Everything that gives a season its look. Pure data: shaders, scenery and post-processing read from it. */
export type ThemeId = 'stadium' | 'neon' | 'alpine' | 'desert' | 'coast';
export type GroundKind = 'grid' | 'neon' | 'snow' | 'sand' | 'water';
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
    /** Direction toward the sun (or moon at night). */
    sunDir: [number, number, number];
    /** 0..1: sharp disc size; the moon uses a bigger, softer disc. */
    sunSize: number;
    sunGlow: number;
    stars: number;
    moon: boolean;
    clouds: number;
    cloudColor: number;
  };
  fog: { color: number; near: number; far: number };
  light: { hemiSky: number; hemiGround: number; hemi: number; sun: number; sunColor: number; exposure: number; env: number };
  ground: { kind: GroundKind; a: number; b: number };
  road: {
    /** Multiplies every surface's albedo (night roads read darker, desert roads warmer). */
    tint: number;
    line: number;
    kerbA: number;
    kerbB: number;
    /** Glowing tech-panel seams / edge lines (night themes). */
    glow: number;
    glowColor: number;
  };
  wall: { a: number; b: number; glow: number };
  gate: { checkpoint: number; finish: number };
  scenery: SceneryKit;
  bloom: { strength: number; radius: number; threshold: number };
  /** Headlight beams and stronger car lights. */
  night: boolean;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  stadium: {
    id: 'stadium',
    label: 'Stadium',
    sky: { zenith: 0x2f5fb0, horizon: 0xffc9a0, nadir: 0x8a6a58, sunColor: 0xfff0d8, sunDir: [0.45, 0.6, 0.35], sunSize: 0.6, sunGlow: 0.28, stars: 0, moon: false, clouds: 0.35, cloudColor: 0xfff4ea },
    fog: { color: 0xe6c9ae, near: 140, far: 1200 },
    light: { hemiSky: 0xbcd4ff, hemiGround: 0x6a5440, hemi: 0.95, sun: 2.6, sunColor: 0xfff0d8, exposure: 1.05, env: 0.7 },
    ground: { kind: 'grid', a: 0x283044, b: 0x5d6f92 },
    road: { tint: 0xffffff, line: 0xf4f4f4, kerbA: 0xe0323a, kerbB: 0xf2f2f2, glow: 0, glowColor: 0x18e0ff },
    wall: { a: 0xf2f2f2, b: 0xe0323a, glow: 0 },
    gate: { checkpoint: 0x18e0ff, finish: 0x3dff8a },
    scenery: 'stadium',
    bloom: { strength: 0.35, radius: 0.5, threshold: 0.9 },
    night: false,
  },
  neon: {
    id: 'neon',
    label: 'Neon City Night',
    sky: { zenith: 0x05061a, horizon: 0x3a1a5c, nadir: 0x0a0618, sunColor: 0xd8e6ff, sunDir: [-0.35, 0.42, -0.55], sunSize: 1.6, sunGlow: 0.18, stars: 1, moon: true, clouds: 0.25, cloudColor: 0x3a2a60 },
    fog: { color: 0x1b1036, near: 90, far: 900 },
    light: { hemiSky: 0x7a7cff, hemiGround: 0x3a1840, hemi: 1.0, sun: 1.1, sunColor: 0xa8b8ff, exposure: 1.1, env: 1.0 },
    ground: { kind: 'neon', a: 0x07081a, b: 0xff2fbf },
    road: { tint: 0x8a90a8, line: 0x18e0ff, kerbA: 0xff2fbf, kerbB: 0x1a1a2e, glow: 1, glowColor: 0x18e0ff },
    wall: { a: 0x1a1d33, b: 0xff2fbf, glow: 1 },
    gate: { checkpoint: 0x18e0ff, finish: 0xff2fbf },
    scenery: 'city',
    bloom: { strength: 0.75, radius: 0.5, threshold: 0.74 },
    night: true,
  },
  alpine: {
    id: 'alpine',
    label: 'Alpine Snow',
    sky: { zenith: 0x3d74c8, horizon: 0xdbe8f5, nadir: 0xc8d4e0, sunColor: 0xffffff, sunDir: [0.3, 0.45, 0.6], sunSize: 0.5, sunGlow: 0.35, stars: 0, moon: false, clouds: 0.55, cloudColor: 0xffffff },
    fog: { color: 0xd8e4f0, near: 120, far: 1000 },
    light: { hemiSky: 0xd8e8ff, hemiGround: 0x9aa6b8, hemi: 1.05, sun: 2.4, sunColor: 0xfff6ec, exposure: 0.95, env: 0.9 },
    ground: { kind: 'snow', a: 0xe8eef6, b: 0xa9bed6 },
    road: { tint: 0xf2f4f8, line: 0xffffff, kerbA: 0x2f6bff, kerbB: 0xf4f4f4, glow: 0, glowColor: 0x8fe8ff },
    wall: { a: 0xf4f4f4, b: 0x2f6bff, glow: 0 },
    gate: { checkpoint: 0x2f9bff, finish: 0xff3b2f },
    scenery: 'alpine',
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.92 },
    night: false,
  },
  desert: {
    id: 'desert',
    label: 'Desert Canyon',
    sky: { zenith: 0x2a62b8, horizon: 0xffd29a, nadir: 0xb07a4a, sunColor: 0xffe6b8, sunDir: [-0.55, 0.32, 0.4], sunSize: 0.7, sunGlow: 0.45, stars: 0, moon: false, clouds: 0.12, cloudColor: 0xfff0dc },
    fog: { color: 0xf0c896, near: 160, far: 1250 },
    light: { hemiSky: 0xffe0b8, hemiGround: 0x8a5a34, hemi: 0.9, sun: 3.0, sunColor: 0xffe2b0, exposure: 1.0, env: 0.75 },
    ground: { kind: 'sand', a: 0xe0b77c, b: 0xb88452 },
    road: { tint: 0xfff0dc, line: 0xfff2c8, kerbA: 0xff7a1a, kerbB: 0xf4ecdc, glow: 0, glowColor: 0xffaa40 },
    wall: { a: 0xf4ecdc, b: 0xff7a1a, glow: 0 },
    gate: { checkpoint: 0xff9a1f, finish: 0x3dff8a },
    scenery: 'desert',
    bloom: { strength: 0.32, radius: 0.5, threshold: 0.9 },
    night: false,
  },
  coast: {
    id: 'coast',
    label: 'Coast & Industry',
    sky: { zenith: 0x24508c, horizon: 0xffb48a, nadir: 0x3a5a70, sunColor: 0xffc890, sunDir: [0.62, 0.16, -0.45], sunSize: 0.9, sunGlow: 0.6, stars: 0, moon: false, clouds: 0.5, cloudColor: 0xffc8b0 },
    fog: { color: 0xd6a48c, near: 130, far: 1100 },
    light: { hemiSky: 0xc8d8ff, hemiGround: 0x4a4a50, hemi: 0.9, sun: 2.2, sunColor: 0xffc08a, exposure: 1.05, env: 0.85 },
    ground: { kind: 'water', a: 0x0a2438, b: 0x4a7a98 },
    road: { tint: 0xe8e8ec, line: 0xffd21f, kerbA: 0xffd21f, kerbB: 0x22262e, glow: 0, glowColor: 0xffd21f },
    wall: { a: 0x22262e, b: 0xffd21f, glow: 0 },
    gate: { checkpoint: 0xffd21f, finish: 0x3dff8a },
    scenery: 'coast',
    bloom: { strength: 0.42, radius: 0.55, threshold: 0.85 },
    night: false,
  },
};

/** Older level files used free-form theme names; map them onto the four seasons (+ the dev stadium). */
const ALIASES: Record<string, ThemeId> = { grey: 'stadium', rally: 'coast', city: 'neon', snow: 'alpine', canyon: 'desert', industry: 'coast' };

export function themeFor(id: string | undefined): ThemeDef {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[(id && ALIASES[id]) || 'stadium'];
}
