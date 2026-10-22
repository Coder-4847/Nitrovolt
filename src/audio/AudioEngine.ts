import { storage } from '../core/Storage';

interface AudioSettings {
  master: number;
  engine: number;
  sfx: number;
}

const KEY = 'nitrovolt.audio.v1';

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    // deterministic LCG noise; audio only, never touches physics
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

export interface EngineState {
  speed: number; // m/s
  throttle: number; // 0..1
  /** Highest tyre slip usage among grounded wheels, 0..~1.2 */
  slip: number;
  grounded: boolean;
  topSpeed: number;
}

/**
 * Procedural audio: engine (RPM + load, virtual gearbox), tyre squeal, wind and one-shot thuds.
 * Everything is synthesised with WebAudio. Created lazily on the first user gesture.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode;
  private sfxGain!: GainNode;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private engineFilter!: BiquadFilterNode;
  private engineLevel!: GainNode;
  private squealGain!: GainNode;
  private squealFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private noise!: AudioBuffer;
  private gear = 0;
  private rpm = 0;
  settings: AudioSettings = storage.get<AudioSettings>(KEY, { master: 0.7, engine: 0.8, sfx: 0.9 });

  constructor() {
    const unlock = (): void => {
      this.start();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private start(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.noise = makeNoiseBuffer(ctx);

    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.engineGain = ctx.createGain();
    this.engineGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);

    // engine: two detuned saws + square sub through a low-pass
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = 2.5;
    this.engineLevel = ctx.createGain();
    this.engineLevel.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    this.osc1.connect(shaper);
    this.osc2.connect(shaper);
    shaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineLevel);
    this.engineLevel.connect(this.engineGain);
    this.osc1.start();
    this.osc2.start();

    // tyre squeal: band-passed noise
    const sq = ctx.createBufferSource();
    sq.buffer = this.noise;
    sq.loop = true;
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.value = 1600;
    this.squealFilter.Q.value = 6;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    sq.connect(this.squealFilter).connect(this.squealGain).connect(this.sfxGain);
    sq.start();

    // wind: low-passed noise
    const wd = ctx.createBufferSource();
    wd.buffer = this.noise;
    wd.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 900;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wd.connect(wf).connect(this.windGain).connect(this.sfxGain);
    wd.start();

    this.applySettings();
  }

  applySettings(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.engineGain.gain.value = this.settings.engine;
    this.sfxGain.gain.value = this.settings.sfx;
    storage.set(KEY, this.settings);
  }

  /** Per render-frame update. */
  update(s: EngineState, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // virtual gearbox: 6 gears over the speed range
    const frac = Math.min(1, s.speed / s.topSpeed);
    const gears = 6;
    const g = Math.min(gears - 1, Math.floor(Math.pow(frac, 0.8) * gears));
    const lo = Math.pow(g / gears, 1 / 0.8), hi = Math.pow((g + 1) / gears, 1 / 0.8);
    const inGear = (frac - lo) / Math.max(hi - lo, 1e-3);
    const targetRpm = 0.18 + 0.82 * Math.min(1, Math.max(0, inGear)) * 0.85 + 0.15 * s.throttle * (s.grounded ? 1 : 1.4);
    if (g !== this.gear) {
      this.gear = g;
      this.rpm -= 0.18; // shift dip
    }
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 12);

    const f = 38 + 190 * this.rpm;
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.engineFilter.frequency.setTargetAtTime(380 + 2600 * (0.25 + 0.75 * s.throttle) * (0.4 + this.rpm), t, 0.05);
    this.engineLevel.gain.setTargetAtTime(0.06 + 0.16 * (0.35 + 0.65 * s.throttle), t, 0.05);

    const squeal = Math.max(0, s.slip - 0.85) * 2.2 * (s.grounded ? 1 : 0) * Math.min(1, s.speed / 12);
    this.squealGain.gain.setTargetAtTime(Math.min(0.35, squeal), t, 0.04);
    this.squealFilter.frequency.setTargetAtTime(1300 + 900 * Math.min(1, s.speed / 60), t, 0.1);
    const w = Math.pow(Math.min(1, s.speed / s.topSpeed), 2);
    this.windGain.gain.setTargetAtTime(0.02 + 0.55 * w, t, 0.1);
  }

  /** Landing / impact thud. intensity ~ m/s of velocity change. */
  thud(intensity: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const a = Math.min(1, intensity / 25);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9 * a, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.35);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5 * a, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(nf).connect(ng).connect(this.sfxGain);
    n.start(t);
    n.stop(t + 0.2);
  }

  /** Short UI blip for restart / respawn / menu. */
  blip(freq = 660, ms = 70): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + ms / 1000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000 + 0.05);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + ms / 1000 + 0.08);
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
