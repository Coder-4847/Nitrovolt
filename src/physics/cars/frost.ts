import { deriveCar } from './derive';

/**
 * Frost (snow): heavy, studded, low grip that bites better than it should.
 * Effective friction: tarmac ~1.2, snow ~0.95, ice ~0.38 (studs), dirt ~1.0.
 */
export const FROST = deriveCar('Frost', {
  mass: 1550,
  inertiaScale: 1.7,
  boxHalf: [0.98, 0.4, 2.1],
  wheelRadius: 0.37,
  halfTrackFront: 0.96,
  halfTrackRear: 0.98,
  frontAxleZ: -1.4,
  rearAxleZ: 1.35,
  mountY: 0.16,

  springLenMax: 0.5,
  springLenMin: 0.16,
  springK: 62000,
  springProgressive: 240000,
  dampBump: 5200,
  dampRebound: 7200,
  arbFront: 24000,
  arbRear: 22000,
  bumpStopK: 420000,
  forceApplyY: -0.18,

  gripFront: 1.68,
  gripRear: 1.63,
  nominalLoad: 7400,
  loadSensitivity: 0.12,
  peakSlipAngle: 0.22,
  slideRatio: 0.84,
  slideRange: 2.2,
  brakeRearSlide: 0.06,
  yawStability: 0.4,
  ellipseExp: 2.6,
  surfaceGrip: { tarmac: 0.82, dirt: 0.95, grass: 1.0, sand: 0.95, snow: 1.55, ice: 2.15, wood: 0.85 },
  surfaceRolling: { snow: 0.75, sand: 1.1 },

  steerMax: 0.52,
  steerMin: 0.1,
  steerRefSpeed: 24,
  steerRate: 3.6,
  counterSteerAssist: 0.55,

  driveRearBias: 0.5,
  maxDriveForce: 14500,
  maxPower: 520000,
  brakeForce: 27000,
  brakeFrontBias: 0.62,
  engineBrake: 1500,
  topSpeed: 74,

  dragCoef: 0.78,
  downforceCoef: 1.5,
  aeroFrontBalance: 0.45,

  airPitchRate: 1.6,
  airPitchOffset: 0.3,
  airYawRate: 1.4,
  airRollRate: 1.8,
  airRollOffset: 0.35,
  airControlAccel: 7.5,
  airLevelAssist: 1.1,
  groundAlign: 40,
});
