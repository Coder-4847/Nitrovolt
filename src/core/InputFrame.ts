/**
 * The single per-physics-tick input struct. This is the ONLY thing the simulation
 * reads from the player, and it is exactly what ghosts/replays record.
 *
 * Values are quantised at creation so a live run and a replay see identical numbers.
 */
export interface InputFrame {
  /** -1 (left) .. +1 (right), multiples of 1/STEER_Q. */
  steer: number;
  /** 0..1, multiples of 1/PEDAL_Q. */
  accel: number;
  /** 0..1, multiples of 1/PEDAL_Q. */
  brake: number;
  /** Respawn at last checkpoint requested this tick. */
  respawn: boolean;
}

export const STEER_Q = 1024;
export const PEDAL_Q = 255;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function makeFrame(steer: number, accel: number, brake: number, respawn = false): InputFrame {
  return {
    steer: Math.round(clamp(steer, -1, 1) * STEER_Q) / STEER_Q,
    accel: Math.round(clamp(accel, 0, 1) * PEDAL_Q) / PEDAL_Q,
    brake: Math.round(clamp(brake, 0, 1) * PEDAL_Q) / PEDAL_Q,
    respawn,
  };
}

export const NEUTRAL_FRAME: Readonly<InputFrame> = Object.freeze(makeFrame(0, 0, 0, false));

export function framesEqual(a: InputFrame, b: InputFrame): boolean {
  return a.steer === b.steer && a.accel === b.accel && a.brake === b.brake && a.respawn === b.respawn;
}
