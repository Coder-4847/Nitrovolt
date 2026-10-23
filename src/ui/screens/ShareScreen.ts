import { h, btn } from '../dom';
import { AppApi } from './AppApi';
import { Screen } from './ScreenManager';

/** Shows a share link with a copy button (clipboard access is not always allowed). */
export class ShareScreen implements Screen {
  readonly el = h('div', { class: 'screen pause' });
  readonly overlay = true;

  constructor(private readonly app: AppApi, private readonly name: string, private readonly url: string) {}

  onShow(): void {
    const input = h('input', { type: 'text', value: this.url, readonly: true, class: 'code-input wide' });
    input.onfocus = () => input.select();
    const copy = btn('Copy link', async () => {
      try {
        await navigator.clipboard.writeText(this.url);
        this.app.toast('Link copied');
      } catch {
        input.select();
        this.app.toast('Press Ctrl+C to copy');
      }
    }, 'primary big');
    this.el.replaceChildren(h('div', { class: 'pause-box share-box' },
      h('h2', {}, 'Share'),
      h('div', { class: 'note' }, `Anyone who opens this link gets "${this.name}" in their own My tracks. ${this.url.length} characters.`),
      input, copy, btn('Close', () => this.app.screens.back(), 'big'),
    ));
    copy.setAttribute('data-autofocus', '');
  }
}
