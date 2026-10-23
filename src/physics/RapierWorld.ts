import type * as RT from '@dimforge/rapier3d-compat';
import { PHYSICS_DT } from '../core/FixedLoop';
import { EffectId, SurfaceId } from './Surface';

type RapierModule = typeof RT;
/**
 * The Rapier module, loaded on demand: its WASM is ~2 MB, so it lives in its own chunk and the menus can
 * appear before it arrives. Valid after `initRapier()` resolves (every Simulation awaits it).
 */
export let RAPIER: RapierModule = null as unknown as RapierModule;
export type { RT };

let initPromise: Promise<void> | null = null;

/** True once the physics engine is loaded. */
export const rapierReady = (): boolean => RAPIER !== null;

/** Load and initialise the WASM module once. */
export function initRapier(): Promise<void> {
  initPromise ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    const mod = ((m as unknown as { default?: RapierModule }).default ?? m) as RapierModule;
    await mod.init();
    RAPIER = mod;
  });
  return initPromise;
}

/** Static collision geometry handed to the physics world. */
export interface ColliderMesh {
  surface: SurfaceId;
  effect?: EffectId;
  /** Identifies a breakable block (fragile); -1 otherwise. */
  blockId: number;
  positions: Float32Array;
  indices: Uint32Array;
}

export interface ColliderInfo {
  surface: SurfaceId;
  effect?: EffectId;
  blockId: number;
}

const DEFAULT_INFO: ColliderInfo = { surface: 'tarmac', blockId: -1 };

/**
 * Thin wrapper around the Rapier world. Rapier only does what it is good at here:
 * static trimesh ray queries (suspension) and chassis-vs-track contact resolution.
 * All vehicle dynamics are our own code.
 */
export class RapierWorld {
  readonly world: RT.World;
  private readonly info = new Map<number, ColliderInfo>();
  private readonly meshes: ColliderMesh[] = [];
  /** collider handle currently representing each mesh (undefined while broken). */
  private readonly handles: Array<number | undefined> = [];
  /** Block ids of fragile meshes that are currently broken. */
  readonly broken = new Set<number>();

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 }); // gravity is applied by the vehicle
    this.world.timestep = PHYSICS_DT;
    this.world.numSolverIterations = 6;
  }

  addStaticMesh(mesh: ColliderMesh): void {
    this.meshes.push(mesh);
    this.handles.push(this.createCollider(mesh));
  }

  private createCollider(mesh: ColliderMesh): number {
    const desc = RAPIER.ColliderDesc.trimesh(mesh.positions, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(0.0)
      .setRestitution(0.0);
    const col = this.world.createCollider(desc);
    this.info.set(col.handle, { surface: mesh.surface, effect: mesh.effect, blockId: mesh.blockId });
    return col.handle;
  }

  infoOf(colliderHandle: number): ColliderInfo {
    return this.info.get(colliderHandle) ?? DEFAULT_INFO;
  }

  /** Remove a fragile block's collider. Returns its block id (or -1). */
  breakCollider(handle: number): number {
    const idx = this.handles.indexOf(handle);
    if (idx < 0) return -1;
    const col = this.world.getCollider(handle);
    if (col) this.world.removeCollider(col, true);
    this.info.delete(handle);
    this.handles[idx] = undefined;
    const id = this.meshes[idx]!.blockId;
    this.broken.add(id);
    return id;
  }

  /** Put every broken block back (restart). */
  restoreBroken(): void {
    if (this.broken.size === 0) return;
    for (let i = 0; i < this.meshes.length; i++) {
      if (this.handles[i] === undefined) this.handles[i] = this.createCollider(this.meshes[i]!);
    }
    this.broken.clear();
    this.world.step(); // refresh the broad phase so rays see the restored colliders
  }

  /** Flush newly added colliders into the broad phase so ray casts can see them. */
  finalize(): void {
    this.world.step();
  }

  step(dt: number = PHYSICS_DT): void {
    this.world.timestep = dt;
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
