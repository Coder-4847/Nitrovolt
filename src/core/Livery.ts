import { CarDef } from '../data/cars';
import { storage } from './Storage';

export interface Livery {
  primary: number;
  accent: number;
}

export const PRIMARY_PRESETS = [0xc8102e, 0xe8641c, 0xf2b705, 0x2e7d4f, 0x1f5fbf, 0x1c2a44, 0xe9ecef, 0x8a9099, 0x3a3f46, 0x15171a];
export const ACCENT_PRESETS = [0x15171a, 0xf2f2f2, 0x8a9099, 0xc8102e, 0xf2b705, 0x1f8fff];

const key = (id: string): string => `nitrovolt.livery.${id}`;

export function loadLivery(def: CarDef): Livery {
  const saved = storage.get<Partial<Livery> | null>(key(def.id), null);
  return { primary: saved?.primary ?? def.livery.primary, accent: saved?.accent ?? def.livery.accent };
}

export function saveLivery(id: string, l: Livery): void {
  storage.set(key(id), l);
}

export const toCss = (c: number): string => '#' + c.toString(16).padStart(6, '0');
export const fromCss = (s: string): number => parseInt(s.replace('#', ''), 16);
