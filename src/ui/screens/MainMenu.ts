import { CAR_IDS } from '../../data/cars';
import { h } from '../dom';
import { medalBadge } from '../medals';
import { AboutScreen } from './AboutScreen';
import { AppApi } from './AppApi';
import { HelpScreen } from './HelpScreen';
import { LandingScreen } from './LandingScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { PlayScreen } from './PlayScreen';
import { Screen } from './ScreenManager';
import { SettingsScreen, setSettingsTab } from './SettingsScreen';

/** Display ratings for the car on the podium (0..5). */
export const CAR_STATS: Record<string, { speed: number; grip: number; air: number; home: string }> = {
  volt: { speed: 5, grip: 5, air: 2, home: 'Tarmac, walls, loops' },
  gravel: { speed: 3, grip: 3, air: 3, home: 'Dirt and grass' },
  frost: { speed: 3, grip: 3, air: 2, home: 'Snow and ice' },
  dune: { speed: 4, grip: 2, air: 5, home: 'Sand and big air' },
};

/**
 * Main menu: the big slanted list on the left over the showroom (the car on its podium on the right), with
 * the podium car's card under it (switch with the arrows) and the medal tally.
 */
export class MainMenu implements Screen {
  readonly el = h('div', { class: 'screen main-menu' });
  readonly backdropShift = 0.2;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const c = this.app.campaign();
    const contId = this.app.continueLevel();
    const cont = this.app.level(contId);
    const counts: Record<string, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    for (const l of c.levels) if (l.medal !== 'none') counts[l.medal]!++;
    const item = (label: string, sub: string, onClick: () => void, cls = ''): HTMLButtonElement =>
      h('button', { class: `mm-item ${cls}`.trim(), type: 'button', onclick: onClick }, h('span', { class: 'mm-label' }, label), h('small', {}, sub));
    const menu = h('nav', { class: 'mm-list' },
      item('Play', 'Campaign · training · track of the day', () => this.app.screens.push(new PlayScreen(this.app)), 'primary'),
      item('Continue', cont ? cont.name : 'Start the campaign', () => this.app.playLevel(contId)),
      item('Records', 'Times, medals, replays', () => this.app.screens.push(new LeaderboardScreen(this.app))),
      item('Garage', 'Paint your cars', () => { setSettingsTab('garage'); this.app.screens.push(new SettingsScreen(this.app)); }),
      item('Settings', 'Controls, graphics, sound', () => this.app.screens.push(new SettingsScreen(this.app))),
    );
    const foot = h('div', { class: 'mm-foot' },
      h('button', { class: 'mm-link', type: 'button', onclick: () => this.app.screens.push(new LandingScreen(this.app)) }, 'Home'),
      h('button', { class: 'mm-link', type: 'button', onclick: () => this.app.screens.push(new HelpScreen(this.app)) }, 'How to play'),
      h('button', { class: 'mm-link', type: 'button', onclick: () => this.app.screens.push(new AboutScreen(this.app)) }, 'About'),
    );
    const medals = h('div', { class: 'mm-medals', html: (['author', 'gold', 'silver', 'bronze'] as const).map((m) => `<span>${medalBadge(m)} ${counts[m]}</span>`).join('') });
    this.el.replaceChildren(
      h('div', { class: 'mm-left' },
        h('div', { class: 'mm-logo', html: '<span class="lg-n">NITRO</span><span class="lg-v">VOLT</span>' }),
        menu,
        foot,
      ),
      this.carCard(),
      h('div', { class: 'mm-progress-card' }, h('b', {}, `${c.totalPoints} / ${c.maxPoints}`), h('small', {}, 'medal points'), medals),
    );
    (menu.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
  }

  /** Name, character and ratings of the car on the podium, with arrows to show another. */
  private carCard(): HTMLElement {
    const def = this.app.menuCar();
    const st = CAR_STATS[def.id]!;
    const bar = (label: string, v: number): HTMLElement => h('div', { class: 'cc-stat' }, h('span', {}, label), h('i', { style: `--v:${v / 5}` }));
    const arrow = (d: 1 | -1, txt: string): HTMLElement => h('button', { class: 'cc-arrow', type: 'button', 'aria-label': d > 0 ? 'Next car' : 'Previous car', onclick: () => { this.app.cycleMenuCar(d); this.onShow(); } }, txt);
    return h('div', { class: 'mm-car' },
      arrow(-1, '‹'),
      h('div', { class: 'cc-body' },
        h('div', { class: 'cc-kicker' }, `${CAR_IDS.indexOf(def.id) + 1} / ${CAR_IDS.length}`),
        h('div', { class: 'cc-name' }, `${def.label} car`),
        h('div', { class: 'cc-home' }, st.home),
        bar('Speed', st.speed), bar('Grip', st.grip), bar('Air', st.air),
      ),
      arrow(1, '›'),
    );
  }

  onBack(): boolean {
    return true; // nothing below the main menu
  }
}
