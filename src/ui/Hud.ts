import { prettyKey } from '../core/input/Bindings';
import { InputManager } from '../core/input/InputManager';
import { Medal } from '../core/Medals';
import { formatDelta } from '../core/Records';
import { medalBadge } from './medals';
import { EffectId } from '../physics/Surface';

export function formatTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms));
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(t % 1000).padStart(3, '0')}`;
}

const EFFECT_LABEL: Record<EffectId, string> = {
  turbo: 'TURBO', turbo2: 'TURBO 2', reactor: 'REACTOR', noSteer: 'NO STEER', noBrake: 'NO BRAKE',
  cruise: 'CRUISE', fragile: 'FRAGILE', slowMo: 'SLOW-MO', engineOff: 'ENGINE OFF', gravity: 'LOW GRAVITY',
};
const EFFECT_COLOR: Record<EffectId, string> = {
  turbo: '#ff8a1f', turbo2: '#ff2a3a', reactor: '#b34dff', noSteer: '#2f6bff', noBrake: '#ffd21f',
  cruise: '#2fe38f', fragile: '#d8c9a8', slowMo: '#8fe8ff', engineOff: '#9aa0ad', gravity: '#ff5fd2',
};
const MEDAL_LABEL: Record<Medal, string> = { author: 'AUTHOR', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', none: '' };

export interface FinishInfo {
  time: number;
  /** vs the previous personal best (ms, negative = faster), or null on a first finish. */
  delta: number | null;
  newBest: boolean;
  /** Medal this run earned. */
  medal: Medal;
  /** True when it is a higher tier than the player had before (plays the medal animation). */
  medalEarned: boolean;
  respawns: number;
  /** Names of levels this finish unlocked. */
  unlocked: string[];
}

export interface FinishAction {
  label: string;
  /** Shown as a key hint. */
  key?: string;
  primary?: boolean;
  onClick: () => void;
}

/** In-run HUD: speed, run clock, countdown, checkpoint splits with deltas, active effects, finish panel. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly q = (s: string): HTMLElement => this.root.querySelector(s)!;
  private readonly vignette: HTMLElement;
  private toastTimer = 0;
  private lastSpeed = -1;
  private lastTime = '';
  private lastEffects = '';

  constructor(parent: HTMLElement, input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const k = input.bindings.keyboard;
    const key = (a: keyof typeof k): string => prettyKey(k[a][0] ?? '?');
    this.root.innerHTML = `
      <div class="hud-time"><small data-title>Run</small><span data-t>0:00.000</span><small data-cp class="cp"></small></div>
      <div class="hud-splits" data-splits></div>
      <div class="hud-effects" data-fx></div>
      <div class="hud-speed"><div class="num" data-n>0</div><div class="unit">km/h</div><div class="hud-bar"><i data-b></i></div></div>
      <div class="hud-count" data-count></div>
      <div class="hud-toast" data-toast></div>
      <div class="hud-finish" data-finish></div>
      <div class="hud-hints" data-hints>
        <b>${key('accel')}</b><b>${key('left')}</b><b>${key('brake')}</b><b>${key('right')}</b> drive &nbsp;
        <b>${key('restart')}</b> restart &nbsp; <b>${key('respawn')}</b> respawn &nbsp; <b>${key('camera')}</b> camera &nbsp;
        <b>G</b> ghost &nbsp; <b>${key('pause')}</b> menu
      </div>`;
    parent.appendChild(this.root);
    this.vignette = document.createElement('div');
    this.vignette.id = 'vignette';
    parent.insertBefore(this.vignette, this.root);
    setTimeout(() => this.q('[data-hints]').classList.add('hide'), 9000);
  }

  setTitle(name: string): void {
    this.q('[data-title]').textContent = name;
  }

  update(speedMs: number, topSpeed: number, runMs: number, boost: number): void {
    const kmh = Math.round(speedMs * 3.6);
    if (kmh !== this.lastSpeed) {
      this.lastSpeed = kmh;
      this.q('[data-n]').textContent = String(kmh);
      this.q('[data-b]').style.width = `${Math.min(100, (speedMs / topSpeed) * 100).toFixed(1)}%`;
    }
    this.vignette.style.opacity = String(Math.max(0, Math.min(0.9, Math.max((speedMs - 35) / 60, boost * 0.8))));
    const t = formatTime(runMs);
    if (t !== this.lastTime) {
      this.lastTime = t;
      this.q('[data-t]').textContent = t;
    }
  }

  setProgress(cp: number, cpTotal: number, lap: number, laps: number): void {
    const parts: string[] = [];
    if (laps > 1) parts.push(`LAP ${Math.min(lap + 1, laps)}/${laps}`);
    if (cpTotal > 0) parts.push(`CP ${cp}/${cpTotal}`);
    this.q('[data-cp]').textContent = parts.join('  ·  ');
  }

  setCountdown(beat: number | null): void {
    const el = this.q('[data-count]');
    if (beat === null) {
      el.classList.remove('show');
      return;
    }
    el.textContent = beat === 0 ? 'GO!' : String(beat);
    el.classList.toggle('go', beat === 0);
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  }

  clearSplits(): void {
    this.q('[data-splits]').innerHTML = '';
  }

  addSplit(label: string, time: number, delta: number | null): void {
    const row = document.createElement('div');
    const cls = delta === null ? '' : delta <= 0 ? 'good' : 'bad';
    row.innerHTML = `<span>${label}</span><b>${formatTime(time)}</b><i class="${cls}">${delta === null ? '' : formatDelta(delta)}</i>`;
    const host = this.q('[data-splits]');
    host.appendChild(row);
    while (host.children.length > 5) host.firstElementChild!.remove();
    if (delta !== null) this.toast(`${label}  ${formatDelta(delta)}`, 1400, delta <= 0 ? 'good' : 'bad');
  }

  setEffects(active: readonly EffectId[]): void {
    const key = active.join(',');
    if (key === this.lastEffects) return;
    this.lastEffects = key;
    this.q('[data-fx]').innerHTML = active
      .map((e) => `<span style="--c:${EFFECT_COLOR[e]}">${EFFECT_LABEL[e]}</span>`)
      .join('');
  }

  showFinish(f: FinishInfo, actions: FinishAction[]): void {
    const el = this.q('[data-finish]');
    const delta = f.delta === null ? '' : `<div class="d ${f.delta <= 0 ? 'good' : 'bad'}">${formatDelta(f.delta)} vs PB</div>`;
    const medal = f.medal === 'none' ? '' : `<div class="medal-wrap ${f.medalEarned ? 'earned' : ''}">${medalBadge(f.medal, 'lg')}<div class="medal-name m-${f.medal}">${MEDAL_LABEL[f.medal]}${f.medalEarned ? ' MEDAL' : ''}</div></div>`;
    const unlocked = f.unlocked.length ? `<div class="unlock">UNLOCKED · ${f.unlocked.join(' · ')}</div>` : '';
    el.innerHTML = `
      <h3>FINISH</h3>
      <div class="t">${formatTime(f.time)}</div>
      ${f.newBest ? '<div class="pb">NEW PERSONAL BEST</div>' : ''}
      ${delta}${medal}${unlocked}
      ${f.respawns > 0 ? `<div class="r">${f.respawns} respawn${f.respawns > 1 ? 's' : ''}</div>` : ''}
      <div class="acts"></div>`;
    const host = el.querySelector('.acts')!;
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${a.primary ? ' primary' : ''}`;
      b.dataset.nav = '1';
      b.innerHTML = `${a.label}${a.key ? ` <kbd>${a.key}</kbd>` : ''}`;
      b.onclick = a.onClick;
      host.appendChild(b);
    }
    el.classList.add('show');
    this.q('[data-toast]').classList.remove('show');
  }

  /** Tuck the finish panel away (a replay is playing) without losing it. */
  awayFinish(away: boolean): void {
    this.q('[data-finish]').classList.toggle('away', away);
  }

  get finishVisible(): boolean {
    return this.q('[data-finish]').classList.contains('show');
  }

  hideFinish(): void {
    this.q('[data-finish]').classList.remove('show');
  }

  toast(msg: string, ms = 1100, tone: '' | 'good' | 'bad' = ''): void {
    const el = this.q('[data-toast]');
    el.textContent = msg;
    el.className = `hud-toast show ${tone}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }

  showHints(): void {
    this.q('[data-hints]').classList.remove('hide');
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}
