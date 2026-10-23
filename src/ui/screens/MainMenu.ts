import { h, btn } from '../dom';
import { AppApi } from './AppApi';
import { Screen } from './ScreenManager';
import { SettingsScreen } from './SettingsScreen';
import { LevelSelectScreen } from './LevelSelectScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { HelpScreen } from './HelpScreen';
import { AboutScreen } from './AboutScreen';
import { LandingScreen } from './LandingScreen';
import { medalBadge } from '../medals';
import { MEDAL_POINTS } from '../../data/campaign';

export class MainMenu implements Screen {
  readonly el = h('div', { class: 'screen main-menu' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const c = this.app.campaign();
    const contId = this.app.continueLevel();
    const cont = this.app.level(contId);
    const counts = { author: 0, gold: 0, silver: 0, bronze: 0 } as Record<string, number>;
    for (const l of c.levels) if (l.medal !== 'none') counts[l.medal]!++;
    const item = (label: string, sub: string, onClick: () => void, cls = ''): HTMLButtonElement => {
      const b = h('button', { class: `mm-item ${cls}`.trim(), type: 'button', onclick: onClick }, h('b', {}, label), h('small', {}, sub));
      return b;
    };
    const menu = h('div', { class: 'mm-buttons' },
      item('Play', cont ? `Continue · ${cont.name}` : 'Start the campaign', () => this.app.playLevel(contId), 'primary'),
      item('Campaign', '100 tracks · 4 seasons', () => this.app.screens.push(new LevelSelectScreen(this.app, 'campaign'))),
      item('Free play', 'Any unlocked track, any car', () => this.app.screens.push(new LevelSelectScreen(this.app, 'free'))),
      item('Records', 'Times, medals, ghosts', () => this.app.screens.push(new LeaderboardScreen(this.app))),
      item('Settings', 'Controls, graphics, sound, garage', () => this.app.screens.push(new SettingsScreen(this.app))),
      h('div', { class: 'mm-small' },
        btn('Home', () => this.app.screens.push(new LandingScreen(this.app))),
        btn('How to play', () => this.app.screens.push(new HelpScreen(this.app))),
        btn('About', () => this.app.screens.push(new AboutScreen(this.app))),
      ),
    );
    const medals = h('div', { class: 'mm-medals', html: (['author', 'gold', 'silver', 'bronze'] as const).map((m) => `<span>${medalBadge(m)} ${counts[m]}</span>`).join('') });
    const pct = c.maxPoints ? Math.round((c.totalPoints / c.maxPoints) * 100) : 0;
    const thumb = h('img', { class: 'mm-thumb', alt: '' });
    if (cont) this.app.thumbnail(contId, (url) => { if (url) thumb.src = url; }, () => this.el.isConnected);
    const card = h('div', { class: 'mm-card' },
      h('div', { class: 'mm-card-h' }, 'Up next'),
      thumb,
      h('div', { class: 'mm-card-name' }, cont?.name ?? 'Sprint 01'),
      h('div', { class: 'mm-progress' }, h('i', { style: `width:${pct}%` })),
      h('div', { class: 'mm-points' }, `${c.totalPoints} / ${c.maxPoints || MEDAL_POINTS.author} medal points`),
      medals,
    );
    this.el.replaceChildren(
      h('div', { class: 'mm-left' },
        h('div', { class: 'mm-title' }, h('div', { class: 'logo', html: '<i class="bolt"></i>NITRO<span>VOLT</span>' }), h('div', { class: 'tag' }, 'Time attack · instant restarts · ghosts')),
        menu,
      ),
      card,
    );
    (menu.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return true; // nothing below the main menu
  }
}
