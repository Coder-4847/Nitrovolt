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
    label: 'Volt',
    blurb: 'Stadium: huge downforce, laser steering, long drifts on a quick counter-steer.',
    params: VOLT,
    camera: { distance: 6.4, height: 2.0, speedPull: 1.6, lookAhead: 9, fovBase: 70, fovKick: 30, headingRate: 7, positionRate: 22, shake: 1 },
    particles: { amount: 0.8, size: 0.9, smoke: 1 },
    voice: { base: 38, range: 190, osc1: 'sawtooth', osc2: 'square', osc2Ratio: 0.5, cutoffLo: 380, cutoffHi: 2600, gain: 0.16, gears: 6, vibrato: 0 },
    livery: { primary: 0xc8102e, accent: 0x15171a },
  },
  gravel: {
    id: 'gravel',
    label: 'Gravel',
    blurb: 'Rally: loose-surface specialist. Long travel, big body roll, power slides.',
    params: GRAVEL,
    behavior: gravelBehavior,
    camera: { distance: 5.9, height: 1.8, speedPull: 1.2, lookAhead: 8, fovBase: 72, fovKick: 26, headingRate: 6, positionRate: 16, shake: 1.4 },
    particles: { amount: 1.2, size: 1.1, smoke: 0.8 },
    voice: { base: 30, range: 160, osc1: 'square', osc2: 'sawtooth', osc2Ratio: 0.5, cutoffLo: 300, cutoffHi: 1900, gain: 0.2, gears: 5, vibrato: 0.004 },
    livery: { primary: 0xe8641c, accent: 0xf2f2f2 },
  },
  frost: {
    id: 'frost',
    label: 'Frost',
    blurb: 'Snow: heavy and studded. Low grip, ice-sliding momentum, wide drifts.',
    params: FROST,
    behavior: frostBehavior,
    camera: { distance: 7.4, height: 2.5, speedPull: 1.4, lookAhead: 10, fovBase: 68, fovKick: 24, headingRate: 4.2, positionRate: 12, shake: 1.1 },
    particles: { amount: 1.0, size: 1.0, smoke: 0.7 },
    voice: { base: 23, range: 105, osc1: 'sawtooth', osc2: 'square', osc2Ratio: 0.5, cutoffLo: 220, cutoffHi: 1100, gain: 0.22, gears: 6, vibrato: 0 },
    livery: { primary: 0x1f5fbf, accent: 0xe9ecef },
  },
  dune: {
    id: 'dune',
    label: 'Dune',
    blurb: 'Desert: light, floaty and fast on sand. Spring-launch off crests, wide arcs.',
    params: DUNE,
    behavior: duneBehavior,
    camera: { distance: 6.9, height: 2.5, speedPull: 2.2, lookAhead: 10, fovBase: 74, fovKick: 34, headingRate: 6.5, positionRate: 18, shake: 0.9 },
    particles: { amount: 1.3, size: 1.2, smoke: 0.6 },
    voice: { base: 58, range: 270, osc1: 'sawtooth', osc2: 'sawtooth', osc2Ratio: 1.012, cutoffLo: 700, cutoffHi: 3800, gain: 0.13, gears: 4, vibrato: 0.012 },
    livery: { primary: 0xf2b705, accent: 0x2a2f3a },
  },
};

export const getCar = (id: string | null | undefined): CarDef => CARS[(id as CarId) in CARS ? (id as CarId) : 'volt'];

/** Fresh mutable parameters for a car. */
export const carParams = (id: string | null | undefined): VehicleParams => cloneParams(getCar(id).params);
