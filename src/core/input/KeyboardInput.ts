import { Bindings, KeyAction } from './Bindings';

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace', 'Tab', 'F3']);

/** Tracks held keys plus one-shot "pressed since last poll" latches (so a 5 ms tap is never lost). */
export class KeyboardInput {
  private held = new Set<string>();
  private latched = new Set<string>();
  /** Set while a key-rebinding prompt is capturing the next key. */
  capture: ((code: string) => void) | null = null;

  constructor(private bindings: Bindings) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  setBindings(b: Bindings): void {
    this.bindings = b;
  }

  private isTextTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text'));
  }

  private onDown = (e: KeyboardEvent): void => {
    if (this.capture) {
      e.preventDefault();
      const cb = this.capture;
      this.capture = null;
      cb(e.code);
      return;
    }
    if (this.isTextTarget(e)) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) this.latched.add(e.code);
    this.held.add(e.code);
  };

  private onUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private onBlur = (): void => {
    this.held.clear();
  };

  isDown(action: KeyAction): boolean {
    for (const c of this.bindings.keyboard[action]) if (this.held.has(c)) return true;
    return false;
  }

  /** True once per press, then cleared. */
  consume(action: KeyAction): boolean {
    let hit = false;
    for (const c of this.bindings.keyboard[action]) {
      if (this.latched.delete(c)) hit = true;
    }
    return hit;
  }

  /** Drop latched presses we do not care about so they do not fire later. */
  clearLatched(): void {
    this.latched.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
