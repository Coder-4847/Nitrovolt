import { h, btn } from '../dom';
import { AppApi } from './AppApi';
import { Screen } from './ScreenManager';
import { SettingsScreen } from './SettingsScreen';

export class EditorMenuScreen implements Screen {
  readonly el = h('div', { class: 'screen pause' });
  readonly overlay = true;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const box = h('div', { class: 'pause-box' },
      h('h2', {}, 'Editor'),
      h('div', { class: 'note' }, 'Your track saves automatically.'),
      btn('Resume editing', () => this.app.resume(), 'primary big'),
      btn('Test drive', () => this.app.editorAction('test'), 'big'),
      btn('Validate with the bot', () => this.app.editorAction('validate'), 'big'),
      btn('Share link', () => this.app.editorAction('share'), 'big'),
      btn('Export .json', () => this.app.editorAction('export'), 'big'),
      btn('Settings', () => this.app.screens.push(new SettingsScreen(this.app)), 'big'),
      btn('Exit to My tracks', () => this.app.editorAction('exit'), 'big'),
    );
    this.el.replaceChildren(box);
    (box.querySelector('.primary') as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    this.app.resume();
    return true;
  }
}
