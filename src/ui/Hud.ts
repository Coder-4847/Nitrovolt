import { prettyKey } from '../core/input/Bindings';
import { InputManager } from '../core/input/InputManager';
import { formatDelta } from '../core/Records';
import { EffectId } from '../physics/Surface';

/** Race clock: m:ss.cc (centiseconds), as on the big timer. */
export function formatClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 10));
  const m = Math.floor(t / 6000);
  const s = Math.floor((t % 6000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(t % 100).padStart(2, '0')}`;
}

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

export interface FinishSplit {
  label: string;
  time: number;
  /** vs the personal best's split (ms, negative = faster), or null. */
  delta: number | null;
}

export interface FinishInfo {
  time: number;
  /** vs the previous personal best (ms, negative = faster), or null on a first finish. */
  delta: number | null;
  newBest: boolean;
  /** The track's target time (ms) and how this run compares (negative = faster), or null when the track has none. */
  target: number | null;
  vsTarget: number | null;
  respawns: number;
  splits: FinishSplit[];
}

export interface FinishAction {
  label: string;
  /** Shown as a key hint. */
  key?: string;
  primary?: boolean;
  onClick: () => void;
}

/** What the minimap draws: the driving line in 2D, split by car, with the line markers. */
export interface MapData {
  /** Top-down points (x, z) of the road with the car in use on that stretch (`jump` = no road, a gap). */
  line: Array<{ x: number; z: number; color: string; gap: boolean }>;
  /** Start, checkpoints, car gates and the finish. */
  marks: Array<{ x: number; z: number; kind: 'start' | 'checkpoint' | 'gate' | 'finish'; color: string }>;
}

export interface MapDot {
  x: number;
  z: number;
}

const MAP_SIZE = 168;

/**
 * In-run HUD laid out like a race broadcast: the big clock top centre with the live gap to your ghost under
 * it, a times board top-left (personal best and the target), a minimap top-right, a checkpoint split pop-up
 * (blue = ahead of your best, red = behind), the car and what is coming next, a speed readout, the
 * countdown and the finish panel.
 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly q = (s: string): HTMLElement => this.root.querySelector(s)!;
  private readonly vignette: HTMLElement;
  /** Darken the screen edges a little at high speed (Settings > Speed vignette). */
  speedFx = true;
  private toastTimer = 0;
  private lastSpeed = -1;
  private lastTime = '';
  private lastEffects = '';
  private cpTimer = 0;
  private bannerTimer = 0;
  private lastGap = '';
  private readonly dots: Record<'me' | 'pb' | 'target', HTMLElement>;
  private mapBox = { minX: 0, minZ: 0, scale: 1, ox: 0, oz: 0 };
  private readonly canvas: HTMLCanvasElement;

  constructor(parent: HTMLElement, input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const k = input.bindings.keyboard;
    const key = (a: keyof typeof k): string => prettyKey(k[a][0] ?? '?');
    this.root.innerHTML = `
      <div class="hud-board">
        <header class="hb-title"><b data-title>Run</b><small data-sub></small></header>
        <p class="hb-car" data-car><i></i><span></span></p>
        <section data-board></section>
      </div>
      <div class="hud-time"><span data-t>00:00.00</span><div class="hud-gap" data-gap></div><div class="hud-next" data-next></div></div>
      <div class="hud-map" data-mapbox>
        <canvas width="${MAP_SIZE * 2}" height="${MAP_SIZE * 2}" data-map></canvas>
        <i class="dot target" data-dtarget></i><i class="dot pb" data-dpb></i><i class="dot me" data-dme></i>
        <small data-cp class="cp"></small><small data-lap class="lap"></small>
      </div>
      <div class="hud-cp" data-cpbox><span class="t" data-cpt></span><span class="d" data-cpd></span></div>
      <div class="hud-banner" data-banner></div>
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
    this.canvas = this.q('[data-map]') as HTMLCanvasElement;
    this.dots = { me: this.q('[data-dme]'), pb: this.q('[data-dpb]'), target: this.q('[data-dtarget]') };
    setTimeout(() => this.q('[data-hints]').classList.add('hide'), 9000);
  }

  setTitle(name: string): void {
    this.q('[data-title]').textContent = name;
  }

  /** The car in use (name and its gate colour). */
  setCar(label: string, color: string): void {
    const el = this.q('[data-car]');
    el.style.setProperty('--c', color);
    el.querySelector('span')!.textContent = `${label} car`;
  }

  setSub(text: string): void {
    this.q('[data-sub]').textContent = text;
  }

  update(speedMs: number, topSpeed: number, runMs: number, boost: number): void {
    const kmh = Math.round(speedMs * 3.6);
    if (kmh !== this.lastSpeed) {
      this.lastSpeed = kmh;
      this.q('[data-n]').textContent = String(kmh);
      this.q('[data-b]').style.width = `${Math.min(100, (speedMs / topSpeed) * 100).toFixed(1)}%`;
    }
    this.vignette.style.opacity = this.speedFx ? String(Math.max(0, Math.min(0.6, Math.max((speedMs - 40) / 70, boost * 0.5)))) : '0';
    const t = formatClock(runMs);
    if (t !== this.lastTime) {
      this.lastTime = t;
      this.q('[data-t]').textContent = t;
    }
  }

  setProgress(cp: number, cpTotal: number, lap: number, laps: number): void {
    this.q('[data-lap]').textContent = laps > 1 ? `Lap ${Math.min(lap + 1, laps)}/${laps}` : '';
    this.q('[data-cp]').textContent = cpTotal > 0 ? `CP ${cp}/${cpTotal}` : '';
  }

  /** Personal best and the target time for the times board. */
  setTargets(pb: number | null, target: number | null): void {
    const rows: string[] = [];
    rows.push(`<div class="pb"><span>Personal best</span><b>${pb !== null ? formatTime(pb) : '—'}</b></div>`);
    if (target !== null && target > 0) rows.push(`<div class="tg${pb !== null && pb <= target ? ' beaten' : ''}"><span>Target</span><b>${formatTime(target)}</b></div>`);
    this.q('[data-board]').innerHTML = rows.join('');
  }

  /**
   * Live gap to the ghost you are racing, in seconds (positive = the ghost is ahead of you). Null hides it.
   */
  setGap(sec: number | null, label = 'PB'): void {
    const el = this.q('[data-gap]');
    if (sec === null) {
      if (this.lastGap !== '') {
        this.lastGap = '';
        el.className = 'hud-gap';
        el.innerHTML = '';
      }
      return;
    }
    const c = Math.max(-99.99, Math.min(99.99, sec));
    const txt = `${c <= 0 ? '−' : '+'}${Math.abs(c).toFixed(2)}`;
    const key = `${label}${txt}`;
    if (key === this.lastGap) return;
    this.lastGap = key;
    el.className = `hud-gap show ${c <= 0 ? 'ahead' : 'behind'}`;
    el.innerHTML = `<small>${label}</small><b>${txt}</b>`;
  }

  /** Draw the minimap of a track (once per race). */
  setMap(map: MapData): void {
    const ctx = this.canvas.getContext('2d')!;
    const S = MAP_SIZE * 2;
    ctx.clearRect(0, 0, S, S);
    if (map.line.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of map.line) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const pad = 16;
    const scale = (S - pad * 2) / Math.max(maxX - minX, maxZ - minZ, 1);
    const ox = (S - (maxX - minX) * scale) / 2, oz = (S - (maxZ - minZ) * scale) / 2;
    this.mapBox = { minX, minZ, scale, ox, oz };
    const X = (x: number): number => ox + (x - minX) * scale;
    const Z = (z: number): number => oz + (z - minZ) * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // dark casing, then the coloured line on top
    for (const pass of [0, 1]) {
      for (let i = 1; i < map.line.length; i++) {
        const a = map.line[i - 1]!, b = map.line[i]!;
        if (b.gap) continue;
        ctx.beginPath();
        ctx.moveTo(X(a.x), Z(a.z));
        ctx.lineTo(X(b.x), Z(b.z));
        ctx.lineWidth = pass === 0 ? 13 : 7;
        ctx.strokeStyle = pass === 0 ? 'rgba(6,9,14,.85)' : b.color;
        ctx.stroke();
      }
    }
    for (const m of map.marks) {
      ctx.beginPath();
      ctx.arc(X(m.x), Z(m.z), m.kind === 'checkpoint' ? 6 : 9, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(6,9,14,.9)';
      ctx.stroke();
    }
  }

  /** Move the dots of the player and the ghosts on the minimap (null hides one). */
  setDots(me: MapDot | null, pb: MapDot | null, target: MapDot | null): void {
    const { minX, minZ, scale, ox, oz } = this.mapBox;
    const put = (el: HTMLElement, p: MapDot | null): void => {
      if (!p) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = `${(((ox + (p.x - minX) * scale) / (MAP_SIZE * 2)) * 100).toFixed(2)}%`;
      el.style.top = `${(((oz + (p.z - minZ) * scale) / (MAP_SIZE * 2)) * 100).toFixed(2)}%`;
    };
    put(this.dots.me, me);
    put(this.dots.pb, pb);
    put(this.dots.target, target);
  }

  /** "Next: Rally car gate in 140 m" under the clock; null hides it. */
  setNext(label: string | null, color = '#fff', meters = 0): void {
    const el = this.q('[data-next]');
    if (label === null) {
      el.classList.remove('show');
      return;
    }
    el.style.setProperty('--c', color);
    el.innerHTML = `<i></i><span>${label} gate</span><b>${Math.max(0, Math.round(meters / 10) * 10)} m</b>`;
    el.classList.add('show');
  }

  /** Big flash in the middle of the screen when a car gate switches the car. */
  showCarBanner(label: string, color: string): void {
    const el = this.q('[data-banner]');
    el.style.setProperty('--c', color);
    el.innerHTML = `<small>CAR SWITCH</small><b>${label}</b>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => el.classList.remove('show'), 1700);
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
    this.q('[data-cpbox]').classList.remove('show');
    this.q('[data-banner]').classList.remove('show');
    this.setGap(null);
  }

  addSplit(label: string, time: number, delta: number | null): void {
    // the split pop-up in the middle of the screen
    const box = this.q('[data-cpbox]');
    this.q('[data-cpt]').textContent = `${label}  ${formatTime(time)}`;
    const d = this.q('[data-cpd]');
    d.textContent = delta === null ? '' : formatDelta(delta);
    d.className = `d ${delta === null ? 'none' : delta <= 0 ? 'ahead' : 'behind'}`;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(this.cpTimer);
    this.cpTimer = window.setTimeout(() => box.classList.remove('show'), 2600);
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
    const cmp = (label: string, d: number | null): string => (d === null ? '' : `<div class="cmp ${d <= 0 ? 'good' : 'bad'}"><span>${label}</span><b>${formatDelta(d)}</b></div>`);
    const splits = f.splits.length
      ? `<div class="fs">${f.splits.map((s) => `<div><span>${s.label}</span><b>${formatTime(s.time)}</b><i class="${s.delta === null ? '' : s.delta <= 0 ? 'good' : 'bad'}">${s.delta === null ? '' : formatDelta(s.delta)}</i></div>`).join('')}</div>`
      : '';
    el.innerHTML = `
      <h3>FINISH</h3>
      <div class="t">${formatTime(f.time)}</div>
      ${f.newBest ? `<div class="pbflag">${f.delta === null ? 'FIRST TIME SET' : 'NEW PERSONAL BEST'}</div>` : ''}
      <div class="cmps">${cmp('vs personal best', f.delta)}${cmp('vs target', f.vsTarget)}</div>
      ${splits}
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
