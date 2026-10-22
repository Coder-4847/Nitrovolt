import { Vector3 } from "three";
import { InputFrame, NEUTRAL_FRAME } from '../core/InputFrame';
import { PHYSICS_DT } from '../core/FixedLoop';
import { RunEvent, RunLogic } from '../core/Run';
import { Pose, TrackData, TrackTrigger } from '../tracks/TrackTypes';
import { CarBehavior } from './CarBehavior';
import { RapierWorld, initRapier } from './RapierWorld';
import { DEFAULT_GRAVITY, SimEvent, Vehicle } from './Vehicle';
import { VehicleParams } from './VehicleParams';

/** Vertical landing speed (m/s) at which a fragile block shatters. */
export const FRAGILE_BREAK_SPEED = 7;

export type SimulationEvent = SimEvent | RunEvent | { type: 'break'; blockId: number };

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
  /** Seconds of 3-2-1 before GO. 0 = instant. */
  countdownSeconds: number;
  private respawnPose: Pose;
  /** Events accumulated since the consumer last cleared them (several ticks can land in one frame). */
  readonly events: SimulationEvent[] = [];

  private constructor(
    readonly track: TrackData,
    params: VehicleParams,
    gravity: number,
    countdownSeconds: number,
    behavior?: CarBehavior,
  ) {
    this.countdownSeconds = countdownSeconds;
    this.world = new RapierWorld();
    for (const m of track.meshes) {
      if (m.collide) this.world.addStaticMesh({ surface: m.surface, effect: m.effect, blockId: m.blockId, positions: m.positions, indices: m.indices });
    }
    this.world.finalize();
    this.vehicle = new Vehicle(this.world, params, gravity, behavior);
    this.run = new RunLogic(track.triggers, track.laps);
    this.respawnPose = track.start;
    this.restart();
  }

  static async create(track: TrackData, params: VehicleParams, countdownSeconds = 0, gravity = DEFAULT_GRAVITY, behavior?: CarBehavior): Promise<Simulation> {
    await initRapier();
    return new Simulation(track, params, gravity, countdownSeconds, behavior);
  }

  /** Simulation clock in seconds (includes the countdown). */
  get time(): number {
    return this.run.tick * PHYSICS_DT;
  }

  get tick(): number {
    return this.run.tick;
  }

  /** Back to the start line, instantly. Rebuilds the chassis so every attempt starts from identical state. */
  restart(): void {
    this.world.restoreBroken();
    this.respawnCount = 0;
    this.respawnPose = this.track.start;
    this.events.length = 0;
    this.run.reset(this.countdownSeconds);
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
    this.flushRunEvents();
  }

  /** Back to the last checkpoint with zero speed. The clock keeps running. */
  respawn(): void {
    if (this.run.locked) return;
    this.respawnCount++;
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
  }

  private flushRunEvents(): void {
    for (const e of this.run.events) this.events.push(e);
    this.run.events.length = 0;
  }

  step(input: InputFrame): void {
    if (input.respawn) this.respawn();
    // the car is held (no driver input) until GO
    const v = this.vehicle;
    v.step(this.run.locked ? NEUTRAL_FRAME : input, PHYSICS_DT);
    for (const e of v.events) {
      this.events.push(e);
      if (e.type === 'landing' && e.fragile.length > 0 && e.intensity > FRAGILE_BREAK_SPEED) {
        for (const h of e.fragile) {
          const id = this.world.breakCollider(h);
          if (id >= 0) this.events.push({ type: 'break', blockId: id });
        }
      }
    }
    const collected = this.run.step(v.prev.position, v.curr.position);
    if (collected) this.respawnPose = respawnPoseOf(collected);
    this.flushRunEvents();
    if (v.position.y < this.track.killY) this.respawn();
  }

  dispose(): void {
    this.vehicle.dispose();
    this.world.dispose();
  }
}

