import { deriveCar } from './derive';

/**
 * Gravel (rally): loose-surface specialist. Long soft suspension, big body roll, AWD, sideways on purpose.
 * Effective friction (gripFront x surface base x car multiplier): tarmac ~1.4, dirt ~1.5, grass ~1.0, sand ~1.0.
 */
export const GRAVEL = deriveCar('Gravel', {
  mass: 1250,
  inertiaScale: 1.5,
  boxHalf: [0.92, 0.36, 2.0],
  wheelRadius: 0.38,
  halfTrackFront: 0.92,
  halfTrackRear: 0.94,
  frontAxleZ: -1.3,
  rearAxleZ: 1.25,
  mountY: 0.2,

  springLenMax: 0.66,
  springLenMin: 0.2,
  springK: 36000,
  springProgressive: 140000,
  dampBump: 3300,
  dampRebound: 4800,
  arbFront: 7000,
  arbRear: 5000,
  bumpStopK: 300000,
  forceApplyY: -0.3,

  gripFront: 1.78,
  gripRear: 1.74,
  nominalLoad: 5800,
  loadSensitivity: 0.1,
  peakSlipAngle: 0.2,
  slideRatio: 0.92,
  slideRange: 3.0,
  brakeRearSlide: 0.1,
  yawStability: 0.25,
  ellipseExp: 2.4,
  surfaceGrip: { tarmac: 0.88, dirt: 1.52, grass: 1.42, sand: 1.2, snow: 1.25, ice: 1.1, wood: 0.9 },
  surfaceRolling: { dirt: 0.8, grass: 0.9, sand: 0.9 },

  steerMax: 0.6,
  steerMin: 0.12,
  steerRefSpeed: 22,
  steerRate: 6.5,
  counterSteerAssist: 0.8,

  driveRearBias: 0.5,
  maxDriveForce: 14800,
  maxPower: 560000,
  brakeForce: 24000,
  brakeFrontBias: 0.6,
  engineBrake: 1100,
  topSpeed: 72,

  dragCoef: 0.55,
  downforceCoef: 1.1,
  aeroFrontBalance: 0.4,

  airPitchRate: 1.8,
  airPitchOffset: 0.34,
  airYawRate: 1.7,
  airRollRate: 2.2,
  airRollOffset: 0.4,
  airControlAccel: 9,
  airLevelAssist: 1.0,
  airGravityScale: 1,
  groundAlign: 38,
});
