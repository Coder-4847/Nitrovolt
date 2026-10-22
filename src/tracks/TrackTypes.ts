import { Quaternion, Vector3 } from 'three';
import { SurfaceId } from '../physics/Surface';

export interface Pose {
  position: Vector3;
  quaternion: Quaternion;
}

export type MeshKind = 'road' | 'wall' | 'deco';

/** Indexed triangle mesh in world space; used for both rendering and Rapier trimesh colliders. */
export interface TrackMesh {
  kind: MeshKind;
  surface: SurfaceId;
  collide: boolean;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface TrackData {
  id: string;
  name: string;
  meshes: TrackMesh[];
  start: Pose;
  checkpoints: Pose[];
  /** Falling below this height forces a respawn. */
  killY: number;
  /** Driving line, used by the bot, camera hints and thumbnails. */
  centerline: Vector3[];
  /** Surface under each centerline sample (same length as `centerline`). */
  centerSurface: SurfaceId[];
}
