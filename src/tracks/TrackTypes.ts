import { Quaternion, Vector3 } from 'three';
import { EffectId, SurfaceId } from '../physics/Surface';

export interface Pose {
  position: Vector3;
  quaternion: Quaternion;
}

export type MeshKind = 'road' | 'wall' | 'deco';

/** Indexed triangle mesh in world space; used for both rendering and Rapier trimesh colliders. */
export interface TrackMesh {
  kind: MeshKind;
  surface: SurfaceId;
  /** Special-block behaviour of this road surface. */
  effect?: EffectId;
  /** Unique per breakable (fragile) block; -1 for everything else. */
  blockId: number;
  /** Colour for decoration meshes (sRGB hex). */
  tint?: number;
  collide: boolean;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Render-only: per vertex (metres from the left road edge, road width); (-1, 0) off the driving surface. */
  lateral?: Float32Array;
}

export type TriggerKind = 'checkpoint' | 'finish';

/**
 * A gameplay line across the road. The local frame has -Z pointing along the driving direction;
 * a crossing only counts when the car passes from behind (+Z) to ahead (-Z).
 */
export interface TrackTrigger {
  kind: TriggerKind;
  /** Checkpoint order (0-based) for checkpoints, 0 for the finish. */
  index: number;
  position: Vector3;
  quaternion: Quaternion;
  halfWidth: number;
  halfHeight: number;
}

export interface TrackData {
  id: string;
  name: string;
  car: string;
  theme: string;
  seed: number;
  laps: number;
  meshes: TrackMesh[];
  /** Spawn pose of the car at the start line. */
  start: Pose;
  triggers: TrackTrigger[];
  /** Falling below this height forces a respawn. */
  killY: number;
  /** Driving line, used by the bot, camera hints and thumbnails. */
  centerline: Vector3[];
  /** Surface under each centerline sample (same length as `centerline`). */
  centerSurface: SurfaceId[];
  /** Medal / author times in ms (0 = not set). */
  medals: { author: number; gold: number; silver: number; bronze: number };
}

export const checkpointCount = (t: TrackData): number => t.triggers.filter((x) => x.kind === 'checkpoint').length;
