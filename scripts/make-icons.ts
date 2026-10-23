// Generates the PWA icons (PNG) procedurally: the NITROVOLT bolt on a dark rounded tile.
// Usage: npx tsx scripts/make-icons.ts   -> public/icons/*.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BOLT: Array<[number, number]> = [[18, 3], [7, 18], [14, 18], [12, 29], [24, 12], [17, 12]]; // 32x32 design grid

function inside(x: number, y: number, poly: Array<[number, number]>): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** `maskable`: full-bleed background and the bolt inside the 80 % safe zone. */
function icon(size: number, maskable: boolean): Buffer {
  const out = new Uint8Array(size * size * 4);
  const ss = 4;
  const radius = maskable ? 0 : size * 0.22;
  const scale = maskable ? 0.62 : 0.82; // bolt size relative to the tile
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, bolt = 0, glow = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss, py = y + (sy + 0.5) / ss;
          // rounded tile
          const dx = Math.max(radius - px, 0, px - (size - radius)), dy = Math.max(radius - py, 0, py - (size - radius));
          if (radius === 0 || dx * dx + dy * dy <= radius * radius) bg++;
          const gx = ((px / size - 0.5) / scale + 0.5) * 32, gy = ((py / size - 0.5) / scale + 0.5) * 32;
          if (inside(gx, gy, BOLT)) bolt++;
        }
      }
      // soft glow around the bolt: distance-free approximation by sampling a blurred neighbourhood
      const gx = ((x / size - 0.5) / scale + 0.5) * 32, gy = ((y / size - 0.5) / scale + 0.5) * 32;
      for (const [ox, oy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2], [-0.8, -0.8], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8]] as const) if (inside(gx + ox, gy + oy, BOLT)) glow++;
      const a = bg / (ss * ss), b = bolt / (ss * ss), g = (glow / 8) * (1 - b) * 0.55;
      // background: dark navy with a slight vertical gradient
      const t = y / size;
      let r = 10 + 8 * t, gg = 14 + 10 * t, bb = 28 + 18 * t;
      r = r * (1 - g) + 24 * g; gg = gg * (1 - g) + 224 * g; bb = bb * (1 - g) + 255 * g;
      r = r * (1 - b) + 24 * b; gg = gg * (1 - b) + 224 * b; bb = bb * (1 - b) + 255 * b;
      const i = (y * size + x) * 4;
      out[i] = Math.round(r); out[i + 1] = Math.round(gg); out[i + 2] = Math.round(bb); out[i + 3] = Math.round(255 * a);
    }
  }
  return png(size, size, out);
}

for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]] as const) {
  writeFileSync(`public/icons/${name}`, icon(size, mask));
  console.log('wrote', name);
}
