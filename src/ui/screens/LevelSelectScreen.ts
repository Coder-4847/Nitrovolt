import { CAMPAIGN, CampaignLevel, WORLDS, lengthClass } from '../../data/campaign';
import { Records } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { AppApi } from './AppApi';
import { header } from './common';
import { Screen } from './ScreenManager';

/** Cars a level is driven with (its start car, then every gate in order). */
export function levelCars(app: AppApi, id: string): string[] {
  const lv = app.level(id);
  if (!lv) return [];
  const out = [lv.car];
  for (const b of lv.blocks) if (b.type.startsWith('gate')) out.push(b.type.slice(4).toLowerCase());
  return out.filter((c, i) => i === 0 || c !== out[i - 1]);
}

/** The campaign: five worlds of five tracks, one row each. Every track is open from the start. */
export class LevelSelectScreen implements Screen {
  readonly el = h('div', { class: 'screen level-select' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const body = h('div', { class: 'ls-body' });
    const timed = CAMPAIGN.filter((l) => Records.get(l.levelId)).length;
    this.el.replaceChildren(header('Campaign', () => this.app.screens.back(), h('div', { class: 'ls-pts' }, `${timed} / ${CAMPAIGN.length} tracks timed`)), body);
    for (const w of WORLDS) {
      const levels = CAMPAIGN.filter((l) => l.world === w.id);
      const done = levels.filter((l) => Records.get(l.levelId)).length;
      const row = h('div', { class: 'tier-row', style: `--tier:${w.color}` },
        h('div', { class: 'tier-tag' }, h('b', {}, w.name), h('small', {}, `${done}/${levels.length} timed`)),
      );
      const tiles = h('div', { class: 'tier-tiles' });
      for (const l of levels) tiles.append(this.tile(l));
      row.append(tiles);
      body.append(row);
    }
    // focus the first track without a time (or the first one)
    const tiles = [...this.el.querySelectorAll<HTMLElement>('.tile')];
    const first = tiles.find((t) => t.dataset.timed === '0') ?? tiles[0];
    first?.setAttribute('data-autofocus', '');
    first?.focus();
  }

  private tile(l: CampaignLevel): HTMLElement {
    const lv = this.app.level(l.levelId)!;
    const img = h('img', { class: 'thumb', alt: '', draggable: false });
    this.app.thumbnail(lv.id, (url) => { if (url) img.src = url; }, () => img.isConnected);
    const pb = Records.get(lv.id);
    const target = lv.target ?? 0;
    const cars = levelCars(this.app, lv.id);
    const beaten = !!pb && target > 0 && pb.best <= target;
    return h('button', {
      class: 'tile',
      type: 'button',
      'data-timed': pb ? '1' : '0',
      title: `${lv.name}: ${l.blurb}`,
      onclick: () => this.app.playLevel(lv.id),
    },
      h('div', { class: 'tile-img' }, img, h('span', { class: 'tile-num' }, String(l.number).padStart(2, '0')), h('span', { class: `tile-len ${lengthClass(target).toLowerCase()}` }, lengthClass(target))),
      h('div', { class: 'tile-name' }, lv.name),
      h('div', { class: 'tile-cars' }, cars.map((c) => this.app.car(c).label).join(' › ')),
      h('div', { class: 'tile-times' },
        h('span', { class: `pbt${pb ? (beaten ? ' beaten' : '') : ' none'}` }, h('small', {}, 'PB'), pb ? formatTime(pb.best) : '—'),
        h('span', { class: 'tgt' }, h('small', {}, 'Target'), target > 0 ? formatTime(target) : '—'),
      ),
    );
  }

  onBack(): boolean {
    return false;
  }
}
