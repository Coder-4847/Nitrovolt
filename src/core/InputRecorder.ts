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

  /** Compact binary: [u32 spanCount] then per span [u32 count, i16 steer, u8 accel, u8 brake, u8 flags]. */
  toBytes(): Uint8Array {
    const SPAN_BYTES = 9;
    const buf = new ArrayBuffer(4 + this.spans.length * SPAN_BYTES);
    const dv = new DataView(buf);
    dv.setUint32(0, this.spans.length, true);
    let o = 4;
    for (const s of this.spans) {
      dv.setUint32(o, s.count, true);
      dv.setInt16(o + 4, Math.round(s.frame.steer * STEER_Q), true);
      dv.setUint8(o + 6, Math.round(s.frame.accel * PEDAL_Q));
      dv.setUint8(o + 7, Math.round(s.frame.brake * PEDAL_Q));
      dv.setUint8(o + 8, s.frame.respawn ? 1 : 0);
      o += SPAN_BYTES;
    }
    return new Uint8Array(buf);
  }

  static fromBytes(bytes: Uint8Array): InputRecorder {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = dv.getUint32(0, true);
    const rec = new InputRecorder();
    let o = 4;
    for (let i = 0; i < n; i++) {
      const count = dv.getUint32(o, true);
      const frame = makeFrame(
        dv.getInt16(o + 4, true) / STEER_Q,
        dv.getUint8(o + 6) / PEDAL_Q,
        dv.getUint8(o + 7) / PEDAL_Q,
        dv.getUint8(o + 8) === 1,
      );
      rec.spans.push({ count, frame });
      rec._ticks += count;
      o += 9;
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
