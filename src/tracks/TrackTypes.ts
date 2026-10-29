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

export type TriggerKind = 'checkpoint' | 'finish' | 'car';

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
  /** Car gates: the car the player drives on after crossing. */
  car?: string;
}

/**
 * How a centerline sample relates to the ground: 'road' (an ordinary drivable cross-section that terrain may
 * support), 'gap' (a jump gap: the terrain falls away into a pit), 'special' (loops, half-pipes, spirals:
 * terrain stays clear underneath and never builds up to them).
 */
export type SampleKind = 'road' | 'gap' | 'special';

/** Cross-section frame of the road at a centerline sample. */
export interface RoadSample {
  /** Road right vector (banked) and surface normal. */
  r: Vector3;
  u: Vector3;
  /** Half width of the drivable surface (m). */
  hw: number;
  kind: SampleKind;
}

/**
 * Ground around the track: a regular height grid (row-major, x fastest) the renderer draws and the physics
 * collides with, so the road sits in the landscape instead of floating above a distant floor.
 */
export interface TerrainData {
  x0: number;
  z0: number;
  step: number;
  nx: number;
  nz: number;
  heights: Float32Array;
  /** Height of the flat ground the lowest road sits on. */
  base: number;
  surface: SurfaceId;
  /** Per grid point: distance (m, capped at 255) to the nearest road edge in plan view. */
  near: Uint8Array;
  /** Bounding box of the driving line (x0, z0, x1, z1); the stadium stands around it. */
  bounds: [number, number, number, number];
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
  /** Cross-section frame at each centerline sample (same length as `centerline`). */
  centerFrame: RoadSample[];
  /** Landscape around the track (null for dev pads that bring their own floor). */
  terrain: TerrainData | null;
  /** Target time in ms: the author (validation) run, 0 when not set. */
  targetTime: number;
}

export const checkpointCount = (t: TrackData): number => t.triggers.filter((x) => x.kind === 'checkpoint').length;
