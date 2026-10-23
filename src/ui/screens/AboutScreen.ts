import { h } from '../dom';
import { AppApi } from './AppApi';
import { header } from './common';
import { Screen } from './ScreenManager';

declare const __APP_VERSION__: string;

export class AboutScreen implements Screen {
  readonly el = h('div', { class: 'screen help' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    this.el.replaceChildren(
      header('About', () => this.app.screens.back()),
      h('div', { class: 'ls-body help-body' },
        h('div', { class: 'logo about-logo', html: 'NITRO<span>VOLT</span>' }),
        h('p', {}, `Version ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}. An original browser time-attack racer: instant restarts, ghosts, medals, jumps and a track editor. Not affiliated with any other racing game.`),
        h('p', {}, 'Everything you see and hear is generated in code: car models and liveries, tracks, stadiums, signage, sky, textures, engine sounds and music. No external art or audio assets; only the two fonts are bundled.'),
        h('h4', {}, 'Built with'),
        h('ul', {},
          h('li', {}, 'three.js (MIT licence): rendering'),
          h('li', {}, 'Rapier (Apache-2.0 licence): collision queries; the car physics is the game\'s own'),
          h('li', {}, 'Barlow Condensed and Inter fonts (SIL Open Font License), bundled via Fontsource'),
          h('li', {}, 'Vite and TypeScript'),
        ),
        h('h4', {}, 'Your data'),
        h('p', {}, 'Records, ghosts, settings and your tracks stay in this browser (localStorage / IndexedDB). Nothing is sent anywhere. Settings > Data exports everything to a file.'),
      ),
    );
  }
}
