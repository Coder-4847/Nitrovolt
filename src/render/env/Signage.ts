import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Procedural signage for the arena: the NITROVOLT wordmark painted on the road, LED ad boards, video
 * screens, arch signs and flags. Everything is drawn on canvases at load time (no image files) and the
 * results are cached per key.
 */
const cache = new Map<string, CanvasTexture>();

const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

const FONT = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", Impact, sans-serif';

/** The lightning-bolt mark (32x32 design grid), drawn into a box at (x, y) of size s. */
function bolt(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const P: Array<[number, number]> = [[18, 3], [7, 18], [14, 18], [12, 29], [24, 12], [17, 12]];
  g.beginPath();
  P.forEach(([px, py], i) => (i ? g.lineTo(x + (px / 32) * s, y + (py / 32) * s) : g.moveTo(x + (px / 32) * s, y + (py / 32) * s)));
  g.closePath();
  g.fill();
}

/** Italic, heavy wordmark with the bolt; `accent` colours "VOLT". */
function wordmark(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, ink: string, accent: string): void {
  g.save();
  g.font = `italic 800 ${size}px ${FONT}`;
  g.textBaseline = 'middle';
  const a = 'NITRO', b = 'VOLT';
  const wa = g.measureText(a).width, wb = g.measureText(b).width;
  const bs = size * 0.95;
  const total = wa + wb + bs * 0.7;
  let x = cx - total / 2;
  g.fillStyle = accent;
  bolt(g, x - bs * 0.1, cy - bs / 2, bs);
  x += bs * 0.7;
  g.fillStyle = ink;
  g.fillText(a, x, cy);
  g.fillStyle = accent;
  g.fillText(b, x + wa, cy);
  g.restore();
}

/** Painted road graphic for the start straight: the wordmark in a slanted badge (alpha = paint). */
export function roadLogoTexture(accent: number): CanvasTexture {
  return make(`roadlogo:${accent}`, 1024, 512, (g) => {
    g.clearRect(0, 0, 1024, 512);
    g.save();
    g.translate(512, 256);
    g.transform(1, 0, -0.18, 1, 0, 0);
    g.fillStyle = 'rgba(20,24,32,0.92)';
    g.fillRect(-470, -150, 940, 300);
    g.fillStyle = css(accent);
    g.fillRect(-470, 110, 940, 40);
    g.fillStyle = '#f4f6f8';
    g.fillRect(-470, -150, 940, 14);
    g.restore();
    wordmark(g, 512, 236, 190, '#f4f6f8', css(accent));
  });
}

/** Text that runs along the road edges (repeats along the road; alpha = paint). */
export function edgeTextTexture(): CanvasTexture {
  return make('edgetext', 2048, 128, (g) => {
    g.clearRect(0, 0, 2048, 128);
    g.font = `italic 800 96px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillText('NITROVOLT', 40, 66);
    g.font = `italic 700 76px ${FONT}`;
    g.fillText('GRAND PRIX', 1120, 66);
    g.fillRect(860, 40, 160, 52);
  }, true);
}

/** Scrolling LED ad board strip: alternating wordmark and slogans on a dark panel. */
export function ledBoardTexture(accent: number): CanvasTexture {
  return make(`led:${accent}`, 2048, 128, (g) => {
    g.fillStyle = '#0b0e14';
    g.fillRect(0, 0, 2048, 128);
    const items: Array<() => void> = [
      () => wordmark(g, 280, 66, 84, '#ffffff', css(accent)),
      () => {
        g.fillStyle = css(accent);
        g.fillRect(560, 22, 420, 84);
        g.font = `italic 800 70px ${FONT}`;
        g.fillStyle = '#0b0e14';
        g.textBaseline = 'middle';
        g.fillText('TIME ATTACK', 590, 66);
      },
      () => {
        g.font = `italic 700 72px ${FONT}`;
        g.fillStyle = '#ffffff';
        g.textBaseline = 'middle';
        g.fillText('GRAND PRIX', 1060, 66);
      },
      () => {
        for (let k = 0; k < 6; k++) {
          g.fillStyle = k % 2 ? css(accent) : '#ffffff';
          g.beginPath();
          const x = 1420 + k * 46;
          g.moveTo(x, 28); g.lineTo(x + 30, 64); g.lineTo(x, 100); g.lineTo(x + 18, 100); g.lineTo(x + 48, 64); g.lineTo(x + 18, 28);
          g.closePath();
          g.fill();
        }
      },
      () => wordmark(g, 1880, 66, 64, '#ffffff', css(accent)),
    ];
    for (const f of items) f();
    // LED pixel grid
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = 0; x < 2048; x += 4) g.fillRect(x, 0, 1, 128);
    for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 2048, 1);
  }, true);
}

/** Big video screen art: a gradient, the wordmark and a stylised open-wheel car silhouette. */
export function screenTexture(accent: number, variant: number): CanvasTexture {
  return make(`screen:${accent}:${variant}`, 512, 1024, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0, variant % 2 ? '#0d2a3a' : '#141c34');
    grd.addColorStop(1, variant % 2 ? '#11506a' : '#23307a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 1024);
    // a driver figure (helmet + shoulders) in light tone, as on stadium screens
    g.fillStyle = 'rgba(220,240,255,0.85)';
    g.beginPath();
    g.ellipse(256, 380, 88, 100, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(150, 470, 212, 300);
    g.beginPath();
    g.moveTo(150, 520); g.lineTo(90, 760); g.lineTo(150, 770);
    g.moveTo(362, 520); g.lineTo(422, 760); g.lineTo(362, 770);
    g.fill();
    g.fillStyle = 'rgba(13,20,40,0.9)';
    g.fillRect(186, 350, 140, 46);
    g.fillStyle = css(accent);
    g.fillRect(0, 880, 512, 10);
    wordmark(g, 256, 950, 64, '#ffffff', css(accent));
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 1024; y += 4) g.fillRect(0, y, 512, 1);
  });
}

/** Arch sign: dark board with big condensed text, an accent band and chevrons. */
export function archSignTexture(text: string, accent: number, ink = '#ffffff'): CanvasTexture {
  return make(`arch:${text}:${accent}:${ink}`, 1024, 256, (g) => {
    g.fillStyle = css(accent);
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#10131a';
    g.fillRect(14, 14, 996, 228);
    g.fillStyle = css(accent);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = side < 0 ? 60 + k * 54 : 964 - k * 54;
        g.beginPath();
        g.moveTo(x, 70); g.lineTo(x + side * 34, 128); g.lineTo(x, 186); g.lineTo(x + side * 16, 186); g.lineTo(x + side * 50, 128); g.lineTo(x + side * 16, 70);
        g.closePath();
        g.fill();
      }
    }
    g.font = `italic 800 150px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    g.fillText(text, 512, 136, 640);
  });
}

/** Atlas of 16 flags (4 x 4), generic national-style designs: stripes, crosses, discs. */
export function flagAtlasTexture(): CanvasTexture {
  const C = [0xd62828, 0xffffff, 0x1d4ed8, 0x15803d, 0xfacc15, 0x111827, 0xf97316, 0x0ea5e9, 0x7c3aed, 0xbe123c];
  return make('flags', 512, 512, (g) => {
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pick = (): string => css(C[Math.floor(rnd() * C.length)]!);
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 128, y = Math.floor(i / 4) * 128, w = 128, h = 128;
      const a = pick(), b = pick(), c = pick();
      const kind = i % 5;
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      if (kind === 0) { g.fillStyle = a; g.fillRect(x, y, w / 3, h); g.fillStyle = b; g.fillRect(x + w / 3, y, w / 3, h); g.fillStyle = c; g.fillRect(x + (2 * w) / 3, y, w / 3, h); }
      else if (kind === 1) { g.fillStyle = a; g.fillRect(x, y, w, h / 3); g.fillStyle = b; g.fillRect(x, y + h / 3, w, h / 3); g.fillStyle = c; g.fillRect(x, y + (2 * h) / 3, w, h / 3); }
      else if (kind === 2) { g.fillStyle = a; g.fillRect(x, y, w, h); g.fillStyle = b; g.fillRect(x + w * 0.3, y, w * 0.14, h); g.fillRect(x, y + h * 0.43, w, h * 0.14); }
      else if (kind === 3) { g.fillStyle = a; g.fillRect(x, y, w, h); g.fillStyle = b; g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = a; g.fillRect(x, y, w, h / 2); g.fillStyle = b; g.fillRect(x, y + h / 2, w, h / 2); g.fillStyle = c; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.4, y + h / 2); g.lineTo(x, y + h); g.fill(); }
      g.restore();
    }
  });
}

/** Seat colours for stand sections. */
export const SEAT_COLORS = [0x1aa6a6, 0x168f9b, 0x2b6cb0, 0x1f8a8a, 0x2c7a9a];
