import { Vector3 } from 'three';
import { Rng } from '../core/Rng';
import { ParticleStyle } from '../data/cars';
import { SURFACES, SurfaceId } from '../physics/Surface';
import { Vehicle } from '../physics/Vehicle';
import { Particles } from './Particles';

interface Puff {
  r: number; g: number; b: number;
  alpha: number;
  size: number;
  /** Emissions per second at 25 m/s, full slip. */
  rate: number;
  rise: number;
  life: number;
  /** Only when the tyre is actually sliding. */
  slipOnly: boolean;
}

/** What each surface throws up. Hard surfaces only smoke when the tyre is sliding. */
const PUFFS: Record<SurfaceId, Puff> = {
  dirt: { r: 0.62, g: 0.42, b: 0.3, alpha: 0.38, size: 0.65, rate: 55, rise: 0.7, life: 1.0, slipOnly: false },
  grass: { r: 0.42, g: 0.5, b: 0.26, alpha: 0.4, size: 0.55, rate: 45, rise: 0.4, life: 0.9, slipOnly: false },
  sand: { r: 0.88, g: 0.77, b: 0.52, alpha: 0.38, size: 0.8, rate: 60, rise: 0.8, life: 1.1, slipOnly: false },
  snow: { r: 0.95, g: 0.97, b: 1.0, alpha: 0.42, size: 0.55, rate: 50, rise: 0.5, life: 0.9, slipOnly: false },
  ice: { r: 0.85, g: 0.94, b: 1.0, alpha: 0.4, size: 0.55, rate: 50, rise: 0.4, life: 0.8, slipOnly: true },
  tarmac: { r: 0.78, g: 0.78, b: 0.8, alpha: 0.4, size: 0.7, rate: 80, rise: 0.9, life: 1.2, slipOnly: true },
  wood: { r: 0.7, g: 0.66, b: 0.6, alpha: 0.3, size: 0.6, rate: 55, rise: 0.8, life: 1.0, slipOnly: true },
  plastic: { r: 0.9, g: 0.5, b: 0.7, alpha: 0.3, size: 0.6, rate: 55, rise: 0.8, life: 1.0, slipOnly: true },
  tech: { r: 0.7, g: 0.78, b: 0.9, alpha: 0.3, size: 0.6, rate: 55, rise: 0.8, life: 1.0, slipOnly: true },
};

const _v = new Vector3();

/** Per-wheel dust / snow / sand spray and tyre smoke, tuned per car by its ParticleStyle. */
export class WheelFx {
  readonly particles: Particles;

  constructor(maxParticles = 1400) {
    this.particles = new Particles(maxParticles);
  }

  private readonly acc = [0, 0, 0, 0];
  private readonly rng = new Rng(77);

  update(dt: number, v: Vehicle, style: ParticleStyle): void {
    for (let k = 0; k < 4; k++) {
      const w = v.wheels[k]!;
      if (!w.contact || v.speed < 4) {
        this.acc[k] = 0;
        continue;
      }
      const puff = PUFFS[w.surface];
      const loose = SURFACES[w.surface].loose;
      const slip = Math.max(0, Math.min(1.4, w.gripUse));
      const sliding = w.slipping || slip > 0.96;
      if (puff.slipOnly && !sliding) {
        this.acc[k] = 0;
        continue;
      }
      let amount = Math.min(1.6, v.speed / 25) * (loose ? 0.4 + 0.6 * slip : 0.5 + (slip - 0.9) * 6);
      amount *= puff.rate * (loose ? style.amount : style.smoke);
      this.acc[k]! += amount * dt;
      const n = Math.floor(this.acc[k]!);
      this.acc[k]! -= n;
      for (let i = 0; i < n; i++) this.spawn(v, w.contactPoint, puff, loose ? style.size : 1, 1);
    }
    this.particles.update(dt);
  }

  /** Touch-down burst on every wheel in contact. */
  burst(v: Vehicle, intensity: number, style: ParticleStyle): void {
    for (const w of v.wheels) {
      if (!w.contact) continue;
      const puff = PUFFS[w.surface];
      if (puff.slipOnly && w.surface !== 'tarmac') continue;
      const n = Math.round(Math.min(22, 4 + intensity * 0.8) * (SURFACES[w.surface].loose ? style.amount : 0.5));
      for (let i = 0; i < n; i++) this.spawn(v, w.contactPoint, puff, SURFACES[w.surface].loose ? style.size : 1, 2.2);
    }
  }

  private spawn(v: Vehicle, at: Vector3, puff: Puff, sizeMul: number, energy: number): void {
    const r = this.rng;
    // thrown backwards (relative to travel) with spread, plus a little of the car's own momentum
    _v.copy(v.linvel).multiplyScalar(-0.1);
    const back = Math.min(6, v.speed * 0.08) * energy;
    this.particles.emit(
      at.x + r.range(-0.2, 0.2), at.y + 0.1, at.z + r.range(-0.2, 0.2),
      _v.x + r.range(-1.6, 1.6) * energy - v.fwd.x * back,
      _v.y + r.range(0.6, 2.4) * energy,
      _v.z + r.range(-1.6, 1.6) * energy - v.fwd.z * back,
      puff.life * r.range(0.7, 1.2), puff.size * sizeMul * r.range(0.7, 1.2), 2.2,
      puff.r, puff.g, puff.b, puff.alpha, puff.rise,
    );
  }

  setScale(px: number): void {
    this.particles.setScale(px);
  }

  clear(): void {
    this.particles.clear();
  }
}
