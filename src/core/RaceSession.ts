import { Quaternion, Vector3 } from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { CarDef } from '../data/cars';
import { CampaignState } from '../data/campaign';
import { PHYSICS_DT } from './FixedLoop';
import { Simulation, SimulationEvent } from '../physics/Simulation';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams, cloneParams } from '../physics/VehicleParams';
import { CameraMode } from '../render/CameraRig';
import { CarView } from '../render/CarView';
import { GameRenderer } from '../render/GameRenderer';
import { PathBot, applyBotHints } from '../tracks/PathBot';
import { BotHints, TrackJson } from '../tracks/TrackSchema';
import { TrackData } from '../tracks/TrackTypes';
import { DebugOverlay } from '../ui/DebugOverlay';
import { FinishAction, Hud } from '../ui/Hud';
import { GhostData, GhostPlayer, GhostRecorder, levelFingerprint } from './Ghost';
import { GhostStore, authorGhost } from './GhostStore';
import { InputFrame, makeFrame } from './InputFrame';
import { InputManager, MetaActions } from './input/InputManager';
import { medalFor, medalRank } from './Medals';
import { PersonalBest, Records } from './Records';
import { COUNTDOWN_SECONDS, GhostShow, Settings } from './Settings';

const CAMERA_LABEL: { [K in CameraMode]: string } = { chase: 'Chase cam', far: 'Far cam', hood: 'Hood cam' };
export const GHOST_CYCLE: GhostShow[] = ['pb', 'author', 'both', 'off'];
const GHOST_LABEL: Record<GhostShow, string> = { pb: 'Ghost: personal best', author: 'Ghost: author', both: 'Ghosts: PB + author', off: 'Ghosts off' };
const GHOST_COLOR = { pb: 0xa9d6ff, author: 0xb4f0c8 };

export interface SessionCtx {
  gfx: GameRenderer;
  input: InputManager;
  audio: AudioEngine;
  hud: Hud;
  debug: DebugOverlay;
  /** Campaign progress right now (read before and after a finish to see what it unlocked). */
  campaign(): CampaignState;
  /** Physics loop timings for the debug overlay. */
  loopStats(): { stepMs: number; steps: number };
  /** Buttons for the finish panel. */
  finishActions(session: RaceSession): FinishAction[];
}

export interface RaceSource {
  track: TrackData;
  /** The level JSON, or undefined for dev tracks (no ghosts, records still kept). */
  json?: TrackJson;
  def: CarDef;
  params: VehicleParams;
  /** Records key (player levels: id + layout hash, so an edited track starts a fresh record). */
  recordId?: string;
}

export interface RaceOptions {
  autodrive?: boolean;
  /** Skip the countdown (dev flags / tools). */
  instant?: boolean;
  hints?: BotHints;
}

const blankPose = (): RenderPose => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  springLen: [0, 0, 0, 0],
  steer: [0, 0, 0, 0],
  spin: [0, 0, 0, 0],
});

type Phase = 'grid' | 'running' | 'finished';

interface GhostSlot {
  kind: 'pb' | 'author';
  player: GhostPlayer;
  view: CarView;
  pose: RenderPose;
}

/** One attempt-after-attempt session on a level: countdown, driving, ghosts, records and the finish flow. */
export class RaceSession {
  readonly sim: Simulation;
  private readonly sight = (o: Vector3, d: Vector3, max: number): number | null => this.sim.vehicle.sightDistance(o, d, max);
  readonly track: TrackData;
  readonly def: CarDef;
  paused = false;
  phase: Phase = 'grid';
  /** The most recent finished run (what "Watch replay" plays), whether or not it was a personal best. */
  lastRun: GhostData | null = null;

  private readonly ctx: SessionCtx;
  private readonly source: RaceSource;
  private readonly recorder = new GhostRecorder();
  readonly levelHash: string;
  private readonly recordId: string;
  private readonly bot: PathBot | null;
  private readonly pose: RenderPose;
  private ghosts: GhostSlot[] = [];
  private waiting: GhostSlot[] | null = null;
  private ghostGen = 0;
  private lastFrame: InputFrame = makeFrame(0, 0, 0);
  private pendingRespawn = false;
  private pendingRun: GhostData | null = null;
  private finishRespawns = 0;
  private pb: PersonalBest | undefined;
  private prevBoost = false;
  private cdTick = 0;
  private cdTotal = 0;
  private cdBeats = [0, 0, 0];
  private lastRenderMs = 0;
  private disposed = false;

  private constructor(ctx: SessionCtx, source: RaceSource, sim: Simulation, opts: RaceOptions) {
    this.ctx = ctx;
    this.source = source;
    this.sim = sim;
    this.track = source.track;
    this.def = source.def;
    this.pose = sim.vehicle.curr;
    this.instant = !!opts.instant;
    this.levelHash = source.json ? levelFingerprint(source.json.blocks, source.json.car, source.json.laps ?? 1) : '';
    this.recordId = source.recordId ?? source.track.id;
    this.bot = opts.autodrive ? new PathBot(this.track.centerline, this.track.centerSurface, this.track.laps > 1, source.params, this.track.centerFrame) : null;
    if (this.bot) applyBotHints(this.bot, opts.hints);
  }

  private readonly instant: boolean;

  static async create(ctx: SessionCtx, source: RaceSource, opts: RaceOptions = {}): Promise<RaceSession> {
    const sim = await Simulation.create(source.track, source.params, true, undefined, source.def.behavior, source.def.id);
    const s = new RaceSession(ctx, source, sim, opts);
    await s.loadGhosts();
    s.restart(false);
    return s;
  }

  // ---- dev / test hooks ----
  /** Dev only: run the autodrive bot forward without rendering. */
  fastForward(seconds: number): void {
    for (let i = 0; i < seconds / PHYSICS_DT; i++) this.step();
    this.handleEvents();
    this.ctx.gfx.rig.snap();
  }

  get renderMs(): number {
    return this.lastRenderMs;
  }

  get ghostCount(): number {
    return this.ghosts.length;
  }

  get levelId(): string {
    return this.track.id;
  }

  // ---- lifecycle ----
  restart(sound = true): void {
    const { gfx, hud } = this.ctx;
    const seconds = this.instant ? 0 : COUNTDOWN_SECONDS[Settings.get().countdown];
    if (this.waiting) this.installGhosts(this.waiting);
    this.sim.hold = seconds > 0;
    this.sim.restart();
    for (const g of this.ghosts) g.player.reset();
    this.bot?.reset();
    this.pendingRespawn = false;
    this.pendingRun = null;
    this.cdTick = 0;
    this.cdTotal = Math.round(seconds * 100);
    this.cdBeats = [0, 1, 2].map((i) => Math.round((i * this.cdTotal) / 3));
    this.phase = seconds > 0 ? 'grid' : 'running';
    if (this.phase === 'running') this.go();
    gfx.rig.snap();
    gfx.trackView?.setBroken(new Set());
    gfx.clearFx();
    hud.clearSplits();
    hud.hideFinish();
    hud.setCountdown(null);
    hud.setProgress(0, this.sim.run.checkpointCount, 0, this.track.laps);
    hud.setTitle(`${this.track.name} · ${this.def.label}`);
    this.pb = Records.get(this.recordId);
    hud.setTargets(this.pb?.best ?? null, this.track.medals);
    this.prevBoost = false;
    this.sim.events.length = 0;
    if (this.phase === 'grid') this.beat(3);
    if (sound) this.ctx.audio.blip(520, 60);
  }

  private go(): void {
    if (this.sim.run.locked) this.sim.go();
    this.recorder.start(this.sim);
    for (const g of this.ghosts) g.player.go();
    this.phase = 'running';
  }

  private beat(n: number): void {
    this.ctx.hud.setCountdown(n);
    this.ctx.audio.countdown(n);
    if (n === 0) this.ctx.input.rumble(0.3, 0.3, 80);
  }

  /** Show / hide the ghost cars (hidden while a replay is on screen). */
  setGhostsVisible(v: boolean): void {
    for (const g of this.ghosts) {
      g.view.ghostShown = v;
      g.view.root.visible = v;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.ghostGen++;
    this.clearGhosts();
    this.sim.dispose();
  }

  // ---- ghosts ----
  private clearGhosts(): void {
    for (const list of [this.ghosts, this.waiting ?? []]) {
      for (const g of list) {
        this.ctx.gfx.removeGhost(g.view);
        g.player.dispose();
      }
    }
    this.ghosts = [];
    this.waiting = null;
  }

  private installGhosts(slots: GhostSlot[]): void {
    for (const g of this.ghosts) {
      this.ctx.gfx.removeGhost(g.view);
      g.player.dispose();
    }
    this.ghosts = slots;
    this.waiting = null;
  }

  /** (Re)load the ghosts the settings ask for. They join immediately unless a run is in progress. */
  async loadGhosts(): Promise<void> {
    const gen = ++this.ghostGen;
    const show = Settings.get().ghosts;
    const wanted: Array<'pb' | 'author'> = show === 'pb' ? ['pb'] : show === 'author' ? ['author'] : show === 'both' ? ['pb', 'author'] : [];
    const slots: GhostSlot[] = [];
    if (this.source.json && wanted.length) {
      for (const kind of wanted) {
        const data = kind === 'pb' ? await GhostStore.load(this.track.id) : await authorGhost(this.track.id);
        // a ghost of another layout (an edited player level) would drive through thin air
        if (!data || data.carId !== this.def.id || data.levelHash !== this.levelHash) continue;
        const player = await GhostPlayer.create(this.track, cloneParams(this.source.params), this.def.behavior, data, this.levelHash);
        slots.push({ kind, player, view: this.ctx.gfx.addGhost(this.source.params, this.def.id, GHOST_COLOR[kind]), pose: blankPose() });
      }
    }
    if (this.disposed || gen !== this.ghostGen) {
      for (const g of slots) {
        this.ctx.gfx.removeGhost(g.view);
        g.player.dispose();
      }
      return;
    }
    if (this.phase === 'running') {
      this.waiting = slots; // joins at the next restart so it never starts mid-run
      return;
    }
    this.installGhosts(slots);
  }

  cycleGhosts(): void {
    const cur = Settings.get().ghosts;
    const next = GHOST_CYCLE[(GHOST_CYCLE.indexOf(cur) + 1) % GHOST_CYCLE.length]!;
    Settings.set('ghosts', next);
    this.ctx.hud.toast(GHOST_LABEL[next], 1500); // the app reloads the ghosts when the setting changes
  }

  // ---- simulation ----
  step(): void {
    if (this.paused) return;
    const { input } = this.ctx;
    const v = this.sim.vehicle;
    if (this.phase === 'grid') {
      this.cdTick++;
      const i = this.cdBeats.indexOf(this.cdTick);
      if (i >= 0 && this.cdTick < this.cdTotal) this.beat(3 - i);
      if (this.cdTick >= this.cdTotal) {
        this.go();
        this.beat(0);
      }
      input.sample(PHYSICS_DT, v.speed); // keep the keyboard ramps fresh
      return;
    }
    let frame: InputFrame;
    if (this.bot) {
      const b = this.bot.drive(v);
      frame = makeFrame(b.steer, b.accel, b.brake, this.pendingRespawn);
      input.sample(PHYSICS_DT, v.speed);
    } else {
      const s = input.sample(PHYSICS_DT, v.speed);
      frame = makeFrame(s.steer, s.accel, s.brake, this.pendingRespawn);
    }
    if (frame.respawn && !this.sim.run.locked) this.ctx.gfx.rig.snap();
    this.pendingRespawn = false;
    this.lastFrame = frame;
    const recording = this.phase === 'running';
    if (recording) this.recorder.push(frame);
    this.sim.step(frame);
    if (recording) this.recorder.afterStep(this.sim);
    for (const g of this.ghosts) g.player.step();
    if (recording && this.sim.run.state === 'finished') {
      this.phase = 'finished';
      this.finishRespawns = this.sim.respawnCount;
      this.pendingRun = this.recorder.finish(this.sim, { trackId: this.track.id, carId: this.def.id, levelHash: this.levelHash });
    }
  }

  // ---- events -> UI / audio ----
  private handleEvents(): void {
    const { hud, audio, gfx, input } = this.ctx;
    const run = this.sim.run;
    for (const e of this.sim.events as SimulationEvent[]) {
      switch (e.type) {
        case 'checkpoint':
        case 'lap': {
          const prev = this.pb?.splits[e.splitIndex];
          const delta = prev === undefined ? null : e.time - prev;
          hud.addSplit(e.type === 'lap' ? `LAP ${e.lap}` : `CP ${e.index + 1}`, e.time, delta);
          gfx.trackView?.gates.flash(e.type === 'lap' ? 'finish' : 'checkpoint', e.type === 'lap' ? 0 : e.index);
          hud.setProgress(run.nextCp, run.checkpointCount, run.lap, this.track.laps);
          audio.chime();
          break;
        }
        case 'finish':
          gfx.trackView?.gates.flash('finish');
          this.finish(e.time);
          break;
        case 'break':
          gfx.trackView?.setBroken(this.sim.world.broken);
          audio.shatter();
          gfx.rig.addShake(0.3);
          break;
        case 'landing':
          gfx.rig.addShake(Math.min(1, e.intensity / 22));
          gfx.landingBurst(this.sim.vehicle, e.intensity);
          audio.thud(e.intensity);
          input.rumble(Math.min(1, e.intensity / 18), Math.min(1, e.intensity / 10), 120 + e.intensity * 6);
          break;
        case 'impact':
          gfx.rig.addShake(Math.min(1, e.intensity / 14));
          gfx.impactBurst(this.sim.vehicle, e.intensity);
          audio.thud(e.intensity * 1.4);
          input.rumble(0.9, 0.6, 160);
          break;
        case 'bottomOut':
          if (e.intensity > 4) gfx.scrapeBurst(this.sim.vehicle, e.intensity);
          break;
        default:
          break;
      }
    }
    this.sim.events.length = 0;
  }

  private finish(time: number): void {
    const { hud, audio, input } = this.ctx;
    const id = this.recordId;
    const before = this.ctx.campaign();
    const prevMedal = Records.medal(id, this.track.medals);
    const delta = this.pb ? time - this.pb.best : null;
    const newBest = Records.submit(id, time, this.sim.run.splits);
    const medal = medalFor(time, this.track.medals);
    const medalEarned = medalRank(medal) > medalRank(prevMedal);
    const after = this.ctx.campaign();
    const unlocked = after.levels
      .filter((l, i) => l.unlocked && !before.levels[i]!.unlocked && l.entry.levelId)
      .map((l) => this.nameOf(l.entry.levelId!));
    if (this.pendingRun) {
      this.lastRun = this.pendingRun;
      if (newBest && this.source.json) {
        const run = this.pendingRun;
        void GhostStore.save(run).then(() => (Settings.get().ghosts === 'pb' || Settings.get().ghosts === 'both' ? this.loadGhosts() : undefined));
      }
    }
    hud.showFinish({ time, delta, newBest, medal, medalEarned, respawns: this.finishRespawns, unlocked }, this.ctx.finishActions(this));
    audio.fanfare();
    audio.musicSting(medalRank(medal));
    if (medalEarned) setTimeout(() => audio.medalJingle(medalRank(medal)), 500);
    input.rumble(0.6, 0.8, 300);
  }

  /** Display name for the "unlocked" notice (set by the app). */
  nameOf: (id: string) => string = (id) => id;

  // ---- per-frame ----
  render(alpha: number, dt: number, meta: MetaActions): void {
    const t0 = performance.now();
    const { gfx, hud, audio, input, debug } = this.ctx;
    if (!this.paused) {
      if (meta.restart) this.restart();
      if (meta.respawn && this.phase === 'running') {
        this.pendingRespawn = true;
        audio.blip(380, 60);
      }
      if (meta.camera) hud.toast(CAMERA_LABEL[gfx.rig.cycle()]);
      if (meta.mouseSteerToggled) hud.toast(`Mouse steering ${input.mouseSteer ? 'on' : 'off'}`);
    }

    const v = this.sim.vehicle;
    const a = this.paused ? 1 : alpha;
    v.interpolate(a, this.pose);
    this.handleEvents();

    const mods = v.effects.mods;
    const boosting = mods.boostLevel > 0.15;
    if (boosting && !this.prevBoost) {
      audio.whoosh(mods.boostLevel);
      input.rumble(0.4, 0.9, 200);
      gfx.rig.addShake(0.25);
    }
    this.prevBoost = boosting;

    for (const g of this.ghosts) {
      g.player.pose(a, g.pose);
      g.view.update(g.pose);
    }
    if (!this.paused) gfx.updateFx(dt, v);
    gfx.setDrive(this.phase === 'grid' ? 0 : v.appliedInput.brake, mods.boostLevel);
    gfx.sightProbe = this.sight;
    gfx.render(dt, this.pose, v.linvel, v.speed, mods.boostLevel);

    let slip = 0;
    for (const w of v.wheels) if (w.contact) slip = Math.max(slip, w.gripUse);
    audio.update(
      { speed: v.speed, throttle: this.lastFrame.accel, slip, grounded: v.wheelsOnGround > 0, topSpeed: v.params.topSpeed, surface: v.dominantSurface(), boost: mods.boostLevel },
      dt,
    );

    const run = this.sim.run;
    // clock matching the interpolated car state: between tick-1 and tick
    const runMs = run.state === 'running' ? Math.max(0, (run.tick - 1 + a) * PHYSICS_DT * 1000) : run.state === 'finished' ? (run.finishTime ?? run.timeMs) : 0;
    hud.update(v.speed, v.params.topSpeed, runMs, mods.boostLevel);
    hud.setEffects(mods.active);
    const ls = this.ctx.loopStats();
    const fs = gfx.frameStats;
    debug.update(dt, v, this.lastFrame, ls.stepMs, ls.steps, this.sim.tick, `gfx ${gfx.qualityLevel} x${fs.scale.toFixed(2)}  ${fs.calls} calls  ${(fs.triangles / 1000).toFixed(0)}k tris`);
    this.lastRenderMs = performance.now() - t0;
  }
}
