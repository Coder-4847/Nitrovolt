import { SURFACE_IDS, SurfaceId } from './Surface';

/**
 * Everything that defines how a car drives. One shared physics core, many parameter sets.
 * Local car frame: +X right, +Y up, -Z forward. Origin = centre of mass.
 */
export interface VehicleParams {
  name: string;

  // --- body ---
  mass: number; // kg
  /** Multiplies the box-derived principal inertia; >1 = lazier rotation. */
  inertiaScale: number;
  /** Chassis collision box half extents (m) and its centre offset from the COM. */
  boxHalf: [number, number, number];
  boxCenterY: number;

  // --- wheels / suspension geometry ---
  wheelRadius: number;
  halfTrackFront: number;
  halfTrackRear: number;
  /** Z of the axles relative to COM (front is negative). */
  frontAxleZ: number;
  rearAxleZ: number;
  /** Local Y of the suspension mount (top of the spring). */
  mountY: number;

  // --- suspension ---
  springLenMax: number; // full droop (m, mount -> wheel centre)
  springLenMin: number; // full bump (bump stop engages below this)
  springK: number; // N/m
  /** Extra progressive stiffness, N/m^3 * compression^2. */
  springProgressive: number;
  dampBump: number; // N*s/m on compression
  dampRebound: number; // N*s/m on extension
  arbFront: number; // anti-roll bar N/m
  arbRear: number;
  bumpStopK: number; // N/m
  /** Local Y where tyre forces act on the body. Higher = less pitch/roll weight transfer. */
  forceApplyY: number;

  // --- tyres ---
  gripFront: number; // peak friction coefficient on tarmac
  gripRear: number;
  /** Nominal wheel load for the load-sensitivity curve (N). */
  nominalLoad: number;
  /** 0 = grip scales linearly with load, 0.2 = diminishing returns. */
  loadSensitivity: number;
  /** Slip angle (rad) of peak lateral force. */
  peakSlipAngle: number;
  /** Fraction of peak lateral force retained deep in a slide. */
  slideRatio: number;
  /** How far past the peak (in peak-angle multiples) the grip falls to slideRatio. */
  slideRange: number;
  /** Fraction of rear lateral grip lost at full brake (brake-drift initiation). */
  brakeRearSlide: number;
  /**
   * Anti-lock limit: a wheel brakes with at most this fraction of its longitudinal grip, so some cornering
   * grip always remains and a brake tap mid-corner tightens the line instead of spinning the car.
   */
  brakeGripUse: number;
  /** Yaw-stability assist (0 off): damps yaw rate beyond what the steering asks for while sliding. */
  yawStability: number;
  /** Longitudinal friction coefficient relative to lateral. */
  longGripScale: number;
  /** Friction-envelope exponent: 2 = ellipse (drive/brake steals lateral grip quickly), higher = more forgiving. */
  ellipseExp: number;
  /** Per-surface multiplier on top of Surface base grip. */
  surfaceGrip: Record<SurfaceId, number>;
  /** Per-surface multiplier on rolling resistance (a buggy floats over sand, a truck ploughs). */
  surfaceRolling: Record<SurfaceId, number>;

  // --- steering ---
  steerMax: number; // rad at standstill
  steerMin: number; // rad at very high speed
  steerRefSpeed: number; // m/s at which the limit has dropped about half way
  steerRate: number; // rad/s wheel slew
  /** Counter-steer assist while sliding (0 off, 1 = wheels fully follow velocity). */
  counterSteerAssist: number;

  // --- drivetrain ---
  /** Fraction of drive force sent to the rear axle (1 = RWD, 0 = FWD, 0.5 = AWD split). */
  driveRearBias: number;
  maxDriveForce: number; // N at the wheels, launch
  maxPower: number; // W
  reverseForceScale: number;
  maxReverseSpeed: number; // m/s
  brakeForce: number; // N total
  brakeFrontBias: number; // 0..1
  engineBrake: number; // N
  /** Speed (m/s) where a soft limiter starts cutting drive. */
  topSpeed: number;

  // --- aero ---
  dragCoef: number; // N per (m/s)^2
  downforceCoef: number; // N per (m/s)^2
  /** Fraction of downforce acting at the front axle. */
  aeroFrontBalance: number;

  // --- air control ---
  airPitchRate: number; // rad/s target (free rotation when level-assist is off or speed is low)
  /** Max nose offset (rad) from the flight path the pitch keys can command with level-assist on. */
  airPitchOffset: number;
  airYawRate: number;
  airRollRate: number;
  /** Max bank angle (rad) steering commands in the air with level-assist on. */
  airRollOffset: number;
  /** Max angular acceleration (rad/s^2) the "thrusters" can apply. */
  airControlAccel: number;
  /** Gravity multiplier while all wheels are off the ground (<1 = floaty arcs). */
  airGravityScale: number;
  /** Stick-to-surface torque (rad/s^2 per rad) that levels the chassis to the contact normal while 1-3 wheels touch. */
  groundAlign: number;
  /** Passive angular-velocity damping per second when airborne and not steering. */
  airDamping: number;
  /** Nose tracks the flight path when pitch is untouched (crisp landings). */
  airLevelAssist: number;
}

export const allSurfaces = (v: number, overrides: Partial<Record<SurfaceId, number>> = {}): Record<SurfaceId, number> => {
  const o = {} as Record<SurfaceId, number>;
  for (const id of SURFACE_IDS) o[id] = overrides[id] ?? v;
  return o;
};

/** Volt: the benchmark stadium car. Huge downforce, laser steering, slidey on a quick counter-steer. */
export const VOLT: VehicleParams = {
  name: 'Volt',

  mass: 1100,
  inertiaScale: 1.35,
  boxHalf: [0.92, 0.28, 2.05],
  boxCenterY: 0.0,

  wheelRadius: 0.34,
  halfTrackFront: 0.9,
  halfTrackRear: 0.92,
  frontAxleZ: -1.35,
  rearAxleZ: 1.3,
  mountY: 0.12,

  springLenMax: 0.44,
  springLenMin: 0.14,
  springK: 62000,
  springProgressive: 260000,
  dampBump: 4300,
  dampRebound: 6200,
  arbFront: 26000,
  arbRear: 20000,
  bumpStopK: 420000,
  forceApplyY: -0.12,

  gripFront: 2.45,
  gripRear: 2.4,
  nominalLoad: 5400,
  loadSensitivity: 0.12,
  peakSlipAngle: 0.16,
  slideRatio: 0.95,
  slideRange: 2.5,
  brakeRearSlide: 0.04,
  brakeGripUse: 0.7,
  yawStability: 0.6,
  longGripScale: 1.0,
  ellipseExp: 3.0,
  // a stadium car: laser on tarmac, noticeably out of its depth on loose ground
  surfaceGrip: allSurfaces(1.0, { dirt: 0.7, grass: 0.7, sand: 0.72, snow: 0.8 }),
  surfaceRolling: allSurfaces(1.0),

  steerMax: 0.5,
  steerMin: 0.075,
  steerRefSpeed: 26,
  steerRate: 5.5,
  counterSteerAssist: 0.5,

  driveRearBias: 0.7,
  maxDriveForce: 12500,
  maxPower: 600000,
  reverseForceScale: 0.5,
  maxReverseSpeed: 16,
  brakeForce: 30000,
  brakeFrontBias: 0.62,
  engineBrake: 900,
  topSpeed: 88,

  dragCoef: 0.6,
  downforceCoef: 3.6,
  aeroFrontBalance: 0.46,

  airPitchRate: 2.4,
  airPitchOffset: 0.4,
  airYawRate: 2.0,
  airRollRate: 3.0,
  airRollOffset: 0.5,
  airControlAccel: 14,
  airDamping: 0.6,
  airGravityScale: 1,
  groundAlign: 45,
  airLevelAssist: 1.4,
};

/** Dev panel: every car's own numbers. */
export function cloneParams(p: VehicleParams): VehicleParams {
  return JSON.parse(JSON.stringify(p)) as VehicleParams;
}

/** Slider descriptors for the dev tuning panel. `path` is dot-separated into VehicleParams. */
export interface ParamDescriptor {
  group: string;
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

const d = (group: string, path: string, label: string, min: number, max: number, step: number): ParamDescriptor => ({
  group,
  path,
  label,
  min,
  max,
  step,
});

export const PARAM_DESCRIPTORS: ParamDescriptor[] = [
  d('Body', 'mass', 'mass kg', 500, 2500, 10),
  d('Body', 'inertiaScale', 'inertia scale', 0.5, 3, 0.05),
  d('Body', 'mountY', 'mount Y', -0.2, 0.4, 0.01),
  d('Suspension', 'springLenMax', 'droop len', 0.25, 0.8, 0.01),
  d('Suspension', 'springLenMin', 'bump len', 0.05, 0.4, 0.01),
  d('Suspension', 'springK', 'spring K', 10000, 200000, 1000),
  d('Suspension', 'springProgressive', 'progressive', 0, 1000000, 10000),
  d('Suspension', 'dampBump', 'damp bump', 500, 15000, 100),
  d('Suspension', 'dampRebound', 'damp rebound', 500, 20000, 100),
  d('Suspension', 'arbFront', 'ARB front', 0, 100000, 1000),
  d('Suspension', 'arbRear', 'ARB rear', 0, 100000, 1000),
  d('Suspension', 'forceApplyY', 'force height', -0.6, 0.4, 0.01),
  d('Tyres', 'gripFront', 'grip front', 0.2, 4, 0.05),
  d('Tyres', 'gripRear', 'grip rear', 0.2, 4, 0.05),
  d('Tyres', 'loadSensitivity', 'load sens', 0, 0.5, 0.01),
  d('Tyres', 'peakSlipAngle', 'peak slip', 0.04, 0.5, 0.005),
  d('Tyres', 'slideRatio', 'slide ratio', 0.3, 1, 0.01),
  d('Tyres', 'slideRange', 'slide range', 0.2, 5, 0.1),
  d('Tyres', 'ellipseExp', 'ellipse exp', 1.5, 6, 0.1),
  d('Tyres', 'brakeRearSlide', 'brake rear slide', 0, 0.9, 0.01),
  d('Tyres', 'brakeGripUse', 'ABS grip use', 0.3, 1, 0.01),
  d('Steering', 'yawStability', 'yaw stability', 0, 2, 0.05),
  d('Steering', 'steerMax', 'lock low spd', 0.2, 0.9, 0.01),
  d('Steering', 'steerMin', 'lock high spd', 0.02, 0.4, 0.005),
  d('Steering', 'steerRefSpeed', 'ref speed', 5, 80, 1),
  d('Steering', 'steerRate', 'slew rate', 1, 20, 0.1),
  d('Steering', 'counterSteerAssist', 'countersteer', 0, 1.2, 0.05),
  d('Drivetrain', 'driveRearBias', 'rear bias', 0, 1, 0.05),
  d('Drivetrain', 'maxDriveForce', 'max force', 3000, 40000, 250),
  d('Drivetrain', 'maxPower', 'power W', 100000, 2000000, 10000),
  d('Drivetrain', 'brakeForce', 'brake force', 5000, 60000, 500),
  d('Drivetrain', 'brakeFrontBias', 'brake front', 0.2, 0.9, 0.01),
  d('Drivetrain', 'topSpeed', 'top speed', 40, 200, 1),
  d('Aero', 'dragCoef', 'drag', 0, 2, 0.01),
  d('Aero', 'downforceCoef', 'downforce', 0, 12, 0.1),
  d('Aero', 'aeroFrontBalance', 'aero front', 0, 1, 0.01),
  d('Air', 'airPitchRate', 'pitch rate', 0, 8, 0.1),
  d('Air', 'airPitchOffset', 'pitch offset', 0, 1.2, 0.02),
  d('Air', 'airYawRate', 'yaw rate', 0, 8, 0.1),
  d('Air', 'airRollRate', 'roll rate', 0, 8, 0.1),
  d('Air', 'airRollOffset', 'roll offset', 0, 1.2, 0.02),
  d('Air', 'airControlAccel', 'ctrl accel', 1, 60, 0.5),
  d('Air', 'airDamping', 'damping', 0, 5, 0.05),
  d('Air', 'groundAlign', 'ground align', 0, 150, 1),
  d('Air', 'airGravityScale', 'air gravity', 0.3, 1.2, 0.01),
  ...(['tarmac', 'dirt', 'grass', 'ice', 'snow', 'sand'] as const).map((s) => d('Surface grip x', `surfaceGrip.${s}`, s, 0.2, 3, 0.02)),
  d('Air', 'airLevelAssist', 'level assist', 0, 5, 0.05),
];

export function getParam(p: VehicleParams, path: string): number {
  let o: unknown = p;
  for (const k of path.split('.')) o = (o as Record<string, unknown>)[k];
  return o as number;
}

export function setParam(p: VehicleParams, path: string, value: number): void {
  const keys = path.split('.');
  let o = p as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]!] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = value;
}
