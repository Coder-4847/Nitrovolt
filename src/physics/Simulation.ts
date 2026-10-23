import { Vector3 } from "three";
import { InputFrame, NEUTRAL_FRAME } from '../core/InputFrame';
import { PHYSICS_DT } from '../core/FixedLoop';
import { RunEvent, RunLogic, crossedForward } from '../core/Run';
import { carParams, getCar } from '../data/cars';
import { Pose, TrackData, TrackTrigger } from '../tracks/TrackTypes';
import { CarBehavior } from './CarBehavior';
import { RapierWorld, initRapier } from './RapierWorld';
import { DEFAULT_GRAVITY, SimEvent, Vehicle } from './Vehicle';
import { VehicleParams } from './VehicleParams';

/** Vertical landing speed (m/s) at which a fragile block shatters. */
export const FRAGILE_BREAK_SPEED = 7;

export type SimulationEvent = SimEvent | RunEvent | { type: 'break'; blockId: number } | { type: 'car'; car: string };

/** Neutral ticks every restart runs before the run can start, so the car is settled at GO whatever the countdown. */
export const GRID_PREROLL_TICKS = 100;

/** Bump when anything that changes simulated results changes: it invalidates recorded ghosts. */
export const PHYSICS_VERSION = 'p6.0';

const _up = new Vector3();

/** Pose a car respawns at for a trigger: on the line, lifted slightly above the road. */
function respawnPoseOf(t: TrackTrigger): Pose {
  _up.set(0, 1, 0).applyQuaternion(t.quaternion);
  return { position: t.position.clone().addScaledVector(_up, 0.75), quaternion: t.quaternion.clone() };
}

/**
 * Deterministic simulation: track colliders + one vehicle + the race rules, advanced one fixed tick
 * at a time with a single InputFrame. Given the same track, params, countdown and frame stream the
 * result is bit-identical.
 */
export class Simulation {
  readonly world: RapierWorld;
  readonly vehicle: Vehicle;
  readonly run: RunLogic;
  respawnCount = 0;
  /**
   * Hold the car at the start until `go()` (the game shows its countdown meanwhile).
   * Without it, `restart()` goes immediately, which is what tools and tests want.
   */
  hold: boolean;
  private respawnPose: Pose;
  /** The car being driven right now (car gates change it), the one the run starts with and the one a respawn restores. */
  carId: string;
  private readonly startCar: string;
  private respawnCar: string;
  /** Parameters of the car the run starts with (ghost fingerprints use these). */
  readonly startParams: VehicleParams;
  private readonly startBehavior: CarBehavior | undefined;
  private readonly carGates: TrackTrigger[];
  private readonly carCache = new Map<string, { params: VehicleParams; behavior?: CarBehavior }>();
  /** Events accumulated since the consumer last cleared them (several ticks can land in one frame). */
  readonly events: SimulationEvent[] = [];

  private constructor(
    readonly track: TrackData,
    params: VehicleParams,
    gravity: number,
    hold: boolean,
    behavior?: CarBehavior,
    startCar?: string,
  ) {
    this.hold = hold;
    this.startCar = this.carId = this.respawnCar = startCar ?? track.car;
    this.startParams = params;
    this.startBehavior = behavior;
    this.carGates = track.triggers.filter((t) => t.kind === 'car' && t.car);
    this.world = new RapierWorld();
    for (const m of track.meshes) {
      if (m.collide) this.world.addStaticMesh({ surface: m.surface, effect: m.effect, blockId: m.blockId, positions: m.positions, indices: m.indices });
    }
    if (track.terrain) this.world.addHeightfield(track.terrain);
    this.world.finalize();
    this.vehicle = new Vehicle(this.world, params, gravity, behavior);
    this.run = new RunLogic(track.triggers, track.laps);
    this.respawnPose = track.start;
    this.restart();
  }

  static async create(track: TrackData, params: VehicleParams, hold: boolean | number = false, gravity = DEFAULT_GRAVITY, behavior?: CarBehavior, startCar?: string): Promise<Simulation> {
    await initRapier();
    return new Simulation(track, params, gravity, !!hold, behavior, startCar);
  }

  /** Drive `id` from now on (the start car keeps the parameters the simulation was created with). */
  private switchCar(id: string): void {
    if (id === this.carId) return;
    this.carId = id;
    if (id === this.startCar) {
      this.vehicle.setCar(this.startParams, this.startBehavior);
      return;
    }
    let c = this.carCache.get(id);
    if (!c) {
      c = { params: carParams(id), behavior: getCar(id).behavior };
      this.carCache.set(id, c);
    }
    this.vehicle.setCar(c.params, c.behavior);
  }

  /** Run clock in seconds since GO. */
  get time(): number {
    return this.run.tick * PHYSICS_DT;
  }

  /** Ticks since GO. */
  get tick(): number {
    return this.run.tick;
  }

  /** Back to the start line, instantly. Rebuilds the chassis so every attempt starts from identical state. */
  restart(): void {
    this.world.restoreBroken();
    this.respawnCount = 0;
    this.respawnPose = this.track.start;
    this.events.length = 0;
    this.run.reset();
    this.switchCar(this.startCar);
    this.respawnCar = this.startCar;
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
    // let the car drop and settle on its springs; identical for every attempt, so GO always starts from the same state
    for (let i = 0; i < GRID_PREROLL_TICKS; i++) this.vehicle.step(NEUTRAL_FRAME, PHYSICS_DT);
    this.vehicle.events.length = 0;
    this.events.length = 0;
    if (!this.hold) this.run.go();
  }

  /** Start the run (clock at zero). */
  go(): void {
    this.run.go();
  }

  /** Back to the last checkpoint with zero speed. The clock keeps running. */
  respawn(): void {
    if (this.run.locked) return;
    this.respawnCount++;
    if (this.carId !== this.respawnCar) {
      this.switchCar(this.respawnCar);
      this.events.push({ type: 'car', car: this.carId });
    }
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
  }

  private flushRunEvents(): void {
    for (const e of this.run.events) this.events.push(e);
    this.run.events.length = 0;
  }

  step(input: InputFrame): void {
    if (this.run.locked) return; // gridded: nothing moves until GO
    if (input.respawn) this.respawn();
    const v = this.vehicle;
    v.step(input, PHYSICS_DT);
    for (const e of v.events) {
      this.events.push(e);
      if (e.type === 'landing' && e.fragile.length > 0 && e.intensity > FRAGILE_BREAK_SPEED) {
        for (const h of e.fragile) {
          const id = this.world.breakCollider(h);
          if (id >= 0) this.events.push({ type: 'break', blockId: id });
        }
      }
    }
    for (const g of this.carGates) {
      if (g.car !== this.carId && crossedForward(g, v.prev.position, v.curr.position) !== null) {
        this.switchCar(g.car!);
        this.events.push({ type: 'car', car: this.carId });
      }
    }
    const collected = this.run.step(v.prev.position, v.curr.position);
    if (collected) {
      this.respawnPose = respawnPoseOf(collected);
      this.respawnCar = this.carId;
    }
    this.flushRunEvents();
    if (v.position.y < this.track.killY) this.respawn();
  }

  dispose(): void {
    this.vehicle.dispose();
    this.world.dispose();
  }
}

