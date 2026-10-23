import { SURFACES } from '../physics/Surface';
import { TrackData } from '../tracks/TrackTypes';
import { themeFor } from './env/Theme';

const cache = new Map<string, string>();

/**
 * Generated level thumbnail: the driving line seen from above, coloured by surface and shaded by height,
 * with jump gaps dashed and start / checkpoint / finish markers. Pure canvas, no WebGL.
 */
export function levelThumbnail(track: TrackData, w = 320, h = 180): string {
  const key = `${track.id}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, h);
  // tinted by the level's theme so a season reads at a glance
  const th = themeFor(track.theme);
  const css = (c: number, k: number): string => `rgb(${((c >> 16) & 255) * k | 0},${((c >> 8) & 255) * k | 0},${(c & 255) * k | 0})`;
  bg.addColorStop(0, css(th.sky.zenith, th.night ? 0.9 : 0.45));
  bg.addColorStop(1, css(th.ground.a, th.night ? 1 : 0.32));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,160,255,0.08)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }

  const pts = track.centerline;
  if (pts.length < 2) return '';
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const pad = 18;
  const sx = (w - pad * 2) / Math.max(1, maxX - minX);
  const sz = (h - pad * 2) / Math.max(1, maxZ - minZ);
  const scale = Math.min(sx, sz);
  const ox = (w - (maxX - minX) * scale) / 2;
  const oz = (h - (maxZ - minZ) * scale) / 2;
  const X = (x: number): number => ox + (x - minX) * scale;
  const Z = (z: number): number => oz + (z - minZ) * scale;
  const hs = (y: number): number => (maxY > minY ? (y - minY) / (maxY - minY) : 0.5);

  g.lineCap = 'round';
  g.lineJoin = 'round';
  // dark casing so the line reads over itself in loops
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const gap = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y) > 12;
      g.beginPath();
      g.moveTo(X(a.x), Z(a.z));
      g.lineTo(X(b.x), Z(b.z));
      if (gap) {
        if (pass === 1) {
          g.setLineDash([3, 4]);
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = 2;
          g.stroke();
          g.setLineDash([]);
        }
        continue;
      }
      if (pass === 0) {
        g.strokeStyle = 'rgba(0,0,0,0.65)';
        g.lineWidth = 6;
      } else {
        const col = SURFACES[track.centerSurface[i] ?? 'tarmac'].color;
        const r = (col >> 16) & 255, gg = (col >> 8) & 255, bb = col & 255;
        const k = 0.65 + 0.5 * hs(a.y);
        g.strokeStyle = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, bb * k) | 0})`;
        g.lineWidth = 3.4;
      }
      g.stroke();
    }
  }

  const dot = (x: number, z: number, color: string, r: number): void => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(X(x), Z(z), r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  };
  for (const t of track.triggers) dot(t.position.x, t.position.z, t.kind === 'finish' ? '#ff3b2f' : '#18e0ff', t.kind === 'finish' ? 4.5 : 3);
  dot(track.start.position.x, track.start.position.z, '#39ff88', 4.5);

  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
