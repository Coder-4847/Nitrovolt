import { Vector3 } from 'three';
import { BLOCKS } from '../tracks/BlockLibrary';
import { TrackBuilder } from '../tracks/TrackBuilder';
import { VARIANT_WIDTH } from '../tracks/TrackSchema';

const cache = new Map<string, string>();

/**
 * Palette icon: the block's driving line seen from above (start at the bottom, heading up), shaded by
 * height so ramps, slopes and loops read at a glance. Generated from the block definition itself.
 */
export function blockIcon(type: string, size = 56): string {
  const key = `${type}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = BLOCKS[type];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  if (!def) return '';
  const t = new TrackBuilder();
  t.place(new Vector3(0, 0, 0), 0);
  const width = def.fixedWidth ?? VARIANT_WIDTH.std;
  def.build(t, { width, surface: 'tarmac', effect: undefined, walls: 'none' });
  const pts = t.centerline.length ? t.centerline : [new Vector3(0, 0, 0), new Vector3(0, 0, -16)];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const pad = width / 2 + 2;
  const span = Math.max(maxX - minX, maxZ - minZ) + pad * 2;
  const scale = size / Math.max(span, 20);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const sx = (x: number): number => size / 2 + (x - cx) * scale;
  const sz = (z: number): number => size / 2 + (z - cz) * scale;
  g.fillStyle = '#101624';
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (def.category === 'scenery') {
    g.fillStyle = '#ff8a1f';
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  // road body
  g.strokeStyle = '#3a4460';
  g.lineWidth = Math.max(3, width * scale);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(sx(p.x), sz(p.z)) : g.moveTo(sx(p.x), sz(p.z))));
  g.stroke();
  // centre line coloured by height
  const span01 = maxY - minY || 1;
  g.lineWidth = Math.max(1.5, size / 28);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (a.distanceTo(b) > 12) continue;
    const h = (b.y - minY) / span01;
    g.strokeStyle = maxY - minY < 0.5 ? '#18e0ff' : `hsl(${190 - h * 170}, 95%, ${55 + h * 10}%)`;
    g.beginPath();
    g.moveTo(sx(a.x), sz(a.z));
    g.lineTo(sx(b.x), sz(b.z));
    g.stroke();
  }
  // exit arrow
  if (pts.length > 1) {
    const e = pts[pts.length - 1]!, d = pts[pts.length - 2]!;
    const ang = Math.atan2(sz(e.z) - sz(d.z), sx(e.x) - sx(d.x));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(sx(e.x) + Math.cos(ang) * 5, sz(e.z) + Math.sin(ang) * 5);
    g.lineTo(sx(e.x) + Math.cos(ang + 2.4) * 5, sz(e.z) + Math.sin(ang + 2.4) * 5);
    g.lineTo(sx(e.x) + Math.cos(ang - 2.4) * 5, sz(e.z) + Math.sin(ang - 2.4) * 5);
    g.fill();
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
