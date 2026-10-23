import { PerspectiveCamera, Vector3 } from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { CampaignState, computeCampaign, nextAvailable } from '../data/campaign';
import { CarDef, carParams, getCar } from '../data/cars';
import { DEFAULT_LEVEL_ID, LEVELS, getLevel } from '../data';
import { RenderPose } from '../physics/Vehicle';
import { VehicleParams } from '../physics/VehicleParams';
import { GameRenderer } from '../render/GameRenderer';
import { QualityChoice, benchmarkStep, detectQuality, isTouchDevice, loadQualityChoice, saveQuality } from '../render/Quality';
import { levelThumbnail } from '../render/Thumbnail';
import { buildGreyboxTrack } from '../tracks/GreyboxTrack';
import { TrackJson } from '../tracks/TrackSchema';
import { buildFlatPad } from '../tracks/TestTracks';
import { buildTrack } from '../tracks/TrackGenerator';
import { TrackData } from '../tracks/TrackTypes';
import { DebugOverlay } from '../ui/DebugOverlay';
import { FinishAction, Hud } from '../ui/Hud';
import { AppApi, GhostKind } from '../ui/screens/AppApi';
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen';
import { LevelSelectScreen } from '../ui/screens/LevelSelectScreen';
import { MainMenu } from '../ui/screens/MainMenu';
import { PauseScreen } from '../ui/screens/PauseScreen';
import { ScreenManager } from '../ui/screens/ScreenManager';
import { TouchControls } from '../ui/TouchControls';
import { TuningPanel } from '../ui/TuningPanel';
import { FixedLoop } from './FixedLoop';
import { GhostData } from './Ghost';
import { GhostStore, authorGhost } from './GhostStore';
import { InputManager, MetaActions } from './input/InputManager';
import { loadLivery } from './Livery';
import { medalRank } from './Medals';
import { RaceSession, SessionCtx } from './RaceSession';
import { Records } from './Records';
import { ReplaySession } from './ReplaySession';
import { Settings, SettingsData } from './Settings';
import { storage } from './Storage';

interface Bundle {
  json?: TrackJson;
  track: TrackData;
  def: CarDef;
  params: VehicleParams;
}

const NO_META: MetaActions = { restart: false, respawn: false, camera: false, pause: false, debug: false, mouseSteerToggled: false };
const LAST_LEVEL = 'nitrovolt.lastLevel';

/**
 * The application shell: owns the renderer, input, audio and HUD, and switches between the menu backdrop,
 * a race session and a replay session. Screens (menus) talk to it through `AppApi`.
 */
export class App implements AppApi {
  readonly gfx: GameRenderer;
  readonly input: InputManager;
  readonly audio: AudioEngine;
  readonly hud: Hud;
  readonly screens: ScreenManager;
  mode: 'menu' | 'race' | 'replay' = 'menu';

  private readonly loop: FixedLoop;
  private readonly debug: DebugOverlay;
  private readonly debugOn: boolean;
  private readonly query = new URLSearchParams(location.search);
  private readonly ctx: SessionCtx;
  private session: RaceSession | ReplaySession | null = null;
  /** The race kept alive underneath a replay of its last run. */
  private suspended: RaceSession | null = null;
  private tuning: TuningPanel | null = null;
  private tuningCar = '';
  private startToken = 0;
  private lastGhostSetting: SettingsData['ghosts'];

  private readonly trackCache = new Map<string, TrackData>();
  private readonly thumbQueue: Array<() => void> = [];
  private thumbTimer = 0;

  // menu backdrop
  private readonly bdCam = new PerspectiveCamera(55, 16 / 9, 0.5, 5000);
  private bdPose: RenderPose | null = null;
  private bdStart = new Vector3();
  private bdTime = 0;
  private bdSkip = 0;
  /** Frame-time samples of the running quality benchmark (only with the 'auto' choice). */
  private bench: { ms: number[]; t: number; rounds: number } | null = null;
  private readonly fpsEl: HTMLElement;
  private fpsAcc = 0;
  private fpsFrames = 0;

  private constructor(appRoot: HTMLElement, canvasHost: HTMLElement, first: Bundle) {
    this.debugOn = this.query.get('debug') === '1';
    const livery = loadLivery(first.def);
    this.gfx = new GameRenderer(canvasHost, first.def, first.params, detectQuality(), livery);
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.audio.setVoice(first.def.voice);
    this.hud = new Hud(appRoot, this.input);
    this.debug = new DebugOverlay(appRoot, this.debugOn);
    new TouchControls(appRoot, this.input.touch);
    this.screens = new ScreenManager(appRoot);
    this.screens.isCapturing = () => this.input.keyboard.capture !== null || this.input.gamepad.capture !== null;
    this.screens.onMove = () => this.audio.tick();
    this.screens.onConfirm = () => this.audio.confirm();
    this.screens.onBackSound = () => this.audio.back();
    this.screens.onChange = (depth) => this.onScreens(depth);
    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'fps-counter';
    appRoot.appendChild(this.fpsEl);

    this.ctx = {
      gfx: this.gfx,
      input: this.input,
      audio: this.audio,
      hud: this.hud,
      debug: this.debug,
      campaign: () => this.campaign(),
      loopStats: () => ({ stepMs: this.loop.lastStepMs, steps: this.loop.lastStepCount }),
      finishActions: (s) => this.finishActions(s),
    };
    this.lastGhostSetting = Settings.get().ghosts;
    this.applySettings(Settings.get());
    Settings.onChange((s) => this.applySettings(s));

    this.loop = new FixedLoop(
      () => this.session?.step(),
      (alpha, dt) => this.frame(alpha, dt),
    );
    window.addEventListener('keydown', this.onKey);
    this.hud.setVisible(false);
    if (loadQualityChoice() === 'auto') this.bench = { ms: [], t: 0, rounds: 0 };
  }

  setQuality(q: QualityChoice): void {
    saveQuality(q);
    if (q === 'auto') {
      this.bench = { ms: [], t: 0, rounds: 0 };
      this.toast('Measuring performance…');
    } else {
      this.bench = null;
      this.gfx.applyQuality(q);
      this.toast(`Quality: ${q}`);
    }
  }

  /** Auto quality: watch ~3 s of frames (after a warm-up), step the preset, repeat at most twice. */
  private runBenchmark(dt: number): void {
    const b = this.bench;
    if (!b) return;
    b.t += dt;
    if (b.t < 0.8) return;
    b.ms.push(dt * 1000);
    if (b.t < 3.8) return;
    const next = benchmarkStep(b.ms, this.gfx.qualityLevel, isTouchDevice());
    if (next !== this.gfx.qualityLevel && b.rounds < 2) {
      this.gfx.applyQuality(next);
      this.bench = { ms: [], t: 0, rounds: b.rounds + 1 };
    } else {
      this.bench = null;
    }
  }

  static async start(appRoot: HTMLElement, canvasHost: HTMLElement): Promise<App> {
    const q = new URLSearchParams(location.search);
    const dev = q.get('track');
    const wanted = q.get('level') ?? storage.get<string>(LAST_LEVEL, DEFAULT_LEVEL_ID);
    const first = App.makeBundle(getLevel(wanted) ? wanted : DEFAULT_LEVEL_ID, q.get('car'));
    const app = new App(appRoot, canvasHost, first);
    if (q.get('debug') === '1') (window as unknown as { __nv: App }).__nv = app;

    const direct = dev === 'flat' || dev === 'greybox' || q.has('level') || q.get('autodrive') === '1';
    if (direct) {
      await app.startRace(dev === 'flat' || dev === 'greybox' ? `dev:${dev}` : getLevel(wanted) ? wanted : DEFAULT_LEVEL_ID, {
        instant: !!dev || q.get('autodrive') === '1',
        autodrive: q.get('autodrive') === '1',
      });
    } else {
      app.enterMenu(first);
      app.screens.set(new MainMenu(app));
    }
    app.loop.start();
    return app;
  }

  // ---- debug / test hooks (window.__nv) ----
  get simulation(): RaceSession['sim'] {
    return (this.session as RaceSession).sim;
  }
  get renderer(): GameRenderer {
    return this.gfx;
  }
  get race(): RaceSession | null {
    return this.session instanceof RaceSession ? this.session : null;
  }
  fastForward(seconds: number): void {
    this.race?.fastForward(seconds);
  }
  view(pos: [number, number, number] | null, target?: [number, number, number], fov?: number): void {
    this.gfx.debugView(pos, target, fov);
  }

  // ---- levels ----
  private static makeBundle(id: string, carOverride: string | null): Bundle {
    if (id === 'dev:flat' || id === 'dev:greybox') {
      const track = id === 'dev:flat' ? buildFlatPad() : buildGreyboxTrack();
      const def = getCar(carOverride ?? track.car);
      return { track, def, params: carParams(def.id) };
    }
    const json = getLevel(id) ?? getLevel(DEFAULT_LEVEL_ID)!;
    const def = getCar(carOverride ?? json.car);
    return { json, track: buildTrack(json), def, params: carParams(def.id) };
  }

  private bundle(id: string): Bundle {
    const b = App.makeBundle(id, this.query.get('car'));
    this.trackCache.set(b.track.id, b.track);
    return b;
  }

  levels(): readonly TrackJson[] {
    return LEVELS;
  }
  level(id: string): TrackJson | undefined {
    return getLevel(id);
  }
  car(id: string): CarDef {
    return getCar(id);
  }
  currentLevelId(): string | null {
    return this.session instanceof RaceSession ? this.session.levelId : null;
  }

  campaign(): CampaignState {
    return computeCampaign((id) => Records.medal(id, getLevel(id)?.medalTimes ?? { author: 0, gold: 0, silver: 0, bronze: 0 }), {
      unlockAll: Settings.get().unlockAll,
      names: (id) => getLevel(id)?.name ?? id,
    });
  }

  continueLevel(): string {
    const c = this.campaign();
    const open = c.levels.find((l) => l.unlocked && l.entry.levelId && medalRank(l.medal) < medalRank('bronze'));
    if (open?.entry.levelId) return open.entry.levelId;
    const last = storage.get<string>(LAST_LEVEL, '');
    if (getLevel(last)) return last;
    return c.levels.find((l) => l.unlocked && l.entry.levelId)?.entry.levelId ?? DEFAULT_LEVEL_ID;
  }

  thumbnail(id: string, done: (url: string) => void, stillWanted: () => boolean = () => true): void {
    const lv = getLevel(id);
    if (!lv) return done('');
    if (lv.thumbnail) return done(lv.thumbnail);
    // one thumbnail per idle slot so a 25-card page never stalls the frame
    this.thumbQueue.push(() => {
      if (!stillWanted()) return;
      let track = this.trackCache.get(id);
      if (!track) {
        track = buildTrack(lv);
        this.trackCache.set(id, track);
        if (this.trackCache.size > 10) this.trackCache.delete(this.trackCache.keys().next().value as string);
      }
      done(levelThumbnail(track));
    });
    if (!this.thumbTimer) this.thumbTimer = window.setTimeout(this.pumpThumbs, 0);
  }

  private pumpThumbs = (): void => {
    this.thumbTimer = 0;
    // a few per slot: building one is ~10 ms
    const t0 = performance.now();
    while (this.thumbQueue.length && performance.now() - t0 < 12) this.thumbQueue.shift()!();
    if (this.thumbQueue.length) this.thumbTimer = window.setTimeout(this.pumpThumbs, 8);
  };

  // ---- ghosts ----
  async hasGhost(id: string, kind: GhostKind): Promise<boolean> {
    return !!(kind === 'pb' ? await GhostStore.load(id) : await authorGhost(id));
  }

  // ---- state changes ----
  private endSession(): void {
    this.startToken++;
    this.suspended?.dispose();
    this.suspended = null;
    this.session?.dispose();
    this.session = null;
    this.gfx.viewCamera = null;
    this.hud.hideFinish();
    this.hud.awayFinish(false);
    this.hud.clearSplits();
    this.hud.setCountdown(null);
    this.gfx.clearFx();
  }

  private setActive(mode: App['mode']): void {
    this.mode = mode;
    document.body.classList.toggle('mode-menu', mode === 'menu');
    this.hud.setVisible(mode !== 'menu');
    this.syncPause();
  }

  private syncPause(): void {
    const paused = this.screens.depth > 0 && this.mode !== 'menu';
    this.loop.timeScale = paused ? 0 : 1;
    if (this.session) this.session.paused = paused;
    this.audio.setDriving(this.mode !== 'menu' && !paused);
  }

  private onScreens(depth: number): void {
    document.body.classList.toggle('in-screen', depth > 0);
    this.syncPause();
  }

  /** Show a level behind the menus: the track with the car on the grid and a slow orbiting camera. */
  private enterMenu(b: Bundle): void {
    this.endSession();
    this.gfx.setTrack(b.track);
    this.gfx.setCar(b.def, b.params, loadLivery(b.def));
    this.audio.setVoice(b.def.voice);
    const p = b.track.start;
    this.bdStart.copy(p.position);
    this.bdPose = {
      position: p.position.clone().add(new Vector3(0, 0.6, 0)),
      quaternion: p.quaternion.clone(),
      springLen: Array<number>(4).fill(b.params.springLenMax * 0.75),
      steer: [0, 0, 0, 0],
      spin: [0, 0, 0, 0],
    };
    this.setActive('menu');
  }

  async startRace(id: string, opts: { instant?: boolean; autodrive?: boolean } = {}): Promise<void> {
    const token = ++this.startToken;
    const b = this.bundle(id);
    this.endSession();
    this.startToken = token;
    this.gfx.setTrack(b.track);
    this.gfx.setCar(b.def, b.params, loadLivery(b.def));
    this.audio.setVoice(b.def.voice);
    this.gfx.viewCamera = null;
    if (b.json) storage.set(LAST_LEVEL, b.json.id);
    this.mode = 'race';
    const s = await RaceSession.create(this.ctx, b, { ...opts, hints: b.json?.bot });
    if (token !== this.startToken) {
      s.dispose();
      return;
    }
    s.nameOf = (lid) => getLevel(lid)?.name ?? lid;
    this.session = s;
    this.screens.closeAll();
    this.setActive('race');
    this.gfx.rig.snap();
    if (this.debugOn && this.tuningCar !== b.def.id) {
      document.querySelectorAll('.tuning').forEach((e) => e.remove());
      this.tuning = new TuningPanel(document.getElementById('app')!, b.params, () => s.sim.vehicle.refreshParams(), b.def.id);
      this.tuningCar = b.def.id;
    }
  }

  playLevel(id: string): void {
    void this.startRace(id);
  }

  restartRace(): void {
    if (this.session instanceof RaceSession) {
      this.screens.closeAll();
      this.session.restart();
    }
  }

  resume(): void {
    this.screens.closeAll();
  }

  toMainMenu(): void {
    this.enterMenu(this.bundle(this.continueLevel()));
    this.screens.set(new MainMenu(this));
  }

  openLevelSelect(): void {
    this.toMainMenu();
    this.screens.push(new LevelSelectScreen(this, 'campaign'));
  }

  toast(msg: string): void {
    this.hud.toast(msg, 1800);
    // toasts live in the HUD, which is hidden in the menu: mirror them there
    if (this.mode === 'menu' || this.screens.depth > 0) this.menuToast(msg);
  }

  private menuToastEl: HTMLElement | null = null;
  private menuToastTimer = 0;
  private menuToast(msg: string): void {
    if (!this.menuToastEl) {
      this.menuToastEl = document.createElement('div');
      this.menuToastEl.className = 'menu-toast';
      document.getElementById('app')!.appendChild(this.menuToastEl);
    }
    this.menuToastEl.textContent = msg;
    this.menuToastEl.classList.add('show');
    clearTimeout(this.menuToastTimer);
    this.menuToastTimer = window.setTimeout(() => this.menuToastEl?.classList.remove('show'), 2200);
  }

  // ---- replays ----
  async watchReplay(id: string, kind: GhostKind): Promise<void> {
    const data = kind === 'pb' ? await GhostStore.load(id) : await authorGhost(id);
    if (!data) {
      this.toast('No replay available for that level');
      return;
    }
    const b = this.bundle(id);
    const levelName = b.json?.name ?? id;
    const title = `${levelName} · ${kind === 'pb' ? 'your best' : 'author'}`;
    this.endSession();
    this.gfx.setTrack(b.track);
    this.gfx.setCar(b.def, b.params, loadLivery(b.def));
    this.audio.setVoice(b.def.voice);
    await this.openReplay(b, data, title, () => {
      this.enterMenu(b);
      this.screens.set(new MainMenu(this));
      this.screens.push(new LeaderboardScreen(this));
    });
  }

  private async openReplay(b: Bundle, data: GhostData, title: string, onExit: () => void): Promise<void> {
    this.screens.closeAll();
    const rp = await ReplaySession.create(this.ctx, { ...b, data, title }, onExit);
    this.session = rp;
    this.setActive('replay');
    this.hud.setTitle(`Replay · ${title}`);
  }

  /** Replay the run that just finished, then come back to the finish screen. */
  private watchLastRun(race: RaceSession): void {
    const data = race.lastRun;
    if (!data) return;
    const b: Bundle = { json: getLevel(race.levelId), track: race.track, def: race.def, params: carParams(race.def.id) };
    this.suspended = race;
    this.session = null;
    race.setGhostsVisible(false);
    this.hud.awayFinish(true);
    void this.openReplay(b, data, `${race.track.name} · your run`, () => {
      this.session?.dispose();
      this.session = race;
      this.suspended = null;
      race.setGhostsVisible(true);
      this.hud.awayFinish(false);
      this.gfx.viewCamera = null;
      this.gfx.trackView?.setBroken(race.sim.world.broken);
      this.hud.setTitle(`${race.track.name} · ${race.def.label}`);
      this.hud.clearSplits();
      this.setActive('race');
      this.gfx.rig.snap();
    });
  }

  private finishActions(race: RaceSession): FinishAction[] {
    const k = this.input.bindings.keyboard.restart[0];
    const acts: FinishAction[] = [{ label: 'Retry', key: k === 'Enter' ? 'Enter' : undefined, primary: true, onClick: () => race.restart() }];
    const next = nextAvailable(race.levelId);
    if (next?.levelId && this.campaign().levels.find((l) => l.entry.levelId === next.levelId)?.unlocked) {
      const id = next.levelId;
      acts.push({ label: 'Next level', key: 'N', onClick: () => this.playLevel(id) });
    }
    acts.push({ label: 'Replay', key: 'V', onClick: () => this.watchLastRun(race) });
    acts.push({ label: 'Menu', key: 'Esc', onClick: () => this.openPause() });
    return acts;
  }

  private openPause(): void {
    if (this.screens.depth === 0 && this.mode !== 'menu') this.screens.push(new PauseScreen(this));
  }

  // ---- settings ----
  private applySettings(s: SettingsData): void {
    this.gfx.speedFxEnabled = s.speedFx;
    this.gfx.rig.reducedMotion = s.reducedMotion;
    document.body.classList.toggle('cb', s.cbMedals);
    document.body.classList.toggle('rm', s.reducedMotion);
    document.documentElement.style.setProperty('--hud-scale', String(s.hudScale));
    this.fpsEl.style.display = s.showFps ? 'block' : 'none';
    this.gfx.dynamicResolution = s.dynamicResolution;
    if (s.ghosts !== this.lastGhostSetting) {
      this.lastGhostSetting = s.ghosts;
      const r = this.race ?? this.suspended;
      if (r) void r.loadGhosts();
    }
  }

  // ---- input + frame ----
  private onKey = (e: KeyboardEvent): void => {
    if (this.screens.depth > 0 || e.repeat) return;
    const race = this.session instanceof RaceSession ? this.session : null;
    if (!race) return;
    if (e.code === 'KeyG') race.cycleGhosts();
    else if (this.hud.finishVisible && race.phase === 'finished') {
      if (e.code === 'KeyN') {
        const n = nextAvailable(race.levelId);
        if (n?.levelId && this.campaign().levels.find((l) => l.entry.levelId === n.levelId)?.unlocked) this.playLevel(n.levelId);
      } else if (e.code === 'KeyV') this.watchLastRun(race);
    }
  };

  private frame(alpha: number, dt: number): void {
    const meta = this.input.pollMeta();
    const inScreens = this.screens.depth > 0;
    if (inScreens) {
      if (this.input.gamepad.capture) this.input.gamepad.poll();
      this.screens.pollPad(dt);
    }
    if (meta.debug) {
      const on = this.debug.toggle();
      this.tuning?.toggle();
      this.hud.toast(`Debug HUD ${on ? 'on' : 'off'}`);
    }
    if (meta.pause && !this.screens.handledEscape && this.mode !== 'menu') {
      if (this.mode === 'replay') this.exitReplay();
      else if (!inScreens) this.openPause();
      else if (this.screens.top instanceof PauseScreen) this.resume();
    }
    this.screens.handledEscape = false;

    if (this.session) this.session.render(alpha, dt, this.screens.depth > 0 ? NO_META : meta);
    else if (this.mode === 'menu') {
      // behind a full-screen list (level select, settings...) the backdrop only needs a slow refresh,
      // which leaves the main thread to the thumbnail builder
      this.bdSkip += dt;
      if (this.screens.depth <= 1 || this.bdSkip > 0.1) {
        this.renderBackdrop(this.bdSkip);
        this.bdSkip = 0;
      }
    }

    this.runBenchmark(dt);
    if (Settings.get().showFps) {
      this.fpsAcc += dt;
      this.fpsFrames++;
      if (this.fpsAcc > 0.5) {
        this.fpsEl.textContent = `${Math.round(this.fpsFrames / this.fpsAcc)} fps`;
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
    }
  }

  private exitReplay(): void {
    if (!(this.session instanceof ReplaySession)) return;
    this.session.exit();
  }

  private renderBackdrop(dt: number): void {
    if (!this.bdPose) return;
    this.bdTime += dt;
    const a = this.bdTime * 0.16 + 0.7;
    const r = 15;
    this.bdCam.position.set(this.bdStart.x + Math.sin(a) * r, this.bdStart.y + 4 + Math.sin(this.bdTime * 0.4) * 0.8, this.bdStart.z + Math.cos(a) * r);
    this.bdCam.lookAt(this.bdStart.x, this.bdStart.y + 1, this.bdStart.z);
    this.gfx.viewCamera = this.bdCam;
    this.gfx.render(dt, this.bdPose, new Vector3(), 0, 0);
  }
}
