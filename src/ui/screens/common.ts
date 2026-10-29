import { Records } from '../../core/Records';
import { TrackJson } from '../../tracks/TrackSchema';
import { formatTime } from '../Hud';

export const pbText = (id: string): string => {
  const r = Records.get(id);
  return r ? formatTime(r.best) : '—';
};

/** True when the personal best on a level is at or under its target time. */
export const targetBeaten = (l: TrackJson): boolean => {
  const r = Records.get(l.id);
  return !!r && !!l.target && r.best <= l.target;
};

/** Header row with a back button and a title. */
export function header(title: string, onBack: () => void, right?: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'scr-head';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn back';
  b.textContent = '← Back';
  b.onclick = onBack;
  const t = document.createElement('h2');
  t.textContent = title;
  el.append(b, t);
  if (right) el.append(right);
  return el;
}
