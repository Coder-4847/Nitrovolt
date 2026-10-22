import { SurfaceId } from '../Surface';
import { VOLT, VehicleParams, allSurfaces, cloneParams } from '../VehicleParams';

type Overrides = Omit<Partial<VehicleParams>, 'surfaceGrip' | 'surfaceRolling' | 'boxHalf'> & {
  boxHalf?: [number, number, number];
  surfaceGrip?: Partial<Record<SurfaceId, number>>;
  surfaceRolling?: Partial<Record<SurfaceId, number>>;
};

/** Start from the shared Volt core and override what makes this car different. */
export function deriveCar(name: string, o: Overrides): VehicleParams {
  const p = cloneParams(VOLT);
  const { surfaceGrip, surfaceRolling, ...rest } = o;
  Object.assign(p, rest, { name });
  p.surfaceGrip = allSurfaces(1, surfaceGrip);
  p.surfaceRolling = allSurfaces(1, surfaceRolling);
  return p;
}
