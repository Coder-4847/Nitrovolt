import { Vector3 } from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { PHYSICS_DT, FixedLoop } from './FixedLoop';
import { InputFrame, makeFrame } from './InputFrame';
import { InputRecorder } from './InputRecorder';
import { InputManager } from './input/InputManager';
import { storage } from './Storage';
import { RenderPose } from '../physics/Vehicle';
import { Simulation } from '../physics/Simulation';
import { VOLT, cloneParams } from '../physics/VehicleParams';
import { CameraMode } from '../render/CameraRig';
import { GameRenderer } from '../render/GameRenderer';
import { detectQuality } from '../render/Quality';
import { buildGreyboxTrack } from '../tracks/GreyboxTrack';
import { PathBot } from '../tracks/PathBot';
import { buildFlatPad } from '../tracks/TestTracks';
import { TrackData } from '../tracks/TrackTypes';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Hud } from '../ui/Hud';
import { SettingsMenu } from '../ui/SettingsMenu';
import { TouchControls } from '../ui/TouchControls';
import { TuningPanel } from '../ui/TuningPanel';

const CAMERA_LABEL: Record<CameraMode, string> = { chase: 'Chase cam', far: 'Far cam', hood: 'Hood cam' };

/** Wires input -> fixed-step simulation -> interpolated rendering, audio and UI. */
export class Game {
  private readonly loop: FixedLoop;
  private readonly recorder = new InputRecorder();
  private readonly pose: RenderPose;
  private lastFrame: InputFrame = makeFrame(0, 0, 0);
  private pendingRespawn = false;
  private paused = false;
  private lastRenderMs = 0;
  private readonly bot: PathBot | null;

  private constructor(
    private readonly sim: Simulation,
    private readonly gfx: GameRenderer,
    private readonly input: InputManager,
    private readonly audio: AudioEngine,
    private readonly hud: Hud,
    private readonly debug: DebugOverlay,
    private readonly tuning: TuningPanel | null,
    private readonly menu: SettingsMenu,
    track: TrackData,
    autodrive: boolean,
  ) {
    this.pose = sim.vehicle.curr;
    this.bot = autodrive ? new PathBot(track.centerline, track.centerSurface) : null;
    this.loop = new FixedLoop(
      () => this.step(),
      (alpha, dt) => this.render(alpha, dt),
    );
  }

  static async start(appRoot: HTMLElement, canvasHost: HTMLElement): Promise<Game> {
    const q = new URLSearchParams(location.search);
    const debug = q.get('debug') === '1';
    const track = q.get('track') === 'flat' ? buildFlatPad() : buildGreyboxTrack();
    const params = cloneParams(VOLT);

    const sim = await Simulation.create(track, params);
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
    });
    const tuning = debug ? new TuningPanel(appRoot, params, () => sim.vehicle.refreshParams()) : null;

    game = new Game(sim, gfx, input, audio, hud, dbg, tuning, menu, track, q.get('autodrive') === '1');
    if (debug) (window as unknown as { __nv: Game }).__nv = game;
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
    this.sim.events.length = 0;
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

  private step(): void {
    const v = this.sim.vehicle;
    let frame: InputFrame;
    if (this.bot) {
      frame = this.bot.drive(v);
      frame = makeFrame(frame.steer, frame.accel, frame.brake, this.pendingRespawn);
      // keep the keyboard latches fresh so keys pressed during autodrive do not pile up
      this.input.sample(PHYSICS_DT, v.speed);
    } else {
      const s = this.input.sample(PHYSICS_DT, v.speed);
      frame = makeFrame(s.steer, s.accel, s.brake, this.pendingRespawn);
    }
    if (frame.respawn) this.gfx.rig.snap();
    this.pendingRespawn = false;
    this.lastFrame = frame;
    this.recorder.push(frame);
    this.sim.step(frame);
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
      if (meta.restart) {
        this.sim.restart();
        this.recorder.clear();
        this.bot?.reset();
        this.gfx.rig.snap();
        this.pendingRespawn = false;
        this.audio.blip(520, 60);
      }
      if (meta.respawn) {
        this.pendingRespawn = true;
        this.audio.blip(380, 60);
      }
      if (meta.camera) this.hud.toast(CAMERA_LABEL[this.gfx.rig.cycle()]);
      if (meta.mouseSteerToggled) this.hud.toast(`Mouse steering ${this.input.mouseSteer ? 'on' : 'off'}`);
    }

    const v = this.sim.vehicle;
    v.interpolate(this.paused ? 1 : alpha, this.pose);

    // one-shot events accumulated over this frame's physics steps
    for (const e of this.sim.events) {
      if (e.type === 'landing') {
        this.gfx.rig.addShake(Math.min(1, e.intensity / 22));
        this.audio.thud(e.intensity);
        this.input.rumble(Math.min(1, e.intensity / 18), Math.min(1, e.intensity / 10), 120 + e.intensity * 6);
      } else if (e.type === 'impact') {
        this.gfx.rig.addShake(Math.min(1, e.intensity / 14));
        this.audio.thud(e.intensity * 1.4);
        this.input.rumble(0.9, 0.6, 160);
      }
    }
    this.sim.events.length = 0;

    this.gfx.render(dt, this.pose, v.linvel, v.speed);

    let slip = 0;
    for (const w of v.wheels) if (w.contact) slip = Math.max(slip, w.gripUse);
    this.audio.update(
      { speed: v.speed, throttle: this.lastFrame.accel, slip, grounded: v.wheelsOnGround > 0, topSpeed: v.params.topSpeed },
      dt,
    );
    this.hud.update(v.speed, v.params.topSpeed, this.sim.time);
    this.debug.update(dt, v, this.lastFrame, this.loop.lastStepMs, this.loop.lastStepCount, this.sim.tick);
    this.lastRenderMs = performance.now() - t0;
  }

  get renderMs(): number {
    return this.lastRenderMs;
  }

  /** Vector helper for tests. */
  get position(): Vector3 {
    return this.sim.vehicle.position;
  }
}
