import { Records } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { medalBadge } from '../medals';
import { MEDAL_META } from '../medals';
import { AppApi } from './AppApi';
import { header, levelMedal } from './common';
import { Screen } from './ScreenManager';
import { MEDAL_POINTS } from '../../data/campaign';

/** Local leaderboard: your personal best on every level you have finished, with medals and replays. */
export class LeaderboardScreen implements Screen {
  readonly el = h('div', { class: 'screen leaderboard' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const rows = this.app
      .levels()
      .map((lv) => ({ lv, pb: Records.get(lv.id) }))
      .filter((r) => r.pb);
    const c = this.app.campaign();
    const total = rows.reduce((a, r) => a + r.pb!.best, 0);
    const table = h('table', { class: 'lb' });
    table.append(h('thead', {}, h('tr', {}, ...['#', 'Level', 'Car', 'Best', 'Medal', 'To next', 'Date', ''].map((t) => h('th', {}, t)))));
    const tb = h('tbody');
    const order = new Map(c.levels.map((l, i) => [l.entry.levelId, i]));
    rows.sort((a, b) => (order.get(a.lv.id) ?? 999) - (order.get(b.lv.id) ?? 999));
    rows.forEach((r, i) => {
      const medal = levelMedal(r.lv);
      const mt = r.lv.medalTimes;
      const next = medal === 'none' ? mt.bronze : medal === 'bronze' ? mt.silver : medal === 'silver' ? mt.gold : medal === 'gold' ? mt.author : 0;
      const gap = next > 0 ? `−${((r.pb!.best - next) / 1000).toFixed(3)}` : '—';
      const watch = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.watchReplay(r.lv.id, 'pb') }, '▶ Replay');
      const author = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.watchReplay(r.lv.id, 'author') }, '◆ Author');
      const play = h('button', { class: 'btn sm', type: 'button', onclick: () => this.app.playLevel(r.lv.id) }, 'Race');
      tb.append(h('tr', {},
        h('td', {}, String(i + 1)),
        h('td', { class: 'ln' }, r.lv.name),
        h('td', {}, this.app.car(r.lv.car).label),
        h('td', { class: 'tm' }, formatTime(r.pb!.best)),
        h('td', { html: `${medalBadge(medal)} <span class="mn">${MEDAL_META[medal].label}</span>` }),
        h('td', { class: 'gap' }, gap),
        h('td', { class: 'dt' }, new Date(r.pb!.at).toLocaleDateString()),
        h('td', { class: 'acts' }, watch, author, play),
      ));
      void this.app.hasGhost(r.lv.id, 'pb').then((ok) => { watch.disabled = !ok; });
      void this.app.hasGhost(r.lv.id, 'author').then((ok) => { author.disabled = !ok; });
    });
    table.append(tb);

    const counts = { author: 0, gold: 0, silver: 0, bronze: 0 } as Record<string, number>;
    for (const r of rows) {
      const m = levelMedal(r.lv);
      if (m !== 'none') counts[m]!++;
    }
    const stats = h('div', { class: 'lb-stats' },
      h('div', {}, h('b', {}, String(rows.length)), ' levels finished'),
      h('div', {}, h('b', {}, `${c.totalPoints}`), ` medal points (${MEDAL_POINTS.author} per Author)`),
      h('div', {}, h('b', {}, rows.length ? formatTime(total) : '—'), ' total of best times'),
      h('div', { class: 'lb-medals', html: (['author', 'gold', 'silver', 'bronze'] as const).map((m) => `<span>${medalBadge(m)} ${counts[m]}</span>`).join('') }),
    );
    this.el.replaceChildren(
      header('Leaderboard', () => this.app.screens.back()),
      h('div', { class: 'ls-body' }, stats, rows.length ? h('div', { class: 'lb-scroll' }, table) : h('div', { class: 'empty-note' }, 'No finished runs yet. Finish a level to set your first personal best.')),
    );
  }
}
