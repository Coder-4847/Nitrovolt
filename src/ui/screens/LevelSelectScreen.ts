import { SEASONS, SEASON_COUNT, LevelState, LEVELS_PER_SEASON } from '../../data/campaign';
import { Medal } from '../../core/Medals';
import { Records } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { medalBadge } from '../medals';
import { AppApi } from './AppApi';
import { header, levelMedal, pbText } from './common';
import { Screen } from './ScreenManager';
import { TrackJson } from '../../tracks/TrackSchema';

type Kind = 'campaign' | 'free';

/** Campaign map (4 seasons x 25) or the free-play list of every level. */
export class LevelSelectScreen implements Screen {
  readonly el = h('div', { class: 'screen level-select' });
  private season = 0;

  constructor(
    private readonly app: AppApi,
    private readonly kind: Kind,
  ) {}

  onShow(): void {
    const c = this.app.campaign();
    // open on the season of the level the player would continue
    if (this.kind === 'campaign') {
      const cont = c.levels.find((l) => l.entry.levelId === this.app.continueLevel());
      if (cont && this.el.childElementCount === 0) this.season = cont.entry.season;
    }
    this.build();
  }

  private build(): void {
    const c = this.app.campaign();
    const body = h('div', { class: 'ls-body' });
    const title = this.kind === 'campaign' ? 'Campaign' : 'Free Play';
    this.el.replaceChildren(header(title, () => this.app.screens.back(), h('div', { class: 'ls-pts' }, `${c.totalPoints} pts`)), body);

    if (this.kind === 'campaign') {
      const tabs = h('div', { class: 'tabs' });
      for (let s = 0; s < SEASON_COUNT; s++) {
        const st = c.seasons[s]!;
        const b = h('button', { class: `tab${s === this.season ? ' on' : ''}${st.unlocked ? '' : ' locked'}`, type: 'button', onclick: () => { this.season = s; this.build(); this.focusTab(); } },
          `${SEASONS[s]!.name}`, h('small', {}, st.unlocked ? `${st.points}/${st.maxPoints || '—'} pts` : '🔒'));
        tabs.append(b);
      }
      body.append(tabs);
      const st = c.seasons[this.season]!;
      const info = h('div', { class: 'season-info' }, h('span', {}, SEASONS[this.season]!.blurb));
      if (!st.unlocked) info.append(h('b', { class: 'bad' }, `Locked: ${st.have} / ${st.required} medal points from earlier seasons`));
      body.append(info);
      const grid = h('div', { class: 'cards' });
      const mine = c.levels.filter((l) => l.entry.season === this.season);
      for (const l of mine) grid.append(this.card(l));
      body.append(grid);
      if (mine.length !== LEVELS_PER_SEASON) body.append(h('div', { class: 'note' }, 'Season incomplete'));
    } else {
      const grid = h('div', { class: 'cards free' });
      for (const lv of this.app.levels()) {
        const s: LevelState | undefined = c.levels.find((x) => x.entry.levelId === lv.id);
        grid.append(this.cardFor(lv, s?.entry.number ?? null, levelMedal(lv), null));
      }
      body.append(grid);
    }
    const first = this.el.querySelector<HTMLElement>('.card:not(.locked)') ?? this.el.querySelector<HTMLElement>('.card');
    first?.setAttribute('data-autofocus', '');
    first?.focus();
  }

  private focusTab(): void {
    this.el.querySelector<HTMLElement>('.tab.on')?.focus();
  }

  private card(l: LevelState): HTMLElement {
    const id = l.entry.levelId;
    const num = l.entry.number;
    if (!id) {
      return h('div', { class: 'card empty', 'aria-disabled': true }, h('div', { class: 'num' }, String(num)), h('div', { class: 'name' }, 'Coming soon'));
    }
    return this.cardFor(this.app.level(id)!, num, l.medal, l.unlocked ? null : (l.lockReason ?? 'Locked'));
  }

  private cardFor(lv: TrackJson, num: number | null, medal: Medal, lock: string | null): HTMLElement {
    const img = h('img', { class: 'thumb', alt: '', draggable: false });
    this.app.thumbnail(lv.id, (url) => { if (url) img.src = url; });
    const car = this.app.car(lv.car);
    const pb = Records.get(lv.id);
    const mt = lv.medalTimes;
    const card = h('button', {
      class: `card${lock ? ' locked' : ''}`,
      type: 'button',
      title: lock ?? `Author ${formatTime(mt.author)} · Gold ${formatTime(mt.gold)} · Silver ${formatTime(mt.silver)} · Bronze ${formatTime(mt.bronze)}`,
      onclick: () => (lock ? this.app.toast(lock) : this.app.playLevel(lv.id)),
    },
      h('div', { class: 'thumb-wrap' }, img, num !== null ? h('span', { class: 'num' }, String(num)) : null, h('span', { class: 'medal-slot', html: medal === 'none' ? '' : medalBadge(medal, 'lg') })),
      h('div', { class: 'name' }, lv.name),
      h('div', { class: 'meta' }, h('span', {}, car.label), h('span', { class: 'pb' }, pb ? pbText(lv.id) : '—')),
      lock ? h('div', { class: 'lock' }, h('span', {}, '🔒'), h('small', {}, lock)) : null,
    );
    return card;
  }

  onBack(): boolean {
    return false;
  }
}
