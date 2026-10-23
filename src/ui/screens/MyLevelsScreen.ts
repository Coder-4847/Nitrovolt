import { levelFingerprint } from '../../core/Ghost';
import { Records } from '../../core/Records';
import { UserLevel } from '../../editor/UserLevels';
import { h, btn } from '../dom';
import { formatTime } from '../Hud';
import { AppApi } from './AppApi';
import { header } from './common';
import { Screen } from './ScreenManager';
import { ShareScreen } from './ShareScreen';

/** "My tracks": every level made in the editor, plus new / import / copy-a-campaign-level. */
export class MyLevelsScreen implements Screen {
  readonly el = h('div', { class: 'screen my-levels' });
  private armed = '';

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    void this.build();
  }

  private async build(): Promise<void> {
    const list = await this.app.userLevels();
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-file' });
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        await this.app.importTrack(await f.text());
        this.app.toast('Track imported');
        void this.build();
      } catch (e) {
        this.app.toast(`Import failed: ${(e as Error).message}`);
      }
    };
    const code = h('input', { type: 'text', placeholder: 'Paste a track link or code', class: 'code-input' });
    const paste = btn('Import code', async () => {
      try {
        await this.app.importTrack(code.value);
        this.app.toast('Track imported');
        void this.build();
      } catch (e) {
        this.app.toast(`Import failed: ${(e as Error).message}`);
      }
    });
    const copySel = h('select', { class: 'copy-sel' }, h('option', { value: '' }, 'Copy a campaign track…'));
    for (const l of this.app.levels()) copySel.append(h('option', { value: l.id }, l.name));
    copySel.onchange = () => {
      const lv = this.app.level(copySel.value);
      if (lv) void this.app.newUserLevel(lv);
    };
    const bar = h('div', { class: 'ml-bar' },
      btn('New track', () => void this.app.newUserLevel(), 'primary'),
      btn('Import file…', () => file.click()),
      code, paste, copySel, file,
    );
    const grid = h('div', { class: 'cards ml-cards' });
    for (const l of list) grid.append(this.card(l));
    if (!list.length) grid.append(h('div', { class: 'empty-note' }, 'No tracks yet. Start a new one, copy a campaign track, or import a friend\'s code.'));
    this.el.replaceChildren(header('My tracks', () => this.app.screens.back()), h('div', { class: 'ls-body' }, bar, grid));
    (bar.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
    (bar.firstElementChild as HTMLElement).focus();
  }

  private card(l: UserLevel): HTMLElement {
    const j = l.json;
    const validated = !!l.author && l.author.levelHash === levelFingerprint(j.blocks, j.car, j.laps ?? 1);
    const rec = Records.get(`${l.id}#${levelFingerprint(j.blocks, j.car, j.laps ?? 1)}`);
    const img = h('img', { class: 'thumb', alt: '', src: this.app.thumbnailOf(j) });
    const del = btn(this.armed === l.id ? 'Sure?' : 'Delete', () => {
      if (this.armed !== l.id) {
        this.armed = l.id;
        del.textContent = 'Sure?';
        return;
      }
      void this.app.deleteUserLevel(l.id).then(() => this.build());
    }, 'sm danger');
    return h('div', { class: 'card ml-card' },
      h('div', { class: 'thumb-wrap' }, img),
      h('div', { class: 'name' }, j.name),
      h('div', { class: 'meta' }, h('span', {}, `${this.app.car(j.car).label} · ${j.blocks.length} blocks${(j.laps ?? 1) > 1 ? ` · ${j.laps} laps` : ''}`), h('span', { class: 'pb' }, rec ? formatTime(rec.best) : '—')),
      h('div', { class: `meta ${validated ? 'good' : 'warn'}` }, validated ? `Author ${formatTime(j.medalTimes.author)} (${l.authorBy ?? 'bot'})` : 'Not validated'),
      h('div', { class: 'ml-acts' },
        btn('Play', () => void this.app.playUserLevel(l.id), 'sm primary'),
        btn('Edit', () => void this.app.editUserLevel(l.id), 'sm'),
        btn('Share', () => void this.app.shareLink(j).then((url) => this.app.screens.push(new ShareScreen(this.app, j.name, url))), 'sm'),
        btn('Export', () => void this.app.exportUserLevel(l.id), 'sm'),
        btn('Copy', () => void this.app.duplicateUserLevel(l.id).then(() => this.build()), 'sm'),
        del,
      ),
    );
  }
}
