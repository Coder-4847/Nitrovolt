import { h, btn } from '../dom';
import { AppApi } from './AppApi';
import { Screen } from './ScreenManager';
import { SettingsScreen, toggleFullscreen } from './SettingsScreen';

export class PauseScreen implements Screen {
  readonly el = h('div', { class: 'screen pause' });
  readonly overlay = true;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const id = this.app.currentLevelId();
    const lv = id ? this.app.level(id) : undefined;
    const menu = h('div', { class: 'pause-box' },
        h('h2', {}, 'Paused'),
        lv ? h('div', { class: 'note' }, `${lv.name} · ${this.app.car(lv.car).label}`) : null,
        btn('Resume', () => this.app.resume(), 'primary big'),
        btn('Restart', () => this.app.restartRace(), 'big'),
        btn('Settings', () => this.app.screens.push(new SettingsScreen(this.app)), 'big'),
        document.body.classList.contains('touch') ? btn(document.fullscreenElement ? 'Leave fullscreen' : 'Fullscreen', () => toggleFullscreen(), 'big') : null,
        btn('Level select', () => this.app.openLevelSelect(), 'big'),
        btn('Main menu', () => this.app.toMainMenu(), 'big'),
    );
    this.el.replaceChildren(menu);
    (menu.querySelector('.primary') as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    this.app.resume();
    return true;
  }
}
