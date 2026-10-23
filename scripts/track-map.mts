// Top-down maps of the hand-made levels (layout, heights, checkpoints, car gates, overlaps) as one PNG
// sheet per 6 levels. Usage: npx tsx scripts/track-map.mts <outPrefix> [id,id,...]
import { chromium } from 'playwright-core';
import { buildLevel } from './levels/build';
import { DEV_DEFS, LEVEL_DEFS } from './levels/index';

const prefix = process.argv[2] ?? '/tmp/map';
const only = process.argv[3]?.split(',');
const defs = [...LEVEL_DEFS, ...DEV_DEFS].filter((d) => (only ? only.includes(d.id) : !DEV_DEFS.includes(d)));
const GATE_COL: Record<string, string> = { volt: '#2aa8ff', gravel: '#ff8a2a', frost: '#9fe6ff', dune: '#ffd23a' };
const SURF_COL: Record<string, string> = { dirt: '#b0703c', grass: '#4c9a3a', ice: '#bfeeff', snow: '#f4f8fb', sand: '#e6c27a', wood: '#9a6a3a', plastic: '#e05aa0' };

function svgFor(id: string): string {
  const d = defs.find((x) => x.id === id)!;
  const b = buildLevel(d);
  const t = b.track;
  const c = t.centerline, f = t.centerFrame;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of c) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const pad = 30;
  const w = maxX - minX + pad * 2, h = maxZ - minZ + pad * 2;
  const segs: Array<{ y: number; svg: string }> = [];
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1]!, p = c[i]!;
    const k = (p.y - minY) / Math.max(1, maxY - minY);
    if (f[i]!.kind === 'gap') {
      segs.push({ y: p.y, svg: `<line x1="${a.x}" y1="${a.z}" x2="${p.x}" y2="${p.z}" stroke="#ff5050" stroke-width="3" stroke-dasharray="6 5"/>` });
      continue;
    }
    if (a.distanceTo(p) > 20) continue;
    const surf = t.centerSurface[i]!;
    const col = SURF_COL[surf] ?? `hsl(${220 - 200 * k}, 55%, ${38 + 22 * k}%)`;
    segs.push({ y: p.y, svg: `<line x1="${a.x}" y1="${a.z}" x2="${p.x}" y2="${p.z}" stroke="${col}" stroke-width="${f[i]!.hw * 2 * Math.hypot(f[i]!.r.x, f[i]!.r.z)}" stroke-linecap="round" stroke-opacity="0.9"/>` });
  }
  segs.sort((x, y) => x.y - y.y);
  const marks: string[] = [];
  for (const tr of t.triggers) {
    const col = tr.kind === 'finish' ? '#ff3030' : tr.kind === 'car' ? GATE_COL[tr.car!]! : '#2060ff';
    marks.push(`<circle cx="${tr.position.x}" cy="${tr.position.z}" r="7" fill="${col}" stroke="#000" stroke-width="1.5"/>`);
    if (tr.kind === 'car') marks.push(`<text x="${tr.position.x + 9}" y="${tr.position.z + 5}" font-size="16" font-weight="700" fill="#000">${tr.car}</text>`);
  }
  marks.push(`<circle cx="${t.start.position.x}" cy="${t.start.position.z}" r="9" fill="#20d060" stroke="#000" stroke-width="2"/>`);
  for (const [x, , z] of b.overlaps) marks.push(`<circle cx="${x}" cy="${z}" r="14" fill="none" stroke="#ff0000" stroke-width="4"/>`);
  const label = `${d.id} ${d.name} · ${d.car} · ${d.theme} · ${Math.round(b.length)} m · y ${minY.toFixed(0)}..${maxY.toFixed(0)}${b.overlaps.length ? ` · ${b.overlaps.length} OVERLAPS` : ''}`;
  return `<div class="m"><div class="l">${label}</div><svg viewBox="${minX - pad} ${minZ - pad} ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <rect x="${minX - pad}" y="${minZ - pad}" width="${w}" height="${h}" fill="#26331f"/>${segs.map((s) => s.svg).join('')}${marks.join('')}</svg></div>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
for (let k = 0; k < defs.length; k += 6) {
  const html = `<html><body style="margin:0;background:#111;font:14px sans-serif;color:#eee"><style>.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px}.m{background:#1b1b1b}.l{padding:4px 6px}svg{width:100%;height:560px;display:block}</style><div class="g">${defs.slice(k, k + 6).map((d) => svgFor(d.id)).join('')}</div></body></html>`;
  await page.setContent(html);
  const file = `${prefix}_${Math.floor(k / 6)}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file, defs.slice(k, k + 6).map((d) => d.id).join(' '));
}
await browser.close();
