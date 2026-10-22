import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** One texture tile = 4 m x 4 m. Subtle grid so speed and slope read clearly on grey-box geometry. */
export function makeGridTexture(): CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#c9ccd2';
    g.fillRect(0, 0, s, s);
    // faint noise-free panel shading
    g.fillStyle = '#d3d6db';
    g.fillRect(4, 4, s - 8, s - 8);
    g.strokeStyle = '#7d828c';
    g.lineWidth = 6;
    g.strokeRect(0, 0, s, s);
    g.strokeStyle = 'rgba(120,126,138,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s / 2, 0); g.lineTo(s / 2, s);
    g.moveTo(0, s / 2); g.lineTo(s, s / 2);
    g.stroke();
  });
}

/** Red/white hazard stripes for barriers. */
export function makeStripeTexture(): CanvasTexture {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#e0323a';
    for (let i = -1; i < 3; i++) {
      g.beginPath();
      g.moveTo(0, i * s / 2 + s / 4);
      g.lineTo(s, i * s / 2 - s / 4 + s / 2);
      g.lineTo(s, i * s / 2 + s / 2 + s / 4);
      g.lineTo(0, i * s / 2 + s / 2 + s / 4 + s / 4);
      g.closePath();
      g.fill();
    }
  });
}
