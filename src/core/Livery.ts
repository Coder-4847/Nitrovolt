import { CarDef } from '../data/cars';
import { storage } from './Storage';

export interface Livery {
  primary: number;
  accent: number;
}

export const PRIMARY_PRESETS = [0xff3b2f, 0xff7a1a, 0xffc83a, 0x3ddc84, 0x18c9c9, 0x2f7fff, 0x8a5cff, 0xff4fa3, 0xf2f2f2, 0x22262e];
export const ACCENT_PRESETS = [0x18e0ff, 0xffffff, 0xffd21f, 0x39ff88, 0xff3bd1, 0xff6a1a];

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
