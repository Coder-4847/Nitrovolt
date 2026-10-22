import { Bindings, PadAction } from './Bindings';

export interface PadState {
  connected: boolean;
  steer: number;
  accel: number;
  brake: number;
}

/** Standard-mapping gamepad: analog triggers, radial-ish deadzone, rumble, button edge detection. */
export class GamepadInput {
  private prevButtons: boolean[] = [];
  private edges = new Set<PadAction>();
  /** Index of the pad we follow (first connected). */
  private padIndex = -1;
  /** Capture the next pressed button index (rebinding UI). */
  capture: ((button: number) => void) | null = null;
  id = '';

  constructor(private bindings: Bindings) {}

  setBindings(b: Bindings): void {
    this.bindings = b;
  }

  private getPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex >= 0) {
      const p = pads[this.padIndex];
      if (p && p.connected) return p;
    }
    for (const p of pads) {
      if (p && p.connected) {
        this.padIndex = p.index;
        this.id = p.id;
        return p;
      }
    }
    this.padIndex = -1;
    return null;
  }

  private shapeAxis(v: number): number {
    const dz = this.bindings.deadzone;
    const a = Math.abs(v);
    if (a < dz) return 0;
    const n = (a - dz) / (1 - dz);
    return Math.sign(v) * Math.pow(n, this.bindings.steerCurve);
  }

  /** Poll once per physics tick. */
  poll(): PadState {
    const pad = this.getPad();
    if (!pad) {
      this.prevButtons = [];
      return { connected: false, steer: 0, accel: 0, brake: 0 };
    }
    const btn = (i: number): number => (pad.buttons[i] ? pad.buttons[i]!.value : 0);
    const pressed = (i: number): boolean => !!pad.buttons[i]?.pressed;

    // edges (restart, respawn, ...)
    const now = pad.buttons.map((b) => b.pressed);
    for (let i = 0; i < now.length; i++) {
      if (now[i] && !this.prevButtons[i]) {
        if (this.capture) {
          const cb = this.capture;
          this.capture = null;
          cb(i);
        } else {
          for (const k of Object.keys(this.bindings.gamepad) as PadAction[]) {
            if (this.bindings.gamepad[k] === i) this.edges.add(k);
          }
        }
      }
    }
    this.prevButtons = now;

    let steer = this.shapeAxis(pad.axes[this.bindings.steerAxis] ?? 0);
    if (pressed(this.bindings.gamepad.left)) steer = Math.min(steer, -1);
    if (pressed(this.bindings.gamepad.right)) steer = Math.max(steer, 1);
    return {
      connected: true,
      steer,
      accel: btn(this.bindings.gamepad.accel),
      brake: btn(this.bindings.gamepad.brake),
    };
  }

  consume(action: PadAction): boolean {
    return this.edges.delete(action);
  }

  clearEdges(): void {
    this.edges.clear();
  }

  /** Dual-rumble feedback (landings, boosts). Silently ignored where unsupported. */
  rumble(strong: number, weak: number, durationMs: number): void {
    const pad = this.getPad();
    const act = (pad as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    if (!act?.playEffect) return;
    void act.playEffect('dual-rumble', { startDelay: 0, duration: durationMs, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => undefined);
  }
}
