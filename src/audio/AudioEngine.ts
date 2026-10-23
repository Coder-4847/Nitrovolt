import { storage } from '../core/Storage';
import { SURFACES, SurfaceId } from '../physics/Surface';
import { Music, MusicMode } from './Music';

interface AudioSettings {
  master: number;
  engine: number;
  sfx: number;
  music: number;
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

/** How a car's engine sounds: all synthesised from two oscillators through a low-pass. */
export interface EngineVoice {
  /** Fundamental (Hz) at idle and the extra Hz added by full revs. */
  base: number;
  range: number;
  osc1: OscillatorType;
  osc2: OscillatorType;
  /** Second oscillator ratio to the fundamental (0.5 = sub-octave, 1.01 = detuned unison). */
  osc2Ratio: number;
  /** Low-pass cutoff at idle / full throttle-and-revs (Hz). */
  cutoffLo: number;
  cutoffHi: number;
  gain: number;
  gears: number;
  /** Wobble depth (fraction of frequency) for a buzzy small engine. */
  vibrato: number;
}

export const DEFAULT_VOICE: EngineVoice = {
  base: 38, range: 190, osc1: 'sawtooth', osc2: 'square', osc2Ratio: 0.5, cutoffLo: 380, cutoffHi: 2600, gain: 0.16, gears: 6, vibrato: 0,
};

export interface EngineState {
  speed: number; // m/s
  throttle: number; // 0..1
  /** Highest tyre slip usage among grounded wheels, 0..~1.2 */
  slip: number;
  grounded: boolean;
  topSpeed: number;
  /** Surface under the heaviest wheel (null in the air). */
  surface?: SurfaceId | null;
  /** Boost level 0..1 (turbo whistle). */
  boost?: number;
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
  private roadGain!: GainNode;
  private roadFilter!: BiquadFilterNode;
  private voice: EngineVoice = DEFAULT_VOICE;
  private vibPhase = 0;
  settings: AudioSettings = { master: 0.7, engine: 0.8, sfx: 0.9, music: 0.55, ...storage.get<Partial<AudioSettings>>(KEY, {}) };
  private musicGain!: GainNode;
  private music: Music | null = null;
  private musicTheme = 'neon';
  private musicMode: MusicMode = 'menu';
  private whistle!: OscillatorNode;
  private whistleGain!: GainNode;

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
    this.musicGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.music = new Music(ctx, this.musicGain, this.noise);
    this.music.setTheme(this.musicTheme);
    this.music.setMode(this.musicMode);

    // turbo whistle: a sine through a resonant band-pass, louder and higher with the boost
    this.whistle = ctx.createOscillator();
    this.whistle.type = 'sine';
    this.whistle.frequency.value = 1400;
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 2200;
    wbp.Q.value = 3;
    this.whistleGain = ctx.createGain();
    this.whistleGain.gain.value = 0;
    this.whistle.connect(wbp).connect(this.whistleGain).connect(this.sfxGain);
    this.whistle.start();

    // engine: two detuned saws + square sub through a low-pass
    this.osc1 = ctx.createOscillator();
    this.osc1.type = this.voice.osc1;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = this.voice.osc2;
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

    // road noise: crunch on loose ground, hiss on snow, hum on tarmac
    const rd = ctx.createBufferSource();
    rd.buffer = this.noise;
    rd.loop = true;
    this.roadFilter = ctx.createBiquadFilter();
    this.roadFilter.type = 'bandpass';
    this.roadFilter.frequency.value = 800;
    this.roadFilter.Q.value = 0.8;
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    rd.connect(this.roadFilter).connect(this.roadGain).connect(this.sfxGain);
    rd.start();

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

  /** Switch to a car's engine sound. */
  setVoice(v: EngineVoice): void {
    this.voice = v;
    this.gear = 0;
    if (this.ctx) {
      this.osc1.type = v.osc1;
      this.osc2.type = v.osc2;
    }
  }

  private engineOn = true;

  /** Mute / unmute the driving sounds (engine, road, wind) while a menu is the main thing on screen. */
  setDriving(on: boolean): void {
    this.engineOn = on;
    if (this.ctx) this.engineGain.gain.setTargetAtTime(on ? this.settings.engine : 0, this.ctx.currentTime, 0.15);
  }

  applySettings(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.engineGain.gain.value = this.engineOn ? this.settings.engine : 0;
    this.sfxGain.gain.value = this.settings.sfx;
    this.musicGain.gain.value = this.settings.music;
    storage.set(KEY, this.settings);
  }

  /** Per render-frame update. */
  update(s: EngineState, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    const voice = this.voice;
    // virtual gearbox over the speed range
    const frac = Math.min(1, s.speed / s.topSpeed);
    const gears = voice.gears;
    const g = Math.min(gears - 1, Math.floor(Math.pow(frac, 0.8) * gears));
    const lo = Math.pow(g / gears, 1 / 0.8), hi = Math.pow((g + 1) / gears, 1 / 0.8);
    const inGear = (frac - lo) / Math.max(hi - lo, 1e-3);
    const targetRpm = 0.18 + 0.82 * Math.min(1, Math.max(0, inGear)) * 0.85 + 0.15 * s.throttle * (s.grounded ? 1 : 1.4);
    if (g !== this.gear) {
      // up-shift under load: a dip in revs and a short mechanical click
      if (g > this.gear && s.throttle > 0.4 && s.grounded) this.shiftClick();
      this.gear = g;
      this.rpm -= 0.18; // shift dip
    }
    const boost = s.boost ?? 0;
    this.whistle.frequency.setTargetAtTime(1300 + 2200 * boost + 600 * (s.speed / s.topSpeed), t, 0.08);
    this.whistleGain.gain.setTargetAtTime(Math.min(0.12, boost * 0.12), t, 0.08);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 12);

    this.vibPhase += dt * 38;
    const f = (voice.base + voice.range * this.rpm) * (1 + Math.sin(this.vibPhase) * voice.vibrato);
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * voice.osc2Ratio, t, 0.03);
    this.engineFilter.frequency.setTargetAtTime(voice.cutoffLo + (voice.cutoffHi - voice.cutoffLo) * (0.25 + 0.75 * s.throttle) * (0.4 + this.rpm), t, 0.05);
    this.engineLevel.gain.setTargetAtTime((0.06 + voice.gain * (0.35 + 0.65 * s.throttle)) * (0.16 / 0.22), t, 0.05);

    const surf = s.surface ? SURFACES[s.surface] : null;
    const hard = !surf || !surf.loose;
    // tyre squeal only on hard ground; loose ground crunches instead
    const squeal = hard && s.surface !== 'ice' ? Math.max(0, s.slip - 0.85) * 2.2 * (s.grounded ? 1 : 0) * Math.min(1, s.speed / 12) : 0;
    this.squealGain.gain.setTargetAtTime(Math.min(0.35, squeal), t, 0.04);
    this.squealFilter.frequency.setTargetAtTime(1300 + 900 * Math.min(1, s.speed / 60), t, 0.1);
    let road = 0;
    let roadHz = 700;
    if (s.grounded && surf) {
      const sp = Math.min(1, s.speed / 40);
      if (surf.loose) {
        const snow = s.surface === 'snow';
        road = (snow ? 0.12 : 0.22) * sp * (0.6 + 0.6 * Math.min(1.2, s.slip));
        roadHz = snow ? 3200 : s.surface === 'sand' ? 1400 : 900;
      } else if (s.surface === 'ice') {
        road = 0.1 * sp * (0.4 + Math.min(1.2, s.slip));
        roadHz = 4200;
      } else {
        road = 0.06 * sp;
        roadHz = 260;
      }
    }
    this.roadGain.gain.setTargetAtTime(road, t, 0.06);
    this.roadFilter.frequency.setTargetAtTime(roadHz, t, 0.1);
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

  /** Countdown beep (beat 3, 2, 1) or the GO tone (beat 0). */
  countdown(beat: number): void {
    if (beat === 0) {
      this.tone(880, 0.35, 'square', 0.2);
      this.tone(1320, 0.35, 'triangle', 0.12);
    } else {
      this.tone(440, 0.14, 'square', 0.16);
    }
  }

  /** Checkpoint / lap chime. */
  chime(): void {
    this.tone(784, 0.12, 'triangle', 0.2);
    this.tone(1175, 0.22, 'triangle', 0.2, 0.09);
  }

  /** Finish fanfare. */
  fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.22, i * 0.1));
  }

  /** Gear change click. */
  private shiftClick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2600;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f).connect(g).connect(this.sfxGain);
    n.start(t, 0.3);
    n.stop(t + 0.06);
  }

  /** Soundtrack for a theme and situation (applied once audio is unlocked). */
  setMusic(theme: string, mode: MusicMode): void {
    this.musicTheme = theme;
    this.musicMode = mode;
    this.music?.setTheme(theme);
    this.music?.setMode(mode);
  }

  /** Finish / medal flourish on the music bus. */
  musicSting(rank: number): void {
    this.music?.sting(rank);
  }

  /** Menu focus tick. */
  tick(): void {
    this.tone(1400, 0.035, 'square', 0.04);
  }

  /** Menu confirm. */
  confirm(): void {
    this.tone(660, 0.07, 'triangle', 0.14);
    this.tone(990, 0.1, 'triangle', 0.12, 0.05);
  }

  /** Menu back. */
  back(): void {
    this.tone(520, 0.08, 'triangle', 0.12);
    this.tone(390, 0.1, 'triangle', 0.1, 0.05);
  }

  /** Medal earned: a rising arpeggio that gets longer and brighter with the tier (1 bronze .. 4 author). */
  medalJingle(rank: number): void {
    const scale = [523, 659, 784, 1047, 1319, 1568, 2093];
    const notes = Math.min(scale.length, 2 + rank);
    for (let i = 0; i < notes; i++) this.tone(scale[i]!, 0.3 + i * 0.03, 'triangle', 0.2, i * 0.085);
    this.tone(scale[notes - 1]! * 0.5, 0.7, 'sine', 0.16, notes * 0.085);
    if (rank >= 3) for (let i = 0; i < 5; i++) this.tone(2400 + i * 330, 0.12, 'sine', 0.06, 0.5 + i * 0.07);
  }

  /** Boost pad whoosh: rising filtered noise. */
  whoosh(strength = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3600, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.5 * strength, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    n.connect(f).connect(g).connect(this.sfxGain);
    n.start(t);
    n.stop(t + 0.85);
  }

  /** Fragile block shattering. */
  shatter(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    n.connect(f).connect(g).connect(this.sfxGain);
    n.start(t);
    n.stop(t + 0.4);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
