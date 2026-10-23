import { medalFor } from '../../core/Medals';
import { Records } from '../../core/Records';
import { TrackJson } from '../../tracks/TrackSchema';
import { Medal } from '../../core/Medals';
import { formatTime } from '../Hud';
import { medalBadge } from '../medals';

export const levelMedal = (l: TrackJson): Medal => {
  const r = Records.get(l.id);
  return r ? medalFor(r.best, l.medalTimes) : 'none';
};

export const pbText = (id: string): string => {
  const r = Records.get(id);
  return r ? formatTime(r.best) : '—';
};

export { medalBadge };

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
