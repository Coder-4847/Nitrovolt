import { CAR_IDS, CARS } from '../../data/cars';
import { CAMPAIGN, SEASONS } from '../../data/campaign';
import { btn, h } from '../dom';
import { AppApi } from './AppApi';
import { MyLevelsScreen } from './MyLevelsScreen';
import { Screen } from './ScreenManager';

/** Display-only ratings for the car cards (0..5). */
const RATINGS: Record<string, { speed: number; grip: number; air: number; role: string }> = {
  volt: { speed: 5, grip: 5, air: 2, role: 'Stadium racer' },
  gravel: { speed: 3, grip: 3, air: 3, role: 'Rally car' },
  frost: { speed: 3, grip: 2, air: 3, role: 'Snow buggy' },
  dune: { speed: 4, grip: 2, air: 5, role: 'Desert truck' },
};

const SEASON_ART: Record<string, string> = {
  neon: 'linear-gradient(160deg, #2f6fd6 0%, #8fc0ee 55%, #4c8a3a 100%)',
  alpine: 'linear-gradient(160deg, #5f86c2 0%, #dfe8f2 60%, #f4f7fa 100%)',
  desert: 'linear-gradient(160deg, #4a6fa5 0%, #f2c79a 55%, #b98a5c 100%)',
  coast: 'linear-gradient(160deg, #34477e 0%, #ffa65c 60%, #3f6e36 100%)',
};

const FEATURES: Array<[string, string, string]> = [
  ['⟲', 'Instant restarts', 'One key and you are back on the line. Every attempt is a fresh, exact run.'],
  ['◆', 'Ghosts & medals', 'Race your personal best and the author ghost. Bronze, silver, gold, author.'],
  ['▲', '100 tracks', 'Four stadium seasons, from a first sprint to loops, wall-rides and big air.'],
  ['✎', 'Track editor', 'Build on a block grid, test-drive, validate and share a link with the whole track.'],
  ['◎', 'Four cars', 'Stadium racer, rally car, snow buggy and desert truck, each with its own feel.'],
  ['⌨', 'Any controller', 'Keyboard, mouse steering, gamepad with rumble, or touch with tilt.'],
];

/**
 * The landing page shown on arrival: a full-screen hero over the live stadium with the call to play,
 * then features, the four cars, the four seasons and the controls. Esc / Play goes to the main menu.
 */
export class LandingScreen implements Screen {
  readonly el = h('div', { class: 'screen landing' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const cont = this.app.continueLevel();
    const hero = h('section', { class: 'ld-hero' },
      h('div', { class: 'ld-badge' }, 'Free · in your browser · works offline'),
      h('h1', { class: 'ld-logo', html: '<i class="bolt"></i>NITRO<span>VOLT</span>' }),
      h('p', { class: 'ld-tag' }, 'Time-attack racing. Learn the line, shave the tenths, beat the author.'),
      h('div', { class: 'ld-cta' },
        btn('Play now', () => this.app.playLevel(cont), 'primary big ld-play'),
        btn('Main menu', () => this.app.screens.pop(), 'big'),
        btn('Track editor', () => {
          this.app.screens.pop();
          this.app.screens.push(new MyLevelsScreen(this.app));
        }, 'big ghost'),
      ),
      h('div', { class: 'ld-scroll' }, 'Scroll for more ↓'),
    );
    const features = h('section', { class: 'ld-sec' },
      h('h2', {}, 'Built for one more try'),
      h('div', { class: 'ld-features' }, ...FEATURES.map(([icon, title, text]) => h('div', { class: 'ld-card' }, h('div', { class: 'ld-ico' }, icon), h('h3', {}, title), h('p', {}, text)))),
    );
    const cars = h('section', { class: 'ld-sec' },
      h('h2', {}, 'Pick your machine'),
      h('div', { class: 'ld-cars' }, ...CAR_IDS.map((id) => {
        const c = CARS[id];
        const r = RATINGS[id]!;
        const bar = (label: string, v: number): HTMLElement => h('div', { class: 'ld-stat' }, h('span', {}, label), h('i', { style: `--v:${v / 5}` }));
        const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
        return h('div', { class: 'ld-car', style: `--p:${hex(c.livery.primary)};--a:${hex(c.livery.accent)}` },
          h('div', { class: 'ld-car-top' }, h('b', {}, c.label), h('small', {}, r.role)),
          h('p', {}, c.blurb.replace(/^[^:]+:\s*/, '')),
          bar('Speed', r.speed), bar('Grip', r.grip), bar('Air', r.air),
        );
      })),
    );
    const seasons = h('section', { class: 'ld-sec' },
      h('h2', {}, 'Four stadium seasons'),
      h('div', { class: 'ld-seasons' }, ...SEASONS.map((s) => {
        const first = CAMPAIGN.find((c) => c.season === s.id)?.levelId ?? null;
        const img = h('img', { class: 'ld-thumb', alt: '' });
        if (first) this.app.thumbnail(first, (url) => { if (url) img.src = url; }, () => this.el.isConnected);
        return h('div', { class: 'ld-season', style: `background:${SEASON_ART[s.theme] ?? ''}` },
          img,
          h('div', { class: 'ld-season-txt' }, h('b', {}, s.name), h('small', {}, s.blurb)),
        );
      })),
    );
    const controls = h('section', { class: 'ld-sec ld-controls' },
      h('h2', {}, 'Controls'),
      h('div', { class: 'ld-keys', html: [
        ['W / ↑', 'Accelerate'], ['S / ↓', 'Brake / reverse'], ['A D / ← →', 'Steer'], ['Enter', 'Restart instantly'],
        ['Backspace', 'Respawn at checkpoint'], ['C', 'Camera'], ['G', 'Ghosts'], ['Esc', 'Pause'],
      ].map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('') }),
      h('div', { class: 'ld-cta' }, btn('Play now', () => this.app.playLevel(cont), 'primary big')),
    );
    const foot = h('footer', { class: 'ld-foot' }, 'NITROVOLT · everything you see and hear is generated in code · no tracking, saves stay on your device');
    this.el.replaceChildren(hero, features, cars, seasons, controls, foot);
    (hero.querySelector('.ld-play') as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return false; // Esc leaves the landing page for the main menu
  }
}
