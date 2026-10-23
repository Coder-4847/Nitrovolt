import { LevelState, TIERS, TIER_UNLOCK } from '../../data/campaign';
import { Records } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { medalBadge } from '../medals';
import { AppApi } from './AppApi';
import { header, pbText } from './common';
import { Screen } from './ScreenManager';

type Kind = 'campaign' | 'training';

/** Cars a level is driven with (its start car, then every gate in order). */
export function levelCars(app: AppApi, id: string): string[] {
  const lv = app.level(id);
  if (!lv) return [];
  const out = [lv.car];
  for (const b of lv.blocks) if (b.type.startsWith('gate')) out.push(b.type.slice(4).toLowerCase());
  return out.filter((c, i) => i === 0 || c !== out[i - 1]);
}

/** The campaign (five tiers of five tracks, a row each) or the list of training tracks. */
export class LevelSelectScreen implements Screen {
  readonly el = h('div', { class: 'screen level-select' });

  constructor(
    private readonly app: AppApi,
    private readonly kind: Kind,
  ) {}

  onShow(): void {
    const c = this.app.campaign();
    const body = h('div', { class: 'ls-body' });
    const title = this.kind === 'campaign' ? 'Campaign' : 'Training';
    this.el.replaceChildren(header(title, () => this.app.screens.back(), h('div', { class: 'ls-pts' }, this.kind === 'campaign' ? `${c.totalPoints} / ${c.maxPoints} medal points` : `${c.training.length} tracks`)), body);
    if (this.kind === 'campaign') {
      for (const t of c.tiers) {
        const row = h('div', { class: `tier-row${t.unlocked ? '' : ' locked'}`, style: `--tier:${t.def.color}` },
          h('div', { class: 'tier-tag' }, h('b', {}, t.def.name), h('small', {}, t.unlocked ? `${t.done}/${t.count} done` : `Finish ${TIER_UNLOCK} ${TIERS[t.def.id - 1]?.name ?? ''}`)),
        );
        const tiles = h('div', { class: 'tier-tiles' });
        for (const l of c.levels.filter((x) => x.entry.tier === t.def.id)) tiles.append(this.tile(l));
        row.append(tiles);
        body.append(row);
      }
    } else {
      const grid = h('div', { class: 'tier-tiles training' });
      for (const l of c.training) grid.append(this.tile(l));
      body.append(grid);
    }
    // focus the first track still without a medal (or the first one)
    const tiles = [...this.el.querySelectorAll<HTMLElement>('.tile:not(.locked)')];
    const first = tiles.find((t) => t.dataset.medal === 'none') ?? tiles[0];
    first?.setAttribute('data-autofocus', '');
    first?.focus();
  }

  private tile(l: LevelState): HTMLElement {
    const lv = this.app.level(l.entry.levelId)!;
    const img = h('img', { class: 'thumb', alt: '', draggable: false });
    this.app.thumbnail(lv.id, (url) => { if (url) img.src = url; }, () => img.isConnected);
    const lock = l.unlocked ? null : l.lockReason ?? 'Locked';
    const mt = lv.medalTimes;
    const pb = Records.get(lv.id);
    const cars = levelCars(this.app, lv.id);
    const num = String(l.entry.number).padStart(2, '0');
    return h('button', {
      class: `tile${lock ? ' locked' : ''}`,
      type: 'button',
      'data-medal': l.medal,
      title: lock ?? `${lv.name}: ${l.entry.blurb}\nAuthor ${formatTime(mt.author)} · Gold ${formatTime(mt.gold)} · Silver ${formatTime(mt.silver)} · Bronze ${formatTime(mt.bronze)}`,
      onclick: () => (lock ? this.app.toast(lock) : this.app.playLevel(lv.id)),
    },
      h('div', { class: 'tile-img' }, img, h('span', { class: 'tile-num' }, num), h('span', { class: 'tile-medal', html: l.medal === 'none' ? '' : medalBadge(l.medal, 'lg') })),
      h('div', { class: 'tile-name' }, lv.name),
      h('div', { class: 'tile-meta' }, h('span', { class: 'tile-cars' }, cars.map((c) => this.app.car(c).label).join(' › ')), h('span', { class: 'pb' }, pb ? pbText(lv.id) : '')),
      lock ? h('div', { class: 'lock' }, h('span', {}, '🔒'), h('small', {}, lock)) : null,
    );
  }

  onBack(): boolean {
    return false;
  }
}
