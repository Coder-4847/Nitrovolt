/**
 * Fixed-timestep accumulator. Physics always advances in exact PHYSICS_DT slices;
 * rendering gets an interpolation alpha in [0,1) between the last two physics states.
 */
export const PHYSICS_HZ = 100;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

/** Never run more than this many steps in one frame (avoids the spiral of death after tab stalls). */
const MAX_STEPS_PER_FRAME = 8;

export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** Multiplier on simulated time (slow-motion blocks / debugging). 1 = realtime. */
  timeScale = 1;
  /** Steps executed in the most recent frame (debug). */
  lastStepCount = 0;
  /** Wall-clock ms spent inside `step` callbacks on the most recent frame (debug). */
  lastStepMs = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25; // tab was backgrounded
    this.acc += dt * this.timeScale;

    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
      this.step();
      this.acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // drop the backlog instead of spiralling
    this.lastStepMs = performance.now() - t0;
    this.lastStepCount = steps;

    this.render(this.acc / PHYSICS_DT, dt);
  };
}
