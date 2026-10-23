import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

/** Common surface for the replay viewer's extra cameras. */
export interface ViewCam {
  readonly camera: PerspectiveCamera;
  enable(el: HTMLElement): void;
  disable(): void;
  /** `target` is the car position (orbit follows it; free ignores it). */
  update(dt: number, target: Vector3): void;
}

/** Fly camera: WASD move, Q/E down/up, Shift fast, drag (mouse / touch) to look, wheel changes speed. */
export class FreeCam implements ViewCam {
  readonly camera = new PerspectiveCamera(65, 16 / 9, 0.1, 4000);
  private yaw = 0;
  private pitch = -0.2;
  private speed = 25;
  private readonly keys = new Set<string>();
  private el: HTMLElement | null = null;
  private drag: { x: number; y: number } | null = null;
  private pointer = -1;

  /** Start from where another camera currently is. */
  placeAt(pos: Vector3, lookAt: Vector3): void {
    this.camera.position.copy(pos);
    const d = lookAt.clone().sub(pos).normalize();
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(MathUtils.clamp(d.y, -1, 1));
  }

  enable(el: HTMLElement): void {
    this.el = el;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
  }

  disable(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.el?.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.el?.removeEventListener('wheel', this.onWheel);
    this.keys.clear();
    this.el = null;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.type === 'keydown') this.keys.add(e.code);
    else this.keys.delete(e.code);
  };
  private onDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('.replay-bar')) return;
    this.drag = { x: e.clientX, y: e.clientY };
    this.pointer = e.pointerId;
  };
  private onMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.pointer) return;
    this.yaw -= (e.clientX - this.drag.x) * 0.005;
    this.pitch = MathUtils.clamp(this.pitch - (e.clientY - this.drag.y) * 0.005, -1.5, 1.5);
    this.drag = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointer) this.drag = null;
  };
  private onWheel = (e: WheelEvent): void => {
    this.speed = MathUtils.clamp(this.speed * (e.deltaY < 0 ? 1.15 : 0.87), 4, 250);
  };

  update(dt: number, _target?: Vector3): void {
    const k = this.keys;
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
    const f = new Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const r = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new Vector3();
    if (k.has('KeyW') || k.has('ArrowUp')) move.add(f);
    if (k.has('KeyS') || k.has('ArrowDown')) move.sub(f);
    if (k.has('KeyD') || k.has('ArrowRight')) move.add(r);
    if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(r);
    if (k.has('KeyE') || k.has('Space')) move.y += 1;
    if (k.has('KeyQ') || k.has('KeyC')) move.y -= 1;
    if (move.lengthSq() > 0) this.camera.position.addScaledVector(move.normalize(), this.speed * fast * dt);
    this.camera.lookAt(this.camera.position.clone().add(f));
  }
}

/** Orbit camera around the car: drag to rotate, wheel / pinch to zoom. Works with touch. */
export class OrbitCam implements ViewCam {
  readonly camera = new PerspectiveCamera(60, 16 / 9, 0.1, 4000);
  private yaw = 0.6;
  private pitch = 0.35;
  private dist = 9;
  private el: HTMLElement | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  enable(el: HTMLElement): void {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
  }

  disable(): void {
    this.el?.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.el?.removeEventListener('wheel', this.onWheel);
    this.pointers.clear();
    this.el = null;
  }

  private onDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('.replay-bar')) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (this.pointers.size === 1) {
      this.yaw -= (e.clientX - p.x) * 0.006;
      this.pitch = MathUtils.clamp(this.pitch + (e.clientY - p.y) * 0.006, -0.2, 1.45);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0) this.dist = MathUtils.clamp(this.dist * (this.pinch / d), 3, 80);
      this.pinch = d;
    }
  };
  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
  };
  private onWheel = (e: WheelEvent): void => {
    this.dist = MathUtils.clamp(this.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3, 80);
  };

  update(_dt: number, target: Vector3): void {
    const c = Math.cos(this.pitch);
    this.camera.position.set(target.x + Math.sin(this.yaw) * c * this.dist, target.y + Math.sin(this.pitch) * this.dist + 0.6, target.z + Math.cos(this.yaw) * c * this.dist);
    this.camera.lookAt(target.x, target.y + 0.5, target.z);
  }
}
