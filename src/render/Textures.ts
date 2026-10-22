import { EffectId } from '../physics/Surface';
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


const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/** Pad textures for special blocks: one tile = 4 m x 4 m; the bright pattern is also used as the emissive map. */
export function makeEffectTexture(effect: EffectId, color: number, glow: number): CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = hex((color >> 1) & 0x7f7f7f);
    g.fillRect(0, 0, s, s);
    g.strokeStyle = hex(glow);
    g.fillStyle = hex(glow);
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const chevron = (y: number, w = 80, h = 50): void => {
      g.beginPath();
      g.moveTo(s / 2 - w, y + h);
      g.lineTo(s / 2, y);
      g.lineTo(s / 2 + w, y + h);
      g.stroke();
    };
    switch (effect) {
      case 'turbo':
        chevron(60);
        chevron(150);
        break;
      case 'turbo2':
        chevron(30, 90, 44);
        chevron(100, 90, 44);
        chevron(170, 90, 44);
        break;
      case 'reactor':
        chevron(40, 70, 60);
        chevron(130, 70, 60);
        g.beginPath();
        g.arc(s / 2, 225, 16, 0, Math.PI * 2);
        g.fill();
        break;
      case 'noSteer':
        g.beginPath();
        g.arc(s / 2, s / 2, 70, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(s / 2 - 50, s / 2 - 50); g.lineTo(s / 2 + 50, s / 2 + 50);
        g.moveTo(s / 2 + 50, s / 2 - 50); g.lineTo(s / 2 - 50, s / 2 + 50);
        g.stroke();
        break;
      case 'noBrake':
        for (let y = 30; y < s; y += 70) {
          g.beginPath();
          g.moveTo(30, y); g.lineTo(s - 30, y);
          g.stroke();
        }
        break;
      case 'cruise':
        for (let y = 40; y < s; y += 90) for (let x = 40; x < s; x += 90) {
          g.beginPath();
          g.arc(x + 20, y + 20, 22, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'fragile':
        g.lineWidth = 6;
        g.strokeStyle = '#5a4a32';
        g.beginPath();
        g.moveTo(10, 40); g.lineTo(90, 110); g.lineTo(60, 170); g.lineTo(140, 240);
        g.moveTo(90, 110); g.lineTo(190, 90); g.lineTo(250, 140);
        g.moveTo(190, 90); g.lineTo(210, 10);
        g.stroke();
        break;
      case 'slowMo':
        for (const r of [28, 60, 92]) {
          g.beginPath();
          g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
          g.stroke();
        }
        break;
      case 'engineOff':
        g.lineWidth = 16;
        for (let k = -s; k < s * 2; k += 56) {
          g.beginPath();
          g.moveTo(k, 0); g.lineTo(k - s, s);
          g.stroke();
        }
        break;
      case 'gravity':
        for (const [x, d] of [[70, 1], [186, -1]] as const) {
          g.beginPath();
          g.moveTo(x - 36, s / 2 + 28 * d); g.lineTo(x, s / 2 - 28 * d); g.lineTo(x + 36, s / 2 + 28 * d);
          g.stroke();
        }
        break;
    }
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 5;
    g.strokeRect(2, 2, s - 4, s - 4);
  });
}
