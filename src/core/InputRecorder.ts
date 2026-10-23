import { InputFrame, PEDAL_Q, STEER_Q, framesEqual, makeFrame } from './InputFrame';

/** One run-length-encoded span of identical frames. */
interface Span {
  count: number;
  frame: InputFrame;
}

/** Records one InputFrame per physics tick, run-length encoded (typical runs compress very well). */
export class InputRecorder {
  private spans: Span[] = [];
  private _ticks = 0;

  get ticks(): number {
    return this._ticks;
  }

  clear(): void {
    this.spans.length = 0;
    this._ticks = 0;
  }

  push(frame: InputFrame): void {
    const last = this.spans[this.spans.length - 1];
    if (last && framesEqual(last.frame, frame)) {
      last.count++;
    } else {
      this.spans.push({ count: 1, frame: { ...frame } });
    }
    this._ticks++;
  }

  /** Expand to one frame per tick. */
  toFrames(): InputFrame[] {
    const out: InputFrame[] = [];
    for (const s of this.spans) for (let i = 0; i < s.count; i++) out.push(s.frame);
    return out;
  }

  /**
   * Compact binary (version 2): `[u8 2][varint spanCount]` then per span
   * `[varint count][u8 flags][zigzag varint steer delta?][u8 accel?][u8 brake?]`.
   * Flags: bit0 respawn, bit1 steer changed, bit2 accel changed, bit3 brake changed. Analog steering
   * moves in small steps, so a typical tick costs 2-3 bytes.
   */
  toBytes(): Uint8Array {
    const out: number[] = [2];
    const varint = (n: number): void => {
      let v = n >>> 0;
      while (v >= 0x80) {
        out.push((v & 0x7f) | 0x80);
        v >>>= 7;
      }
      out.push(v);
    };
    varint(this.spans.length);
    let steer = 0, accel = 0, brake = 0;
    for (const sp of this.spans) {
      const st = Math.round(sp.frame.steer * STEER_Q);
      const ac = Math.round(sp.frame.accel * PEDAL_Q);
      const br = Math.round(sp.frame.brake * PEDAL_Q);
      varint(sp.count);
      out.push((sp.frame.respawn ? 1 : 0) | (st !== steer ? 2 : 0) | (ac !== accel ? 4 : 0) | (br !== brake ? 8 : 0));
      if (st !== steer) varint(((st - steer) << 1) ^ ((st - steer) >> 31)); // zigzag
      if (ac !== accel) out.push(ac);
      if (br !== brake) out.push(br);
      steer = st;
      accel = ac;
      brake = br;
    }
    return Uint8Array.from(out);
  }

  static fromBytes(bytes: Uint8Array): InputRecorder {
    let o = 0;
    if (bytes[o++] !== 2) throw new Error('unsupported input recording version');
    const varint = (): number => {
      let v = 0, shift = 0, b: number;
      do {
        b = bytes[o++]!;
        v |= (b & 0x7f) << shift;
        shift += 7;
      } while (b & 0x80);
      return v >>> 0;
    };
    const n = varint();
    const rec = new InputRecorder();
    let steer = 0, accel = 0, brake = 0;
    for (let i = 0; i < n; i++) {
      const count = varint();
      const flags = bytes[o++]!;
      if (flags & 2) {
        const z = varint();
        steer += (z >>> 1) ^ -(z & 1);
      }
      if (flags & 4) accel = bytes[o++]!;
      if (flags & 8) brake = bytes[o++]!;
      rec.spans.push({ count, frame: makeFrame(steer / STEER_Q, accel / PEDAL_Q, brake / PEDAL_Q, (flags & 1) === 1) });
      rec._ticks += count;
    }
    return rec;
  }
}

/** Plays a recorded input stream back, one frame per tick. */
export class InputPlayer {
  private readonly frames: InputFrame[];
  private idx = 0;

  constructor(frames: InputFrame[]) {
    this.frames = frames;
  }

  get finished(): boolean {
    return this.idx >= this.frames.length;
  }

  next(): InputFrame | null {
    if (this.idx >= this.frames.length) return null;
    return this.frames[this.idx++]!;
  }

  reset(): void {
    this.idx = 0;
  }
}
