import { TouchState } from '../core/input/TouchState';
import { storage } from '../core/Storage';

type TiltPerm = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** On-screen controls: steer zones or tilt, gas/brake, big restart + respawn. Writes into TouchState. */
export class TouchControls {
  private readonly el: HTMLElement;
  private tiltOn = storage.get<boolean>('nitrovolt.tilt', false);
  private tiltBtn!: HTMLElement;
  private left!: HTMLElement;
  private right!: HTMLElement;

  constructor(parent: HTMLElement, private readonly state: TouchState) {
    this.el = document.createElement('div');
    this.el.id = 'touch';
    parent.appendChild(this.el);

    this.left = this.hold('tb steer l', '◀', (d) => (state.left = d));
    this.right = this.hold('tb steer r', '▶', (d) => (state.right = d));
    this.hold('tb gas', 'GAS', (d) => (state.gas = d));
    this.hold('tb brk', 'BRAKE', (d) => (state.brake = d));
    this.tap('tb rs', 'RESTART', () => (state.restart = true));
    this.tap('tb rp', 'RESPAWN', () => (state.respawn = true));
    this.tap('tb sm cam', '📷', () => (state.camera = true));
    this.tap('tb sm men', '☰', () => (state.pause = true));
    this.tiltBtn = this.tap('tb sm tilt', '⟲', () => this.setTilt(!this.tiltOn));

    const rotate = document.createElement('div');
    rotate.id = 'rotate';
    rotate.textContent = '↻ Rotate your device to landscape';
    parent.appendChild(rotate);

    window.addEventListener('touchstart', () => this.show(), { once: true, passive: true });
    window.addEventListener('deviceorientation', this.onOrient);
    if (this.tiltOn) this.setTilt(true, true);
    if (matchMedia('(pointer: coarse)').matches) this.show();
  }

  private show(): void {
    this.state.active = true;
    this.el.classList.add('on');
    document.body.classList.add('touch');
  }

  private bindButton(el: HTMLElement, down: () => void, up: () => void): void {
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic / already released pointer */
      }
      el.classList.add('down');
      down();
    };
    const release = (e: PointerEvent): void => {
      e.preventDefault();
      el.classList.remove('down');
      up();
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  private hold(cls: string, label: string, set: (down: boolean) => void): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = label;
    this.bindButton(el, () => set(true), () => set(false));
    this.el.appendChild(el);
    return el;
  }

  private tap(cls: string, label: string, fire: () => void): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = label;
    this.bindButton(el, fire, () => undefined);
    this.el.appendChild(el);
    return el;
  }

  private async setTilt(on: boolean, silent = false): Promise<void> {
    if (on) {
      const DOE = (window as unknown as { DeviceOrientationEvent?: TiltPerm }).DeviceOrientationEvent;
      if (DOE?.requestPermission) {
        try {
          if ((await DOE.requestPermission()) !== 'granted') return;
        } catch {
          return;
        }
      }
    }
    this.tiltOn = on;
    storage.set('nitrovolt.tilt', on);
    this.state.tilt = on ? 0 : null;
    this.left.style.display = this.right.style.display = on ? 'none' : '';
    this.tiltBtn.style.background = on ? 'rgba(24,224,255,.45)' : '';
    if (!silent) this.state.camera = false;
  }

  private onOrient = (e: DeviceOrientationEvent): void => {
    if (!this.tiltOn) return;
    // landscape: gamma/beta swap depending on screen rotation angle
    const ang = (screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 0) % 360;
    let tilt = e.gamma ?? 0;
    if (ang === 90) tilt = -(e.beta ?? 0);
    else if (ang === 270 || ang === -90) tilt = e.beta ?? 0;
    const dz = 3;
    const v = Math.abs(tilt) < dz ? 0 : Math.sign(tilt) * (Math.abs(tilt) - dz);
    this.state.tilt = Math.max(-1, Math.min(1, v / 28));
  };
}
