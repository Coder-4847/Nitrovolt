import { Vector3 } from 'three';
import { CarDef } from '../data/cars';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { FreeCam, OrbitCam, ViewCam } from '../render/ReplayCameras';
import { TrackData } from '../tracks/TrackTypes';
import { h } from '../ui/dom';
import { formatTime } from '../ui/Hud';
import { GhostData, GhostPlayer, levelFingerprint } from './Ghost';
import { PHYSICS_DT } from './FixedLoop';
import { MetaActions } from './input/InputManager';
import { SessionCtx } from './RaceSession';
import { TrackJson } from '../tracks/TrackSchema';

type ReplayCam = 'chase' | 'far' | 'hood' | 'orbit' | 'free';
const CAMS: ReplayCam[] = ['chase', 'far', 'hood', 'orbit', 'free'];
const CAM_LABEL: Record<ReplayCam, string> = { chase: 'Chase', far: 'Far', hood: 'Hood', orbit: 'Orbit', free: 'Free' };
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];

export interface ReplaySource {
  track: TrackData;
  json?: TrackJson;
  def: CarDef;
  params: VehicleParams;
  data: GhostData;
  title: string;
}

/**
 * Replay viewer: re-simulates a recorded input stream (exact, same physics as the original run) with
 * play / pause, speed, scrubbing and cameras including a free fly camera.
 */
export class ReplaySession {
  paused = false;
  private readonly player: GhostPlayer;
  private readonly bar: HTMLElement;
  private readonly slider: HTMLInputElement;
  private readonly clock: HTMLElement;
  private readonly camBtn: HTMLButtonElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedBtns: HTMLButtonElement[] = [];
  private readonly pose: RenderPose;
  private readonly orbit = new OrbitCam();
  private readonly free = new FreeCam();
  private cam: ReplayCam = 'chase';
  private playing = true;
  private speed = 1;
  private acc = 0;
  private scrubbing = false;
  private disposed = false;
  private readonly savedMode: ReplayCam | 'chase' | 'far' | 'hood';
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat && e.code !== 'KeyJ' && e.code !== 'KeyL') return;
    switch (e.code) {
      case 'KeyK': this.togglePlay(); break;
      case 'KeyJ': this.skip(-3); break;
      case 'KeyL': this.skip(3); break;
      case 'BracketLeft': this.setSpeed(-1); break;
      case 'BracketRight': this.setSpeed(1); break;
      case 'KeyV': this.cycleCam(); break;
      case 'KeyR': this.seekTo(0); break;
      default:
    }
  };

  private constructor(
    private readonly ctx: SessionCtx,
    private readonly src: ReplaySource,
    player: GhostPlayer,
    private readonly onExit: () => void,
  ) {
    this.player = player;
    this.player.collect = true;
    this.savedMode = ctx.gfx.rig.mode;
    document.body.classList.add('has-replay');
    this.pose = { position: new Vector3(), quaternion: player.vehicle.curr.quaternion.clone(), springLen: [0, 0, 0, 0], steer: [0, 0, 0, 0], spin: [0, 0, 0, 0] };

    this.slider = h('input', { type: 'range', min: 0, max: player.totalTicks, step: 1, value: 0, class: 'rp-scrub', 'aria-label': 'Replay position' });
    this.clock = h('span', { class: 'rp-clock' }, '0:00.000');
    this.playBtn = h('button', { class: 'btn rp-play', type: 'button', onclick: () => this.togglePlay() }, '❚❚');
    this.camBtn = h('button', { class: 'btn', type: 'button', onclick: () => this.cycleCam() }, 'Camera: Chase');
    const speeds = h('span', { class: 'rp-speeds' });
    for (const s of SPEEDS) {
      const b = h('button', { class: `btn sm${s === 1 ? ' on' : ''}`, type: 'button', onclick: () => this.pickSpeed(s) }, `${s}×`);
      this.speedBtns.push(b);
      speeds.append(b);
    }
    this.bar = h(
      'div',
      { class: 'replay-bar' },
      h('div', { class: 'rp-top' },
        h('b', { class: 'rp-title' }, `REPLAY · ${src.title}`),
        h('span', { class: 'rp-help' }, 'K play/pause · J/L ±3 s · [ ] speed · V camera · R restart · Esc exit'),
      ),
      h('div', { class: 'rp-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => this.seekTo(0), title: 'Restart' }, '⏮'),
        h('button', { class: 'btn', type: 'button', onclick: () => this.skip(-3), title: 'Back 3 s' }, '−3 s'),
        this.playBtn,
        h('button', { class: 'btn', type: 'button', onclick: () => this.skip(3), title: 'Forward 3 s' }, '+3 s'),
        this.slider,
        this.clock,
      ),
      h('div', { class: 'rp-row' }, speeds, this.camBtn, h('button', { class: 'btn primary', type: 'button', onclick: () => this.onExit() }, 'Exit replay')),
    );
    ctx.hud.setVisible(true);
    (ctx.gfx.renderer.domElement.parentElement!.parentElement ?? document.body).appendChild(this.bar);

    this.slider.addEventListener('input', () => {
      this.scrubbing = true;
      this.preview(Number(this.slider.value));
    });
    this.slider.addEventListener('change', () => {
      this.scrubbing = false;
      this.seekTo(Number(this.slider.value));
    });
    window.addEventListener('keydown', this.onKey);
    this.applyCam();
  }

  static async create(ctx: SessionCtx, src: ReplaySource, onExit: () => void): Promise<ReplaySession> {
    const hash = src.json ? levelFingerprint(src.json.blocks, src.json.car, src.json.laps ?? 1) : '';
    const player = await GhostPlayer.create(src.track, src.params, src.def.behavior, src.data, hash);
    const s = new ReplaySession(ctx, src, player, onExit);
    s.seekTo(0);
    return s;
  }

  /** Leave the replay (the app decides where to go). */
  exit(): void {
    this.onExit();
  }

  get mode(): 'exact' | 'snapshot' {
    return this.player.mode;
  }

  get tick(): number {
    return this.player.currentTick;
  }

  step(): void {
    /* replay time is advanced per render frame, scaled by the speed control */
  }

  private togglePlay(): void {
    if (this.player.ended && this.player.currentTick >= this.player.totalTicks) {
      this.seekTo(0);
      this.playing = true;
    } else this.playing = !this.playing;
    this.playBtn.textContent = this.playing ? '❚❚' : '▶';
  }

  private pickSpeed(s: number): void {
    this.speed = s;
    SPEEDS.forEach((v, i) => this.speedBtns[i]!.classList.toggle('on', v === s));
  }

  private setSpeed(dir: number): void {
    const i = Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(this.speed) + dir));
    this.pickSpeed(SPEEDS[i]!);
  }

  private skip(seconds: number): void {
    this.seekTo(this.player.currentTick + Math.round(seconds / PHYSICS_DT));
  }

  private seekTo(tick: number): void {
    this.player.seek(tick);
    this.acc = 0;
    const { hud, gfx } = this.ctx;
    hud.clearSplits();
    gfx.trackView?.setBroken(this.player.world.broken);
    gfx.rig.snap();
    gfx.clearFx();
    this.slider.value = String(this.player.currentTick);
  }

  /** While dragging the scrubber: show the recorded snapshot path (instant), resimulate on release. */
  private preview(tick: number): void {
    this.player.poseAtTick(tick, this.pose);
  }

  private cycleCam(): void {
    this.cam = CAMS[(CAMS.indexOf(this.cam) + 1) % CAMS.length]!;
    this.applyCam();
  }

  private applyCam(): void {
    const { gfx } = this.ctx;
    const el = gfx.renderer.domElement;
    this.orbit.disable();
    this.free.disable();
    if (this.cam === 'orbit') {
      this.orbit.enable(el);
      gfx.viewCamera = this.orbit.camera;
    } else if (this.cam === 'free') {
      this.free.placeAt(gfx.rig.camera.position.clone(), this.pose.position.clone());
      this.free.enable(el);
      gfx.viewCamera = this.free.camera;
    } else {
      gfx.viewCamera = null;
      gfx.rig.mode = this.cam;
      gfx.rig.snap();
    }
    this.camBtn.textContent = `Camera: ${CAM_LABEL[this.cam]}`;
  }

  private handleEvents(): void {
    const { gfx, audio, hud } = this.ctx;
    const p = this.player;
    for (const e of p.events) {
      switch (e.type) {
        case 'checkpoint':
        case 'lap':
          hud.addSplit(e.type === 'lap' ? `LAP ${e.lap}` : `CP ${e.index + 1}`, e.time, null);
          gfx.trackView?.gates.flash(e.type === 'lap' ? 'finish' : 'checkpoint', e.type === 'lap' ? 0 : e.index);
          audio.chime();
          break;
        case 'finish':
          gfx.trackView?.gates.flash('finish');
          hud.toast(`Finish  ${formatTime(e.time)}`, 2200, 'good');
          audio.fanfare();
          break;
        case 'break':
          gfx.trackView?.setBroken(p.world.broken);
          audio.shatter();
          break;
        case 'landing':
          gfx.rig.addShake(Math.min(1, e.intensity / 22));
          gfx.landingBurst(p.vehicle, e.intensity);
          audio.thud(e.intensity);
          break;
        case 'impact':
          gfx.rig.addShake(Math.min(1, e.intensity / 14));
          gfx.impactBurst(p.vehicle, e.intensity);
          audio.thud(e.intensity * 1.4);
          break;
        case 'bottomOut':
          if (e.intensity > 4) gfx.scrapeBurst(p.vehicle, e.intensity);
          break;
        default:
      }
    }
    p.events.length = 0;
  }

  render(_alpha: number, dt: number, meta: MetaActions): void {
    const { gfx, hud, audio, debug } = this.ctx;
    const p = this.player;
    if (meta.camera) this.cycleCam();
    const v = p.vehicle;
    if (!this.paused && this.playing && !this.scrubbing && !p.ended) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= PHYSICS_DT && !p.ended && n++ < 60) {
        this.acc -= PHYSICS_DT;
        p.step();
      }
      if (p.ended) {
        this.acc = 0;
        this.playing = false;
        this.playBtn.textContent = '▶';
      }
    }
    if (!this.scrubbing) p.pose(p.ended ? 1 : this.acc / PHYSICS_DT, this.pose);
    this.handleEvents();

    if (!this.scrubbing || this.cam === 'chase') this.slider.value = String(p.currentTick);
    const ms = (p.currentTick + this.acc / PHYSICS_DT) * PHYSICS_DT * 1000;
    const total = this.src.data.time;
    this.clock.textContent = `${formatTime(Math.min(ms, total))} / ${formatTime(total)}`;

    if (this.cam === 'orbit') this.orbit.update(dt, this.pose.position);
    else if (this.cam === 'free') this.free.update(dt, this.pose.position);

    const mods = v.effects.mods;
    if (!this.paused) gfx.updateFx(dt * (this.playing ? this.speed : 0), v);
    gfx.setDrive(this.scrubbing ? 0 : v.appliedInput.brake, mods.boostLevel);
    gfx.render(dt, this.pose, v.linvel, v.speed, mods.boostLevel);
    audio.update({ speed: this.playing ? v.speed : 0, throttle: 0.4, slip: 0, grounded: v.wheelsOnGround > 0, topSpeed: v.params.topSpeed, surface: v.dominantSurface(), boost: v.effects.mods.boostLevel }, dt);
    hud.update(v.speed, v.params.topSpeed, Math.min(ms, total), mods.boostLevel);
    hud.setEffects(mods.active);
    debug.update(dt, v, { steer: 0, accel: 0, brake: 0 }, 0, 0, p.currentTick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.onKey);
    this.orbit.disable();
    this.free.disable();
    this.bar.remove();
    this.ctx.gfx.viewCamera = null;
    this.ctx.gfx.rig.mode = this.savedMode as 'chase' | 'far' | 'hood';
    this.ctx.gfx.rig.snap();
    document.body.classList.remove('has-replay');
    this.player.dispose();
  }
}

export type { ViewCam };
