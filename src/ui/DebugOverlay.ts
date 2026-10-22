import { Vehicle } from '../physics/Vehicle';

const WN = ['FL', 'FR', 'RL', 'RR'];

/** Text debug HUD: speed, slip, grip use, wheel contacts, frame timings. */
export class DebugOverlay {
  private readonly el: HTMLElement;
  private visible: boolean;
  private acc = 0;
  private frames = 0;
  private fps = 0;

  constructor(parent: HTMLElement, startVisible: boolean) {
    this.el = document.createElement('div');
    this.el.className = 'debug';
    parent.appendChild(this.el);
    this.visible = startVisible;
    this.el.classList.toggle('on', this.visible);
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.el.classList.toggle('on', this.visible);
    return this.visible;
  }

  update(dt: number, v: Vehicle, input: { steer: number; accel: number; brake: number }, stepMs: number, steps: number, tick: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 0.15) return;
    this.fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (!this.visible) return;
    const bar = (x: number, max = 1.2): string => `<span class="bar" style="width:${Math.round(Math.min(1, Math.abs(x) / max) * 60)}px"></span>`;
    let s = '';
    s += `fps ${this.fps.toFixed(0)}  phys ${stepMs.toFixed(2)}ms x${steps}  tick ${tick}\n`;
    s += `speed ${(v.speed * 3.6).toFixed(0)} km/h  fwd ${(v.forwardSpeed * 3.6).toFixed(0)}  air ${v.airTime.toFixed(2)}s\n`;
    s += `body slip ${(v.bodySlip * 57.3).toFixed(1)}°  yaw ${v.angvel.y.toFixed(2)} rad/s  steer ${(v.steerAngle * 57.3).toFixed(1)}°\n`;
    s += `in  steer ${input.steer.toFixed(2)}  gas ${input.accel.toFixed(2)}  brk ${input.brake.toFixed(2)}\n`;
    s += `wheels on ground ${v.wheelsOnGround}/4\n`;
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i]!;
      s += `${WN[i]} ${w.contact ? '●' : '○'} ${w.surface.padEnd(7)} load ${String(Math.round(w.load)).padStart(5)}N  slip ${(w.slipAngle * 57.3).toFixed(1).padStart(5)}° grip ${bar(w.gripUse)} ${w.gripUse.toFixed(2)}${w.slipping ? ' SPIN' : ''}\n`;
    }
    this.el.innerHTML = s;
  }
}
