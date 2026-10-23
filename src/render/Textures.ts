import { EffectId } from '../physics/Surface';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function hexCss(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

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

const hex = (c: number): string => hexCss(c);

/** Mix two sRGB hex colours. */
function mixHex(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Pad textures for special blocks: one tile = 4 m x 4 m. A panel in the effect's colour (toned down
 * toward dark grey) with lighter painted markings; the same texture drives the faint backlight.
 */
export function makeEffectTexture(effect: EffectId, color: number, _glow: number): CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = hex(mixHex(color, 0x2a2d33, 0.45));
    g.fillRect(0, 0, s, s);
    const mark = hex(mixHex(color, 0xffffff, 0.55));
    g.strokeStyle = mark;
    g.fillStyle = mark;
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
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, s - 4, s - 4);
  });
}
