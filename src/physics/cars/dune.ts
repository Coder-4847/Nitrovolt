import { deriveCar } from './derive';

/**
 * Dune (desert): light, floaty and fast on sand and dirt, with a spring-launch off crests and wide arcs
 * through corners. Effective friction: sand ~1.8, dirt ~1.5, tarmac ~1.4.
 */
export const DUNE = deriveCar('Dune', {
  mass: 860,
  inertiaScale: 1.15,
  boxHalf: [0.95, 0.3, 1.95],
  wheelRadius: 0.42,
  halfTrackFront: 0.98,
  halfTrackRear: 1.02,
  frontAxleZ: -1.3,
  rearAxleZ: 1.2,
  mountY: 0.22,

  springLenMax: 0.7,
  springLenMin: 0.22,
  springK: 28000,
  springProgressive: 110000,
  dampBump: 2600,
  dampRebound: 2100,
  arbFront: 6000,
  arbRear: 5000,
  bumpStopK: 240000,
  forceApplyY: -0.2,

  gripFront: 1.7,
  gripRear: 1.65,
  nominalLoad: 4000,
  loadSensitivity: 0.14,
  peakSlipAngle: 0.24,
  slideRatio: 0.94,
  slideRange: 3.2,
  brakeRearSlide: 0.4,
  ellipseExp: 2.6,
  surfaceGrip: { tarmac: 0.84, dirt: 1.18, grass: 1.15, sand: 1.75, snow: 1.15, ice: 1.0, wood: 0.86 },
  surfaceRolling: { sand: 0.25, dirt: 0.6, grass: 0.6, snow: 0.7 },

  steerMax: 0.55,
  steerMin: 0.13,
  steerRefSpeed: 30,
  steerRate: 5.2,
  counterSteerAssist: 0.5,

  driveRearBias: 0.62,
  maxDriveForce: 9800,
  maxPower: 470000,
  brakeForce: 19000,
  brakeFrontBias: 0.58,
  engineBrake: 700,
  topSpeed: 84,

  dragCoef: 0.42,
  downforceCoef: 0.8,
  aeroFrontBalance: 0.42,

  airPitchRate: 2.8,
  airPitchOffset: 0.6,
  airYawRate: 2.4,
  airRollRate: 3.2,
  airRollOffset: 0.6,
  airControlAccel: 18,
  airLevelAssist: 0.8,
  airGravityScale: 0.86,
  groundAlign: 42,
});
