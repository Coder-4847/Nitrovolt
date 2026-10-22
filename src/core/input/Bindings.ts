import { storage } from '../Storage';

export type KeyAction = 'accel' | 'brake' | 'left' | 'right' | 'restart' | 'respawn' | 'camera' | 'mouseSteer' | 'debug' | 'pause';
export type PadAction = 'accel' | 'brake' | 'restart' | 'respawn' | 'camera' | 'pause' | 'left' | 'right';

export interface Bindings {
  keyboard: Record<KeyAction, string[]>;
  /** Gamepad button index per action (standard mapping). */
  gamepad: Record<PadAction, number>;
  /** Gamepad axis used for steering. */
  steerAxis: number;
  deadzone: number;
  /** Exponent shaping the stick response (1 = linear). */
  steerCurve: number;
}

export const DEFAULT_BINDINGS: Bindings = {
  keyboard: {
    accel: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    restart: ['Enter'],
    respawn: ['Backspace'],
    camera: ['KeyC'],
    mouseSteer: ['KeyM'],
    debug: ['F3'],
    pause: ['Escape', 'KeyP'],
  },
  gamepad: { accel: 7, brake: 6, restart: 9, respawn: 3, camera: 0, pause: 8, left: 14, right: 15 },
  steerAxis: 0,
  deadzone: 0.1,
  steerCurve: 1.35,
};

const KEY = 'nitrovolt.bindings.v1';

export function loadBindings(): Bindings {
  const saved = storage.get<Partial<Bindings> | null>(KEY, null);
  if (!saved) return structuredClone(DEFAULT_BINDINGS);
  return {
    ...structuredClone(DEFAULT_BINDINGS),
    ...saved,
    keyboard: { ...DEFAULT_BINDINGS.keyboard, ...(saved.keyboard ?? {}) },
    gamepad: { ...DEFAULT_BINDINGS.gamepad, ...(saved.gamepad ?? {}) },
  };
}

export function saveBindings(b: Bindings): void {
  storage.set(KEY, b);
}

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  accel: 'Accelerate',
  brake: 'Brake / Reverse',
  left: 'Steer left',
  right: 'Steer right',
  restart: 'Restart',
  respawn: 'Respawn',
  camera: 'Camera',
  mouseSteer: 'Mouse steering',
  debug: 'Debug HUD',
  pause: 'Menu',
};

export const PAD_ACTION_LABELS: Record<PadAction, string> = {
  accel: 'Accelerate',
  brake: 'Brake / Reverse',
  restart: 'Restart',
  respawn: 'Respawn',
  camera: 'Camera',
  pause: 'Menu',
  left: 'Steer left (D-pad)',
  right: 'Steer right (D-pad)',
};

const KEY_NAMES: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Space', Enter: 'Enter', Backspace: 'Backspace', Escape: 'Esc',
};

export function prettyKey(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');
}
