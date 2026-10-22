import { InputFrame, makeFrame } from '../InputFrame';
import { Bindings, loadBindings } from './Bindings';
import { GamepadInput } from './GamepadInput';
import { KeyboardInput } from './KeyboardInput';
import { TouchState, newTouchState } from './TouchState';

export interface MetaActions {
  restart: boolean;
  respawn: boolean;
  camera: boolean;
  pause: boolean;
  debug: boolean;
  mouseSteerToggled: boolean;
}

const move = (cur: number, target: number, maxDelta: number): number => {
  const d = target - cur;
  return Math.abs(d) <= maxDelta ? target : cur + Math.sign(d) * maxDelta;
};

/**
 * Collapses every device into one InputFrame per physics tick.
 * Keyboard steering is ramped (analog-smoothed) so digital keys still feel progressive.
 */
export class InputManager {
  bindings: Bindings = loadBindings();
  readonly keyboard: KeyboardInput;
  readonly gamepad: GamepadInput;
  readonly touch: TouchState = newTouchState();

  mouseSteer = false;
  private mouseX = 0; // -1..1
  private mouseButtons = 0;

  private kSteer = 0;
  private kAccel = 0;
  private kBrake = 0;

  constructor() {
    this.keyboard = new KeyboardInput(this.bindings);
    this.gamepad = new GamepadInput(this.bindings);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContext);
    window.addEventListener('touchstart', this.onFirstTouch, { passive: true });
  }

  applyBindings(b: Bindings): void {
    this.bindings = b;
    this.keyboard.setBindings(b);
    this.gamepad.setBindings(b);
  }

  private onFirstTouch = (): void => {
    this.touch.active = true;
  };
  private onMouseMove = (e: MouseEvent): void => {
    this.mouseX = Math.max(-1, Math.min(1, ((e.clientX / window.innerWidth) * 2 - 1) * 1.6));
  };
  private onMouseDown = (e: MouseEvent): void => {
    if (this.mouseSteer && (e.target as HTMLElement).tagName === 'CANVAS') this.mouseButtons |= 1 << e.button;
  };
  private onMouseUp = (e: MouseEvent): void => {
    this.mouseButtons &= ~(1 << e.button);
  };
  private onContext = (e: Event): void => {
    if (this.mouseSteer) e.preventDefault();
  };

  /**
   * Sample one InputFrame. `speed` (m/s) slows keyboard steering ramps at high speed, which feels
   * more progressive. The quantised frame is what the sim consumes AND what gets recorded.
   */
  sample(dt: number, speed: number): InputFrame {
    const kb = this.keyboard;
    const pad = this.gamepad.poll();

    // --- keyboard analog smoothing ---
    const dig = (kb.isDown('right') || this.touch.right ? 1 : 0) - (kb.isDown('left') || this.touch.left ? 1 : 0);
    const attack = 7.5 - 3.8 * Math.min(1, speed / 80);
    const flip = 16;
    const release = 9;
    if (dig === 0) this.kSteer = move(this.kSteer, 0, release * dt);
    else if (this.kSteer !== 0 && Math.sign(this.kSteer) !== dig) this.kSteer = move(this.kSteer, dig, flip * dt);
    else this.kSteer = move(this.kSteer, dig, attack * dt);

    this.kAccel = move(this.kAccel, kb.isDown('accel') || this.touch.gas ? 1 : 0, (kb.isDown('accel') || this.touch.gas ? 11 : 22) * dt);
    this.kBrake = move(this.kBrake, kb.isDown('brake') || this.touch.brake ? 1 : 0, (kb.isDown('brake') || this.touch.brake ? 11 : 22) * dt);

    // --- merge sources: largest magnitude wins ---
    const pick = (...v: number[]): number => v.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
    let steer = pick(this.kSteer, pad.steer, this.touch.tilt ?? 0);
    let accel = Math.max(this.kAccel, pad.accel);
    let brake = Math.max(this.kBrake, pad.brake);
    if (this.mouseSteer) {
      const dz = 0.04;
      const mx = Math.abs(this.mouseX) < dz ? 0 : this.mouseX;
      steer = pick(steer, mx);
      if (this.mouseButtons & 1) accel = 1;
      if (this.mouseButtons & 4 || this.mouseButtons & 2) brake = 1;
    }

    return makeFrame(steer, accel, brake, false);
  }

  /** Poll one-shot actions (call once per render frame; works while paused). */
  pollMeta(): MetaActions {
    const kb = this.keyboard;
    const t = this.touch;
    const m: MetaActions = {
      restart: kb.consume('restart') || this.gamepad.consume('restart') || t.restart,
      respawn: kb.consume('respawn') || this.gamepad.consume('respawn') || t.respawn,
      camera: kb.consume('camera') || this.gamepad.consume('camera') || t.camera,
      pause: kb.consume('pause') || this.gamepad.consume('pause') || t.pause,
      debug: kb.consume('debug'),
      mouseSteerToggled: false,
    };
    if (kb.consume('mouseSteer')) {
      this.mouseSteer = !this.mouseSteer;
      m.mouseSteerToggled = true;
    }
    t.restart = t.respawn = t.camera = t.pause = false;
    return m;
  }

  rumble(strong: number, weak: number, ms: number): void {
    this.gamepad.rumble(strong, weak, ms);
    if (this.touch.active && 'vibrate' in navigator) navigator.vibrate(Math.min(ms, 120));
  }

  dispose(): void {
    this.keyboard.dispose();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('touchstart', this.onFirstTouch);
  }
}
