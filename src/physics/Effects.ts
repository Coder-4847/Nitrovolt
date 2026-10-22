import { EffectId } from './Surface';

/** What the active special-block effects ask the vehicle to do this tick. */
export interface EffectModifiers {
  /** Extra forward acceleration (m/s^2) and the speed it stops pushing at. */
  boostAccel: number;
  boostCap: number;
  /** Extra upward acceleration as a fraction of gravity (reactor). */
  lift: number;
  noSteer: boolean;
  noBrake: boolean;
  engineOff: boolean;
  /** Target speed (m/s) when cruise control owns the pedals, else null. */
  cruiseSpeed: number | null;
  /** Physics time scale (1 = normal). */
  timeScale: number;
  gravityScale: number;
  /** 0..1 strength of the strongest boost, for FX. */
  boostLevel: number;
  /** Bit-ish list of effects currently active, for the HUD. */
  active: EffectId[];
}

interface BoostSpec {
  accel: number;
  duration: number;
  capMult: number;
}

const TURBO: BoostSpec = { accel: 17, duration: 2.6, capMult: 1.3 };
const TURBO2: BoostSpec = { accel: 28, duration: 3.4, capMult: 1.75 };
const REACTOR_DURATION = 2.4;
const REACTOR_ACCEL = 24;
const REACTOR_LIFT = 0.62;
const GRAVITY_DURATION = 4.0;
const GRAVITY_SCALE = 0.42;
const SLOWMO_SCALE = 0.35;
/** Seconds an effect lingers after the wheels leave the block. */
const LINGER = { noSteer: 0.25, noBrake: 0.25, cruise: 0.25, engineOff: 0.5, slowMo: 0.35 };

/**
 * Timers for every special-block effect. Touching a block (re)arms its timer; `update` runs once per
 * physics tick, so effects are fully deterministic and part of the simulation state.
 */
export class EffectState {
  private turboT = 0;
  private turboSpec: BoostSpec = TURBO;
  private turboAge = 0;
  private reactorT = 0;
  private noSteerT = 0;
  private noBrakeT = 0;
  private cruiseT = 0;
  private cruiseSpeed = 0;
  private engineOffT = 0;
  private slowT = 0;
  private timeScale = 1;
  private gravityT = 0;
  readonly mods: EffectModifiers = {
    boostAccel: 0, boostCap: 0, lift: 0, noSteer: false, noBrake: false, engineOff: false,
    cruiseSpeed: null, timeScale: 1, gravityScale: 1, boostLevel: 0, active: [],
  };

  reset(): void {
    this.turboT = this.reactorT = this.noSteerT = this.noBrakeT = this.cruiseT = 0;
    this.engineOffT = this.slowT = this.gravityT = this.turboAge = 0;
    this.timeScale = 1;
    this.mods.boostAccel = this.mods.boostCap = this.mods.lift = this.mods.boostLevel = 0;
    this.mods.noSteer = this.mods.noBrake = this.mods.engineOff = false;
    this.mods.cruiseSpeed = null;
    this.mods.timeScale = 1;
    this.mods.gravityScale = 1;
    this.mods.active.length = 0;
  }

  /**
   * @param touching effects under the wheels this tick (may contain duplicates)
   * @param dt real (unscaled) tick length
   */
  update(touching: readonly EffectId[], dt: number, forwardSpeed: number, topSpeed: number): EffectModifiers {
    let cruiseTouch = false;
    for (const e of touching) {
      switch (e) {
        case 'turbo':
          if (this.turboT <= 0) this.turboAge = 0;
          // a stronger boost already running is not downgraded
          if (this.turboT <= 0 || this.turboSpec === TURBO) this.turboSpec = TURBO;
          this.turboT = Math.max(this.turboT, TURBO.duration);
          break;
        case 'turbo2':
          if (this.turboT <= 0) this.turboAge = 0;
          this.turboSpec = TURBO2;
          this.turboT = Math.max(this.turboT, TURBO2.duration);
          break;
        case 'reactor':
          this.reactorT = Math.max(this.reactorT, REACTOR_DURATION);
          break;
        case 'noSteer':
          this.noSteerT = LINGER.noSteer;
          break;
        case 'noBrake':
          this.noBrakeT = LINGER.noBrake;
          break;
        case 'cruise':
          cruiseTouch = true;
          break;
        case 'engineOff':
          this.engineOffT = LINGER.engineOff;
          break;
        case 'slowMo':
          this.slowT = LINGER.slowMo;
          break;
        case 'gravity':
          this.gravityT = GRAVITY_DURATION;
          break;
        default:
          break;
      }
    }
    if (cruiseTouch) {
      if (this.cruiseT <= 0) this.cruiseSpeed = Math.min(70, Math.max(10, forwardSpeed));
      this.cruiseT = LINGER.cruise;
    }

    const m = this.mods;
    m.active.length = 0;

    // --- boosts ---
    m.boostAccel = 0;
    m.boostCap = topSpeed;
    m.boostLevel = 0;
    if (this.turboT > 0) {
      this.turboAge += dt;
      const spec = this.turboSpec;
      const fade = Math.min(1, this.turboT / 0.5) * Math.min(1, this.turboAge / 0.08);
      m.boostAccel += spec.accel * fade;
      m.boostCap = Math.max(m.boostCap, topSpeed * spec.capMult);
      m.boostLevel = Math.max(m.boostLevel, fade);
      m.active.push(spec === TURBO2 ? 'turbo2' : 'turbo');
      this.turboT -= dt;
    } else {
      this.turboAge = 0;
    }
    m.lift = 0;
    if (this.reactorT > 0) {
      const fade = Math.min(1, this.reactorT / 0.5);
      m.boostAccel += REACTOR_ACCEL * fade;
      m.boostCap = Math.max(m.boostCap, topSpeed * 1.5);
      m.lift = REACTOR_LIFT * fade;
      m.boostLevel = Math.max(m.boostLevel, fade);
      m.active.push('reactor');
      this.reactorT -= dt;
    }

    // --- control locks ---
    m.noSteer = this.noSteerT > 0;
    if (m.noSteer) m.active.push('noSteer');
    this.noSteerT -= dt;
    m.noBrake = this.noBrakeT > 0;
    if (m.noBrake) m.active.push('noBrake');
    this.noBrakeT -= dt;
    m.engineOff = this.engineOffT > 0;
    if (m.engineOff) m.active.push('engineOff');
    this.engineOffT -= dt;
    m.cruiseSpeed = this.cruiseT > 0 ? this.cruiseSpeed : null;
    if (m.cruiseSpeed !== null) m.active.push('cruise');
    this.cruiseT -= dt;

    // --- time / gravity ---
    const slowTarget = this.slowT > 0 ? SLOWMO_SCALE : 1;
    if (this.slowT > 0) m.active.push('slowMo');
    this.slowT -= dt;
    this.timeScale += (slowTarget - this.timeScale) * Math.min(1, dt * 7);
    m.timeScale = this.timeScale;
    m.gravityScale = this.gravityT > 0 ? GRAVITY_SCALE : 1;
    if (this.gravityT > 0) m.active.push('gravity');
    this.gravityT -= dt;
    return m;
  }
}
