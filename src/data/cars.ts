import { EngineVoice } from '../audio/AudioEngine';
import { CarBehavior, duneBehavior, frostBehavior, gravelBehavior } from '../physics/CarBehavior';
import { DUNE } from '../physics/cars/dune';
import { FROST } from '../physics/cars/frost';
import { GRAVEL } from '../physics/cars/gravel';
import { VOLT, VehicleParams, cloneParams } from '../physics/VehicleParams';

export type CarId = 'volt' | 'gravel' | 'frost' | 'dune';
export const CAR_IDS: CarId[] = ['volt', 'gravel', 'frost', 'dune'];

export interface CameraStyle {
  /** Chase distance and height (m) at rest. */
  distance: number;
  height: number;
  /** Extra pull-back at top speed (m). */
  speedPull: number;
  lookAhead: number;
  fovBase: number;
  fovKick: number;
  /** Heading / position smoothing rates (1/s); lower = lazier, heavier camera. */
  headingRate: number;
  positionRate: number;
  /** Multiplier on landing / impact shake. */
  shake: number;
}

export interface ParticleStyle {
  /** Multipliers on emission amount and puff size for loose-surface dust / spray. */
  amount: number;
  size: number;
  /** Tyre smoke on hard surfaces when sliding. */
  smoke: number;
}

export interface CarDef {
  id: CarId;
  label: string;
  blurb: string;
  /** Pristine parameters; the game clones them (the tuning panel edits the clone). */
  params: VehicleParams;
  behavior?: CarBehavior;
  camera: CameraStyle;
  particles: ParticleStyle;
  voice: EngineVoice;
  livery: { primary: number; accent: number };
}

export const CARS: Readonly<Record<CarId, CarDef>> = {
  volt: {
    id: 'volt',
    label: 'Stadium',
    blurb: 'Stadium: the open-wheel racer. Huge grip and downforce, made for tarmac, walls and loops.',
    params: VOLT,
    camera: { distance: 5.9, height: 1.95, speedPull: 1.3, lookAhead: 14, fovBase: 70, fovKick: 14, headingRate: 7, positionRate: 20, shake: 0.7 },
    particles: { amount: 0.8, size: 0.9, smoke: 1 },
    voice: { base: 38, range: 190, osc1: 'sawtooth', osc2: 'square', osc2Ratio: 0.5, cutoffLo: 380, cutoffHi: 2600, gain: 0.16, gears: 6, vibrato: 0 },
    livery: { primary: 0xd31f2d, accent: 0xf2f4f6 },
  },
  gravel: {
    id: 'gravel',
    label: 'Rally',
    blurb: 'Rally: a boxy rally hatch built for dirt. Long travel, big body roll, power slides.',
    params: GRAVEL,
    behavior: gravelBehavior,
    camera: { distance: 6.3, height: 2.25, speedPull: 1.1, lookAhead: 13, fovBase: 70, fovKick: 12, headingRate: 6, positionRate: 16, shake: 0.9 },
    particles: { amount: 1.2, size: 1.1, smoke: 0.8 },
    voice: { base: 30, range: 160, osc1: 'square', osc2: 'sawtooth', osc2Ratio: 0.5, cutoffLo: 300, cutoffHi: 1900, gain: 0.2, gears: 5, vibrato: 0.004 },
    livery: { primary: 0xe8641c, accent: 0xf2f2f2 },
  },
  frost: {
    id: 'frost',
    label: 'Snow',
    blurb: 'Snow: a stubby pickup on studded tyres. Heavy, sure-footed on snow, gliding on ice.',
    params: FROST,
    behavior: frostBehavior,
    camera: { distance: 6.4, height: 2.35, speedPull: 1.1, lookAhead: 13, fovBase: 70, fovKick: 12, headingRate: 5, positionRate: 14, shake: 0.8 },
    particles: { amount: 1.0, size: 1.0, smoke: 0.7 },
    voice: { base: 23, range: 105, osc1: 'sawtooth', osc2: 'square', osc2Ratio: 0.5, cutoffLo: 220, cutoffHi: 1100, gain: 0.22, gears: 6, vibrato: 0 },
    livery: { primary: 0xc81e2a, accent: 0x1a1c20 },
  },
  dune: {
    id: 'dune',
    label: 'Desert',
    blurb: 'Desert: a lifted muscle coupe. Light, floaty and fast on sand, flies off every crest.',
    params: DUNE,
    behavior: duneBehavior,
    camera: { distance: 6.6, height: 2.4, speedPull: 1.4, lookAhead: 14, fovBase: 70, fovKick: 14, headingRate: 6.5, positionRate: 18, shake: 0.7 },
    particles: { amount: 1.3, size: 1.2, smoke: 0.6 },
    voice: { base: 58, range: 270, osc1: 'sawtooth', osc2: 'sawtooth', osc2Ratio: 1.012, cutoffLo: 700, cutoffHi: 3800, gain: 0.13, gears: 4, vibrato: 0.012 },
    livery: { primary: 0xf2b705, accent: 0x2a2f3a },
  },
};

export const getCar = (id: string | null | undefined): CarDef => CARS[(id as CarId) in CARS ? (id as CarId) : 'volt'];

/** Fresh mutable parameters for a car. */
export const carParams = (id: string | null | undefined): VehicleParams => cloneParams(getCar(id).params);
