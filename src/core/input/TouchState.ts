/** Shared between the on-screen touch UI (writer) and the InputManager (reader). */
export interface TouchState {
  left: boolean;
  right: boolean;
  gas: boolean;
  brake: boolean;
  /** Analog steer from device tilt in [-1, 1], or null when tilt steering is off. */
  tilt: number | null;
  /** One-shot actions raised by the buttons. */
  restart: boolean;
  respawn: boolean;
  camera: boolean;
  pause: boolean;
  /** True once any touch was seen (UI auto-shows). */
  active: boolean;
}

export const newTouchState = (): TouchState => ({
  left: false, right: false, gas: false, brake: false, tilt: null,
  restart: false, respawn: false, camera: false, pause: false, active: false,
});
