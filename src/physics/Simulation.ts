import { InputFrame } from '../core/InputFrame';
import { PHYSICS_DT } from '../core/FixedLoop';
import { Pose, TrackData } from '../tracks/TrackTypes';
import { RapierWorld, initRapier } from './RapierWorld';
import { DEFAULT_GRAVITY, SimEvent, Vehicle } from './Vehicle';
import { VehicleParams } from './VehicleParams';

/** How close (m) the car must pass to a checkpoint marker to register it (placeholder until Phase 2 triggers). */
const CHECKPOINT_RADIUS = 14;

/**
 * Deterministic simulation: track colliders + one vehicle, advanced one fixed tick at a time with a
 * single InputFrame. Given the same track, params and frame stream the result is bit-identical.
 */
export class Simulation {
  readonly world: RapierWorld;
  readonly vehicle: Vehicle;
  tick = 0;
  /** Index of the next checkpoint to collect. */
  nextCheckpoint = 0;
  respawnCount = 0;
  private respawnPose: Pose;
  /** Events accumulated since the consumer last cleared them (several physics ticks can land in one frame). */
  readonly events: SimEvent[] = [];

  private constructor(readonly track: TrackData, params: VehicleParams, gravity: number) {
    this.world = new RapierWorld();
    for (const m of track.meshes) {
      if (m.collide) this.world.addStaticMesh({ surface: m.surface, positions: m.positions, indices: m.indices });
    }
    this.world.step(); // flush colliders into the broad phase so ray casts can see them
    this.vehicle = new Vehicle(this.world, params, gravity);
    this.respawnPose = track.start;
    this.restart();
  }

  static async create(track: TrackData, params: VehicleParams, gravity = DEFAULT_GRAVITY): Promise<Simulation> {
    await initRapier();
    return new Simulation(track, params, gravity);
  }

  get time(): number {
    return this.tick * PHYSICS_DT;
  }

  /** Back to the start line. Rebuilds the chassis so every attempt starts from identical state. */
  restart(): void {
    this.tick = 0;
    this.nextCheckpoint = 0;
    this.respawnCount = 0;
    this.respawnPose = this.track.start;
    this.events.length = 0;
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
  }

  /** Back to the last checkpoint with zero speed. */
  respawn(): void {
    this.respawnCount++;
    this.vehicle.reset(this.respawnPose.position, this.respawnPose.quaternion);
  }

  step(input: InputFrame): void {
    if (input.respawn) this.respawn();
    this.vehicle.step(input, PHYSICS_DT);
    this.tick++;
    for (const e of this.vehicle.events) this.events.push(e);

    // placeholder checkpoint collection (Phase 2 replaces with proper trigger volumes)
    const cps = this.track.checkpoints;
    if (this.nextCheckpoint < cps.length) {
      const cp = cps[this.nextCheckpoint]!;
      if (this.vehicle.position.distanceTo(cp.position) < CHECKPOINT_RADIUS) {
        this.respawnPose = cp;
        this.nextCheckpoint++;
      }
    }
    if (this.vehicle.position.y < this.track.killY) this.respawn();
  }

  dispose(): void {
    this.vehicle.dispose();
    this.world.dispose();
  }
}

