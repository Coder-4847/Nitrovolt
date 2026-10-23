import { h, btn } from '../dom';
import { AppApi } from './AppApi';
import { Screen } from './ScreenManager';
import { SettingsScreen } from './SettingsScreen';
import { LevelSelectScreen } from './LevelSelectScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { MyLevelsScreen } from './MyLevelsScreen';
import { HelpScreen } from './HelpScreen';
import { AboutScreen } from './AboutScreen';
import { medalBadge } from '../medals';
import { MEDAL_POINTS } from '../../data/campaign';

export class MainMenu implements Screen {
  readonly el = h('div', { class: 'screen main-menu' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const c = this.app.campaign();
    const cont = this.app.level(this.app.continueLevel());
    const counts = { author: 0, gold: 0, silver: 0, bronze: 0 } as Record<string, number>;
    for (const l of c.levels) if (l.medal !== 'none') counts[l.medal]!++;
    const menu = h('div', { class: 'mm-buttons' },
      btn(cont ? `Continue · ${cont.name}` : 'Play', () => this.app.playLevel(this.app.continueLevel()), 'primary big'),
      btn('Campaign', () => this.app.screens.push(new LevelSelectScreen(this.app, 'campaign')), 'big'),
      btn('Free Play', () => this.app.screens.push(new LevelSelectScreen(this.app, 'free')), 'big'),
      btn('Track editor', () => this.app.screens.push(new MyLevelsScreen(this.app)), 'big'),
      btn('Leaderboard', () => this.app.screens.push(new LeaderboardScreen(this.app)), 'big'),
      btn('Settings', () => this.app.screens.push(new SettingsScreen(this.app)), 'big'),
      h('div', { class: 'mm-small' },
        btn('How to play', () => this.app.screens.push(new HelpScreen(this.app))),
        btn('About', () => this.app.screens.push(new AboutScreen(this.app))),
      ),
    );
    const medals = h('div', { class: 'mm-medals', html: (['author', 'gold', 'silver', 'bronze'] as const).map((m) => `<span>${medalBadge(m)} ${counts[m]}</span>`).join('') });
    const pts = h('div', { class: 'mm-points' }, `${c.totalPoints} / ${c.maxPoints || MEDAL_POINTS.author} medal points`);
    this.el.replaceChildren(
      h('div', { class: 'mm-title' }, h('div', { class: 'logo', html: 'NITRO<span>VOLT</span>' }), h('div', { class: 'tag' }, 'Time attack · instant restarts · ghosts')),
      menu,
      h('div', { class: 'mm-foot' }, medals, pts),
    );
    (menu.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return true; // nothing below the main menu
  }
}
