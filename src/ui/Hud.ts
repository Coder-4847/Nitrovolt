import { prettyKey } from '../core/input/Bindings';
import { InputManager } from '../core/input/InputManager';

export function formatTime(seconds: number): string {
  const ms = Math.floor(seconds * 1000);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

/** Minimal in-run HUD: speed, run clock, toasts and a first-launch controls hint. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly num: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly time: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly hints: HTMLElement;
  private readonly vignette: HTMLElement;
  private toastTimer = 0;
  private lastSpeed = -1;
  private lastTime = '';

  constructor(parent: HTMLElement, input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const k = input.bindings.keyboard;
    const key = (a: keyof typeof k): string => prettyKey(k[a][0] ?? '?');
    this.root.innerHTML = `
      <div class="hud-time"><small>Run</small><span data-t>0:00.000</span></div>
      <div class="hud-speed"><div class="num" data-n>0</div><div class="unit">km/h</div><div class="hud-bar"><i data-b></i></div></div>
      <div class="hud-toast" data-toast></div>
      <div class="hud-hints" data-hints>
        <b>${key('accel')}</b><b>${key('left')}</b><b>${key('brake')}</b><b>${key('right')}</b> drive &nbsp;
        <b>${key('restart')}</b> restart &nbsp; <b>${key('respawn')}</b> respawn &nbsp; <b>${key('camera')}</b> camera &nbsp;
        <b>${key('mouseSteer')}</b> mouse steer &nbsp; <b>${key('pause')}</b> menu
      </div>`;
    parent.appendChild(this.root);
    this.num = this.root.querySelector('[data-n]')!;
    this.bar = this.root.querySelector('[data-b]')!;
    this.time = this.root.querySelector('[data-t]')!;
    this.toastEl = this.root.querySelector('[data-toast]')!;
    this.hints = this.root.querySelector('[data-hints]')!;
    this.vignette = document.createElement('div');
    this.vignette.id = 'vignette';
    parent.insertBefore(this.vignette, this.root);
    setTimeout(() => this.hints.classList.add('hide'), 9000);
  }

  update(speedMs: number, topSpeed: number, runTime: number): void {
    const kmh = Math.round(speedMs * 3.6);
    if (kmh !== this.lastSpeed) {
      this.lastSpeed = kmh;
      this.num.textContent = String(kmh);
      this.bar.style.width = `${Math.min(100, (speedMs / topSpeed) * 100).toFixed(1)}%`;
      this.vignette.style.opacity = String(Math.max(0, Math.min(0.85, (speedMs - 35) / 60)));
    }
    const t = formatTime(runTime);
    if (t !== this.lastTime) {
      this.lastTime = t;
      this.time.textContent = t;
    }
  }

  toast(msg: string, ms = 1100): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  showHints(): void {
    this.hints.classList.remove('hide');
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}
