/** A full-screen UI layer (menu, level select, settings...). */
export interface Screen {
  readonly el: HTMLElement;
  /** Called every time it becomes the top screen (build / refresh content here). */
  onShow(): void;
  /** Esc / B / the back button. Return true when handled; otherwise the screen is popped. */
  onBack?(): boolean;
  /** Cleanup when removed from the stack. */
  onClose?(): void;
  /** When true the screen below stays visible through it (pause overlays). */
  readonly overlay?: boolean;
}

type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type=hidden]), [data-nav]';

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/**
 * Stack of screens with keyboard / gamepad focus navigation. Arrow keys and the D-pad / left stick move
 * focus to the nearest control in that direction, Enter / A activates, Esc / B goes back.
 */
export class ScreenManager {
  private readonly stack: Screen[] = [];
  private readonly host: HTMLElement;
  /** Set while handling an Escape press, so the game does not also treat it as "pause". */
  handledEscape = false;
  onChange: (depth: number) => void = () => undefined;
  /** Sound hooks. */
  onMove: () => void = () => undefined;
  onConfirm: () => void = () => undefined;
  onBackSound: () => void = () => undefined;
  /** True while a rebinding prompt is waiting for a key / button (navigation stays out of the way). */
  isCapturing: () => boolean = () => false;

  private padPrev: boolean[] = [];
  private padRepeat = 0;
  private padDir: Dir | null = null;

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.id = 'screens';
    parent.appendChild(this.host);
    window.addEventListener('keydown', this.onKey, true);
  }

  get depth(): number {
    return this.stack.length;
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(s: Screen): void {
    this.top?.el.classList.remove('top');
    this.stack.push(s);
    this.host.appendChild(s.el);
    this.layout();
    s.onShow();
    this.focusFirst();
    this.onChange(this.stack.length);
  }

  /** Replace everything with one screen. */
  set(s: Screen): void {
    this.closeAll(false);
    this.push(s);
  }

  pop(): void {
    const s = this.stack.pop();
    if (!s) return;
    s.onClose?.();
    s.el.remove();
    this.layout();
    this.top?.onShow();
    this.focusFirst();
    this.onChange(this.stack.length);
  }

  closeAll(notify = true): void {
    while (this.stack.length) {
      const s = this.stack.pop()!;
      s.onClose?.();
      s.el.remove();
    }
    if (notify) this.onChange(0);
  }

  /** Back one step: the screen may handle it (close a sub-view), otherwise it is popped. */
  back(): void {
    const t = this.top;
    if (!t) return;
    this.onBackSound();
    if (t.onBack?.()) return;
    this.pop();
  }

  private layout(): void {
    // only the top screen (and overlay screens' parents) are shown
    this.stack.forEach((s, i) => {
      const isTop = i === this.stack.length - 1;
      let shown = isTop;
      if (!isTop) {
        let k = i + 1;
        while (k < this.stack.length && this.stack[k]!.overlay) k++;
        shown = k === this.stack.length && this.stack[k - 1]!.overlay === true;
      }
      s.el.style.display = shown ? '' : 'none';
      s.el.classList.toggle('top', isTop);
      s.el.classList.toggle('under', !isTop);
    });
  }

  focusFirst(): void {
    const t = this.top;
    if (!t) return;
    const pref = t.el.querySelector<HTMLElement>('[data-autofocus]');
    const first = pref ?? this.candidates()[0];
    first?.focus({ preventScroll: true });
  }

  private candidates(): HTMLElement[] {
    const t = this.top;
    if (!t) return [];
    return [...t.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
  }

  /** Move focus to the best control in direction `d`. */
  move(d: Dir): void {
    const cands = this.candidates();
    if (!cands.length) return;
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !cands.includes(cur)) {
      cands[0]!.focus();
      return;
    }
    // sliders / dropdowns use left-right themselves
    if (d === 'left' || d === 'right') {
      if (cur instanceof HTMLInputElement && cur.type === 'range') {
        const step = Number(cur.step) || 1;
        cur.value = String(Number(cur.value) + (d === 'right' ? step : -step));
        cur.dispatchEvent(new Event('input', { bubbles: true }));
        cur.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (cur instanceof HTMLSelectElement) {
        const i = Math.max(0, Math.min(cur.options.length - 1, cur.selectedIndex + (d === 'right' ? 1 : -1)));
        if (i !== cur.selectedIndex) {
          cur.selectedIndex = i;
          cur.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
    }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const c of cands) {
      if (c === cur) continue;
      const b = c.getBoundingClientRect();
      const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
      const along = d === 'right' ? dx : d === 'left' ? -dx : d === 'down' ? dy : -dy;
      if (along <= 1) continue;
      const across = d === 'left' || d === 'right' ? Math.abs(dy) : Math.abs(dx);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.onMove();
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.stack.length || this.isCapturing()) return;
    const t = e.target as HTMLElement;
    const editing = t.tagName === 'INPUT' && ['text', 'number'].includes((t as HTMLInputElement).type);
    switch (e.code) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.handledEscape = true;
        this.back();
        return;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
        if (editing) return;
        e.preventDefault();
        e.stopPropagation();
        this.move(e.code.slice(5).toLowerCase() as Dir);
        return;
      case 'Enter': case 'Space':
        // buttons activate natively; let checkboxes toggle and stop the game seeing "restart"
        e.stopPropagation();
        if (t.tagName === 'BODY' || t === document.documentElement) this.focusFirst();
        if (e.code === 'Space' && t.tagName !== 'BUTTON' && t.tagName !== 'INPUT') e.preventDefault();
        if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'checkbox' && e.code === 'Enter') (t as HTMLInputElement).click();
        if (t.hasAttribute('data-nav') && t.tagName !== 'BUTTON') {
          e.preventDefault();
          t.click();
        }
        this.onConfirm();
        return;
      default:
    }
  };

  /** Poll the gamepad for menu navigation (call once per frame while any screen is open). */
  pollPad(dt: number): void {
    if (!this.stack.length || this.isCapturing()) return;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) {
      this.padPrev = [];
      return;
    }
    const down = pad.buttons.map((b) => b.pressed);
    const edge = (i: number): boolean => !!down[i] && !this.padPrev[i];
    let dir: Dir | null = null;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    if (down[12] || ay < -0.6) dir = 'up';
    else if (down[13] || ay > 0.6) dir = 'down';
    else if (down[14] || ax < -0.6) dir = 'left';
    else if (down[15] || ax > 0.6) dir = 'right';
    if (dir) {
      this.padRepeat -= dt;
      if (dir !== this.padDir || this.padRepeat <= 0) {
        this.move(dir);
        this.padRepeat = dir !== this.padDir ? 0.38 : 0.11;
        this.padDir = dir;
      }
    } else {
      this.padDir = null;
      this.padRepeat = 0;
    }
    if (edge(0)) {
      const a = document.activeElement as HTMLElement | null;
      if (a && this.top?.el.contains(a)) {
        a.click();
        this.onConfirm();
      }
    }
    if (edge(1)) this.back();
    this.padPrev = down;
  }
}
