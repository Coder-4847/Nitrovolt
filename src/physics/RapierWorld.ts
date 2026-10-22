import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_DT } from '../core/FixedLoop';
import { SurfaceId } from './Surface';

export { RAPIER };

let initPromise: Promise<void> | null = null;

/** Initialise the WASM module once. */
export function initRapier(): Promise<void> {
  initPromise ??= RAPIER.init();
  return initPromise;
}

/** Static collision geometry handed to the physics world. */
export interface ColliderMesh {
  surface: SurfaceId;
  positions: Float32Array;
  indices: Uint32Array;
}

/**
 * Thin wrapper around the Rapier world. Rapier only does what it is good at here:
 * static trimesh ray queries (suspension) and chassis-vs-track contact resolution.
 * All vehicle dynamics are our own code.
 */
export class RapierWorld {
  readonly world: RAPIER.World;
  private readonly surfaceByCollider = new Map<number, SurfaceId>();

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 }); // gravity is applied by the vehicle
    this.world.timestep = PHYSICS_DT;
    this.world.numSolverIterations = 6;
  }

  addStaticMesh(mesh: ColliderMesh): void {
    const desc = RAPIER.ColliderDesc.trimesh(mesh.positions, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(0.0)
      .setRestitution(0.0);
    const col = this.world.createCollider(desc);
    this.surfaceByCollider.set(col.handle, mesh.surface);
  }

  surfaceOf(colliderHandle: number): SurfaceId {
    return this.surfaceByCollider.get(colliderHandle) ?? 'tarmac';
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
