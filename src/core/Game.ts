import { AudioEngine } from '../audio/AudioEngine';
import { LEVELS, DEFAULT_LEVEL_ID, getLevel } from '../data';
import { Simulation, SimulationEvent } from '../physics/Simulation';
import { RenderPose } from '../physics/Vehicle';
import { VOLT, cloneParams } from '../physics/VehicleParams';
import { CameraMode } from '../render/CameraRig';
import { GameRenderer } from '../render/GameRenderer';
import { detectQuality } from '../render/Quality';
import { buildGreyboxTrack } from '../tracks/GreyboxTrack';
import { PathBot } from '../tracks/PathBot';
import { buildTrack } from '../tracks/TrackGenerator';
import { buildFlatPad } from '../tracks/TestTracks';
import { TrackData } from '../tracks/TrackTypes';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Hud } from '../ui/Hud';
import { COUNTDOWN_SECONDS, CountdownMode, SettingsMenu } from '../ui/SettingsMenu';
import { TouchControls } from '../ui/TouchControls';
import { TuningPanel } from '../ui/TuningPanel';
import { PHYSICS_DT, FixedLoop } from './FixedLoop';
import { InputFrame, makeFrame } from './InputFrame';
import { InputRecorder } from './InputRecorder';
import { InputManager } from './input/InputManager';
import { medalFor } from './Medals';
import { PersonalBest, Records } from './Records';
import { storage } from './Storage';

const CAMERA_LABEL: { [K in CameraMode]: string } = { chase: 'Chase cam', far: 'Far cam', hood: 'Hood cam' };

/** Wires input -> fixed-step simulation -> interpolated rendering, audio, run rules and UI. */
export class Game {
  private readonly loop: FixedLoop;
  private readonly recorder = new InputRecorder();
  private readonly pose: RenderPose;
  private lastFrame: InputFrame = makeFrame(0, 0, 0);
  private pendingRespawn = false;
  private paused = false;
  private lastRenderMs = 0;
  private readonly bot: PathBot | null;
  /** Personal best at the start of the current attempt (deltas compare against this). */
  private pb: PersonalBest | undefined;
  private prevBoost = false;

  private constructor(
    private readonly sim: Simulation,
    private readonly gfx: GameRenderer,
    private readonly input: InputManager,
    private readonly audio: AudioEngine,
    private readonly hud: Hud,
    private readonly debug: DebugOverlay,
    private readonly tuning: TuningPanel | null,
    private readonly menu: SettingsMenu,
    private readonly track: TrackData,
    autodrive: boolean,
  ) {
    this.pose = sim.vehicle.curr;
    this.bot = autodrive ? new PathBot(track.centerline, track.centerSurface, track.laps > 1) : null;
    this.pb = Records.get(track.id);
    this.hud.setTitle(track.name);
    this.loop = new FixedLoop(
      () => this.step(),
      (alpha, dt) => this.render(alpha, dt),
    );
  }

  static async start(appRoot: HTMLElement, canvasHost: HTMLElement): Promise<Game> {
    const q = new URLSearchParams(location.search);
    const debug = q.get('debug') === '1';
    const dev = q.get('track');
    const levelId = q.get('level') ?? DEFAULT_LEVEL_ID;
    const track: TrackData =
      dev === 'flat' ? buildFlatPad() : dev === 'greybox' ? buildGreyboxTrack() : buildTrack(getLevel(levelId) ?? getLevel(DEFAULT_LEVEL_ID)!);
    const params = cloneParams(VOLT);
    const cdMode = storage.get<CountdownMode>('nitrovolt.countdown', 'quick');

    const sim = await Simulation.create(track, params, dev ? 0 : COUNTDOWN_SECONDS[cdMode]);
    const gfx = new GameRenderer(canvasHost, params, detectQuality());
    gfx.setTrack(track);
    gfx.speedFxEnabled = storage.get<boolean>('nitrovolt.speedFx', true);
    gfx.rig.reducedMotion = storage.get<boolean>('nitrovolt.reducedMotion', false);

    const input = new InputManager();
    const audio = new AudioEngine();
    const hud = new Hud(appRoot, input);
    const dbg = new DebugOverlay(appRoot, debug);
    new TouchControls(appRoot, input.touch);

    let game: Game | null = null;
    const menu = new SettingsMenu(appRoot, input, audio, gfx, {
      onToggle: (open) => game?.setPaused(open),
      toast: (m) => hud.toast(m),
      levels: LEVELS.map((l) => ({ id: l.id, name: l.name })),
      currentLevel: dev ? '' : track.id,
      onCountdown: (mode) => {
        sim.countdownSeconds = COUNTDOWN_SECONDS[mode];
        hud.toast(`Countdown: ${mode}`);
      },
    });
    const tuning = debug ? new TuningPanel(appRoot, params, () => sim.vehicle.refreshParams()) : null;

    game = new Game(sim, gfx, input, audio, hud, dbg, tuning, menu, track, q.get('autodrive') === '1');
    if (debug) (window as unknown as { __nv: Game }).__nv = game;
    game.afterRestart();
    game.loop.start();
    return game;
  }

  // ---- debug/test hooks ----
  get simulation(): Simulation {
    return this.sim;
  }
  get renderer(): GameRenderer {
    return this.gfx;
  }

  /** Dev only: run the autodrive bot forward without rendering. */
  fastForward(seconds: number): void {
    for (let i = 0; i < seconds / PHYSICS_DT; i++) this.step();
    this.handleEvents();
    this.gfx.rig.snap();
  }

  /** Dev only: overview camera for screenshots. */
  view(pos: [number, number, number] | null, target?: [number, number, number], fov?: number): void {
    this.gfx.debugView(pos, target, fov);
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.loop.timeScale = p ? 0 : 1;
    this.audio.setPaused(p);
  }

  private restart(): void {
    this.sim.restart();
    this.recorder.clear();
    this.bot?.reset();
    this.pendingRespawn = false;
    this.afterRestart();
    this.audio.blip(520, 60);
  }

  private afterRestart(): void {
    this.gfx.rig.snap();
    this.gfx.trackView?.setBroken(new Set());
    this.hud.clearSplits();
    this.hud.hideFinish();
    this.hud.setProgress(0, this.sim.run.checkpointCount, 0, this.track.laps);
    this.pb = Records.get(this.track.id);
    this.prevBoost = false;
    this.handleEvents(); // the initial countdown beat
  }

  private step(): void {
    const v = this.sim.vehicle;
    let frame: InputFrame;
    if (this.bot) {
      const b = this.bot.drive(v);
      frame = makeFrame(b.steer, b.accel, b.brake, this.pendingRespawn);
      this.input.sample(PHYSICS_DT, v.speed); // keep keyboard latches fresh
    } else {
      const s = this.input.sample(PHYSICS_DT, v.speed);
      frame = makeFrame(s.steer, s.accel, s.brake, this.pendingRespawn);
    }
    if (frame.respawn && !this.sim.run.locked) this.gfx.rig.snap();
    this.pendingRespawn = false;
    this.lastFrame = frame;
    this.recorder.push(frame);
    this.sim.step(frame);
  }

  private label(index: number): string {
    return `CP ${index + 1}`;
  }

  private handleEvents(): void {
    const run = this.sim.run;
    for (const e of this.sim.events as SimulationEvent[]) {
      switch (e.type) {
        case 'countdown':
          this.hud.setCountdown(run.state === 'countdown' || e.beat === 0 ? e.beat : null);
          if (run.state === 'countdown' || e.beat === 0) this.audio.countdown(e.beat);
          if (e.beat === 0) this.input.rumble(0.3, 0.3, 80);
          break;
        case 'checkpoint':
        case 'lap': {
          const prev = this.pb?.splits[e.splitIndex];
          const delta = prev === undefined ? null : e.time - prev;
          this.hud.addSplit(e.type === 'lap' ? `LAP ${e.lap}` : this.label(e.index), e.time, delta);
          this.hud.setProgress(run.nextCp, run.checkpointCount, run.lap, this.track.laps);
          this.audio.chime();
          break;
        }
        case 'finish': {
          const prev = this.pb;
          const delta = prev ? e.time - prev.best : null;
          const newBest = Records.submit(this.track.id, e.time, run.splits);
          this.hud.showFinish(
            { time: e.time, delta, newBest, medal: medalFor(e.time, this.track.medals), respawns: this.sim.respawnCount },
            this.input.bindings.keyboard.restart[0] === 'Enter' ? 'Enter' : 'restart',
          );
          this.audio.fanfare();
          this.input.rumble(0.6, 0.8, 300);
          break;
        }
        case 'break':
          this.gfx.trackView?.setBroken(this.sim.world.broken);
          this.audio.shatter();
          this.gfx.rig.addShake(0.3);
          break;
        case 'landing':
          this.gfx.rig.addShake(Math.min(1, e.intensity / 22));
          this.audio.thud(e.intensity);
          this.input.rumble(Math.min(1, e.intensity / 18), Math.min(1, e.intensity / 10), 120 + e.intensity * 6);
          break;
        case 'impact':
          this.gfx.rig.addShake(Math.min(1, e.intensity / 14));
          this.audio.thud(e.intensity * 1.4);
          this.input.rumble(0.9, 0.6, 160);
          break;
        default:
          break;
      }
    }
    this.sim.events.length = 0;
  }

  private render(alpha: number, dt: number): void {
    const t0 = performance.now();
    const meta = this.input.pollMeta();
    if (meta.pause) this.menu.toggle();
    if (meta.debug) {
      const on = this.debug.toggle();
      this.tuning?.toggle();
      this.hud.toast(`Debug HUD ${on ? 'on' : 'off'}`);
    }
    if (!this.paused) {
      if (meta.restart) this.restart();
      if (meta.respawn && !this.sim.run.locked && this.sim.run.state === 'running') {
        this.pendingRespawn = true;
        this.audio.blip(380, 60);
      }
      if (meta.camera) this.hud.toast(CAMERA_LABEL[this.gfx.rig.cycle()]);
      if (meta.mouseSteerToggled) this.hud.toast(`Mouse steering ${this.input.mouseSteer ? 'on' : 'off'}`);
    }

    const v = this.sim.vehicle;
    v.interpolate(this.paused ? 1 : alpha, this.pose);
    this.handleEvents();

    const mods = v.effects.mods;
    const boosting = mods.boostLevel > 0.15;
    if (boosting && !this.prevBoost) {
      this.audio.whoosh(mods.boostLevel);
      this.input.rumble(0.4, 0.9, 200);
      this.gfx.rig.addShake(0.25);
    }
    this.prevBoost = boosting;

    this.gfx.render(dt, this.pose, v.linvel, v.speed, mods.boostLevel);

    let slip = 0;
    for (const w of v.wheels) if (w.contact) slip = Math.max(slip, w.gripUse);
    this.audio.update(
      { speed: v.speed, throttle: this.lastFrame.accel, slip, grounded: v.wheelsOnGround > 0, topSpeed: v.params.topSpeed },
      dt,
    );

    const run = this.sim.run;
    // clock matching the interpolated car state: between tick-1 and tick
    const runMs = run.state === 'running' ? Math.max(0, (run.tick - 1 + (this.paused ? 1 : alpha) - run.goTick) * PHYSICS_DT * 1000) : run.timeMs;
    this.hud.update(v.speed, v.params.topSpeed, runMs, mods.boostLevel);
    this.hud.setEffects(mods.active);
    this.debug.update(dt, v, this.lastFrame, this.loop.lastStepMs, this.loop.lastStepCount, this.sim.tick);
    this.lastRenderMs = performance.now() - t0;
  }

  get renderMs(): number {
    return this.lastRenderMs;
  }
}
