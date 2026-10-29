import { CAMPAIGN } from '../../data/campaign';
import { Records, formatDelta } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { AppApi } from './AppApi';
import { header } from './common';
import { levelCars } from './LevelSelectScreen';
import { Screen } from './ScreenManager';

/** Local records: your best time on every track you have finished, against its target, with replays. */
export class LeaderboardScreen implements Screen {
  readonly el = h('div', { class: 'screen leaderboard' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const rows = CAMPAIGN.map((l) => ({ l, lv: this.app.level(l.levelId)!, pb: Records.get(l.levelId) })).filter((r) => r.pb && r.lv);
    const total = rows.reduce((a, r) => a + r.pb!.best, 0);
    const beaten = rows.filter((r) => (r.lv.target ?? 0) > 0 && r.pb!.best <= r.lv.target!).length;
    const table = h('table', { class: 'lb' });
    table.append(h('thead', {}, h('tr', {}, ...['#', 'Track', 'Cars', 'Best', 'Target', 'vs target', 'Date', ''].map((t) => h('th', {}, t)))));
    const tb = h('tbody');
    for (const r of rows) {
      const target = r.lv.target ?? 0;
      const diff = target > 0 ? r.pb!.best - target : null;
      const watch = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.watchReplay(r.lv.id, 'pb') }, '▶ My run');
      const author = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.watchReplay(r.lv.id, 'author') }, '◆ Target');
      const play = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.playLevel(r.lv.id) }, 'Race');
      tb.append(h('tr', {},
        h('td', {}, String(r.l.number)),
        h('td', { class: 'ln' }, r.lv.name),
        h('td', {}, levelCars(this.app, r.lv.id).map((x) => this.app.car(x).label).join(' › ')),
        h('td', { class: 'tm' }, formatTime(r.pb!.best)),
        h('td', { class: 'tm' }, target > 0 ? formatTime(target) : '—'),
        h('td', { class: `gap ${diff === null ? '' : diff <= 0 ? 'good' : 'bad'}` }, diff === null ? '—' : formatDelta(diff)),
        h('td', { class: 'dt' }, new Date(r.pb!.at).toLocaleDateString()),
        h('td', { class: 'acts' }, watch, author, play),
      ));
      void this.app.hasGhost(r.lv.id, 'pb').then((ok) => { watch.disabled = !ok; });
      void this.app.hasGhost(r.lv.id, 'author').then((ok) => { author.disabled = !ok; });
    }
    table.append(tb);

    const stats = h('div', { class: 'lb-stats' },
      h('div', {}, h('b', {}, `${rows.length} / ${CAMPAIGN.length}`), ' tracks timed'),
      h('div', {}, h('b', {}, String(beaten)), ' targets beaten'),
      h('div', {}, h('b', {}, rows.length ? formatTime(total) : '—'), ' total of best times'),
    );
    this.el.replaceChildren(
      header('Records', () => this.app.screens.back()),
      h('div', { class: 'ls-body' }, stats, rows.length ? h('div', { class: 'lb-scroll' }, table) : h('div', { class: 'empty-note' }, 'No times yet. Finish a track to set your first personal best.')),
    );
  }
}
