import { describe, expect, it } from 'vitest';
import { InputFrame, makeFrame } from '../src/core/InputFrame';
import { InputPlayer, InputRecorder } from '../src/core/InputRecorder';

function script(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) {
    const steer = Math.sin(i / 37) * (i % 400 < 200 ? 1 : 0.4);
    out.push(makeFrame(steer, i % 300 < 250 ? 1 : 0, i % 300 >= 250 ? 0.6 : 0, i === 500));
  }
  return out;
}

describe('InputFrame', () => {
  it('quantises so live and replayed values are identical', () => {
    const f = makeFrame(0.123456789, 0.5, 0.25);
    expect(f.steer * 1024).toBe(Math.round(f.steer * 1024));
    expect(makeFrame(f.steer, f.accel, f.brake)).toEqual(f);
  });
  it('clamps out-of-range input', () => {
    const f = makeFrame(5, 2, -1);
    expect(f.steer).toBe(1);
    expect(f.accel).toBe(1);
    expect(f.brake).toBe(0);
  });
});

describe('InputRecorder', () => {
  it('round-trips through the binary format exactly', () => {
    const frames = script(2000);
    const rec = new InputRecorder();
    for (const f of frames) rec.push(f);
    expect(rec.ticks).toBe(2000);
    const back = InputRecorder.fromBytes(rec.toBytes());
    expect(back.ticks).toBe(2000);
    expect(back.toFrames()).toEqual(frames);
  });
  it('run-length encodes steady input compactly', () => {
    const rec = new InputRecorder();
    for (let i = 0; i < 6000; i++) rec.push(makeFrame(0, 1, 0));
    expect(rec.toBytes().byteLength).toBeLessThan(32);
  });
  it('player replays frames in order', () => {
    const frames = script(10);
    const p = new InputPlayer(frames);
    for (const f of frames) expect(p.next()).toEqual(f);
    expect(p.finished).toBe(true);
    expect(p.next()).toBeNull();
  });
});
