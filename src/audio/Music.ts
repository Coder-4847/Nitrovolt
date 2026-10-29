import { Rng } from '../core/Rng';

export type MusicMode = 'off' | 'menu' | 'race' | 'pause';

interface Style {
  bpm: number;
  /** One chord (MIDI notes) per bar. */
  chords: number[][];
  /** Bass root per bar (MIDI). */
  bass: number[];
  bassPattern: number[]; // 16 steps: 0 rest, 1 note, 2 octave up
  kick: number[];
  snare: number[];
  hat: number[];
  lead: 'square' | 'triangle' | 'bell' | 'saw';
  padCutoff: number;
  swing: number;
}

const m = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
const P = (s: string): number[] => [...s].map((c) => (c === 'x' ? 1 : c === 'o' ? 2 : 0));

/** One style per season theme: tempo, progression, groove and lead timbre. */
const STYLES: Record<string, Style> = {
  // synthwave: Am F C G, four on the floor
  neon: { bpm: 112, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [33, 29, 36, 31], bassPattern: P('x.x.x.x.x.x.x.xo'), kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), lead: 'saw', padCutoff: 1400, swing: 0 },
  // airy: Dmaj7 Bm7 Gmaj7 A, half-time
  alpine: { bpm: 90, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]], bass: [38, 35, 31, 33], bassPattern: P('x.......x.....x.'), kick: P('x.........x.....'), snare: P('........x.......'), hat: P('x.x.x.x.x.x.x.x.'), lead: 'bell', padCutoff: 2200, swing: 0.08 },
  // desert: Em C D Bm with a tom-ish groove
  desert: { bpm: 100, chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]], bass: [28, 36, 38, 35], bassPattern: P('x..x..x...x..x..'), kick: P('x..x......x.....'), snare: P('....x..x....x...'), hat: P('.x.x.x.x.x.x.x.x'), lead: 'triangle', padCutoff: 1200, swing: 0.12 },
  // coast & industry: C#m A E B, driving
  coast: { bpm: 122, chords: [[61, 64, 68], [57, 61, 64], [52, 56, 59], [59, 63, 66]], bass: [37, 33, 40, 35], bassPattern: P('.x.x.x.x.x.x.x.x'), kick: P('x...x...x...x...'), snare: P('....x.......x..x'), hat: P('x.xxx.xxx.xxx.xx'), lead: 'square', padCutoff: 1800, swing: 0 },
  stadium: { bpm: 116, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: [36, 33, 29, 31], bassPattern: P('x.x.x.x.x.x.x.x.'), kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), lead: 'square', padCutoff: 1600, swing: 0 },
};

/**
 * Generative soundtrack: a four-bar loop per season theme (pad, bass, arpeggio, drums) scheduled ahead on
 * the audio clock. The arpeggio is re-rolled from a seeded generator every few loops so it does not get
 * stale. Menus get a calm mix (pad + arpeggio), races the full band, pause a muffled one.
 */
export class Music {
  private readonly out: GainNode;
  private readonly filter: BiquadFilterNode;
  private style: Style = STYLES.neon!;
  private theme = 'neon';
  private mode: MusicMode = 'off';
  private nextTime = 0;
  private step = 0;
  private timer = 0;
  private arp: number[] = [];
  private readonly rng = new Rng(2024);

  constructor(private readonly ctx: AudioContext, dest: AudioNode, private readonly noise: AudioBuffer) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter.connect(this.out).connect(dest);
    this.rollArp();
  }

  setTheme(theme: string): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.style = STYLES[theme] ?? STYLES.neon!;
    this.step = 0;
  }

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    const t = this.ctx.currentTime;
    this.mode = mode;
    this.out.gain.setTargetAtTime(mode === 'off' ? 0 : mode === 'pause' ? 0.55 : mode === 'menu' ? 0.85 : 0.7, t, 0.4);
    this.filter.frequency.setTargetAtTime(mode === 'pause' ? 700 : 18000, t, 0.2);
    if (mode !== 'off' && !this.timer) {
      this.nextTime = t + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 40);
    }
    if (mode === 'off' && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private rollArp(): void {
    const shapes = [[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1], [0, 0, 2, 1]];
    const s = shapes[Math.floor(this.rng.next() * shapes.length)]!;
    this.arp = Array.from({ length: 16 }, (_, i) => (i % 2 === 1 && this.rng.next() < 0.3 ? -1 : s[i % s.length]!));
  }

  private schedule(): void {
    const st = this.style;
    const spb = 60 / st.bpm / 4; // seconds per 16th
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const i = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const t = this.nextTime + (i % 2 === 1 ? st.swing * spb : 0);
      this.playStep(i, bar, t, spb);
      this.step++;
      if (this.step % 128 === 0) this.rollArp();
      this.nextTime += spb;
    }
  }

  private playStep(i: number, bar: number, t: number, spb: number): void {
    const st = this.style;
    const race = this.mode === 'race' || this.mode === 'pause';
    const chord = st.chords[bar]!;
    if (i === 0) this.pad(chord, t, spb * 16);
    const a = this.arp[i]!;
    if (a >= 0 && (race || i % 2 === 0)) this.lead(m(chord[a % chord.length]! + 12), t, spb * 1.6, race ? 0.05 : 0.035);
    if (!race) {
      if (st.hat[i]) this.hat(t, 0.025);
      return;
    }
    const b = st.bassPattern[i]!;
    if (b) this.bassNote(m(st.bass[bar]! + (b === 2 ? 12 : 0)), t, spb * 1.8);
    if (st.kick[i]) this.kick(t);
    if (st.snare[i]) this.snare(t);
    if (st.hat[i]) this.hat(t, 0.05);
  }

  // ---- instruments
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private pad(notes: number[], t: number, dur: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = this.style.padCutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.5);
    g.gain.setValueAtTime(0.03, t + dur - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g).connect(this.filter);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = m(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.7);
      }
    }
  }

  private lead(freq: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.filter);
    const kind = this.style.lead;
    const o = ctx.createOscillator();
    o.type = kind === 'bell' ? 'sine' : kind === 'saw' ? 'sawtooth' : kind;
    o.frequency.value = freq;
    if (kind === 'bell') {
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 2.01;
      const g2 = ctx.createGain();
      g2.gain.value = 0.4;
      o2.connect(g2).connect(g);
      o2.start(t);
      o2.stop(t + 1.2);
      this.env(g, t, vol, 0.005, 1.0);
      o.connect(g);
      o.start(t);
      o.stop(t + 1.2);
      return;
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(kind === 'saw' ? 3200 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    o.connect(f).connect(g);
    this.env(g, t, vol, 0.005, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bassNote(freq: number, t: number, dur: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.11, 0.004, dur);
    o.connect(f).connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    this.env(g, t, 0.4, 0.002, 0.28);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.001, dur);
    s.connect(f).connect(g).connect(this.filter);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  private snare(t: number): void {
    this.noiseHit(t, 'highpass', 1400, 0.12, 0.14);
    const o = this.ctx.createOscillator();
    o.frequency.value = 190;
    const g = this.ctx.createGain();
    this.env(g, t, 0.06, 0.001, 0.08);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + 0.1);
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, 'highpass', 7500, vol, 0.035);
  }

  /** A short rising sting on a finish or a new personal best. */
  sting(rank: number): void {
    const t = this.ctx.currentTime + 0.05;
    const chord = this.style.chords[0]!;
    chord.forEach((n, i) => this.lead(m(n + 12 + (rank >= 3 ? 12 : 0)), t + i * 0.07, 0.5, 0.05));
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.out.disconnect();
  }
}
