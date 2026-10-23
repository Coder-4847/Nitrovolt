import { CAR_IDS, CARS } from '../../data/cars';
import { CAMPAIGN, TRAINING } from '../../data/campaign';
import { h } from '../dom';
import { AppApi } from './AppApi';
import { CAR_STATS } from './MainMenu';
import { Screen } from './ScreenManager';

const art = (f: string): string => `${import.meta.env.BASE_URL}art/${f}`;

const WORLDS: Array<[string, string, string]> = [
  ['forest', 'Forest', 'Green lawns, copses and the stadium beyond the trees.'],
  ['snow', 'Snow', 'Packed snow, rink-blue ice and pine-covered hills.'],
  ['desert', 'Desert', 'Sand, cactus fields and ravines to jump.'],
  ['sunset', 'Sunset', 'Cherry blossom and long shadows in the golden hour.'],
  ['night', 'Night', 'Floodlights, stars and walls lit in neon blue.'],
];

const FEATURES: Array<[string, string]> = [
  ['Car gates', 'Drive through a gate and finish the section in another car: stadium, rally, snow or desert.'],
  ['Walls and loops', 'Wall turns that hold you on at speed, full loops, half-pipes and corkscrews.'],
  ['Instant restart', 'One key and you are back on the line. Every attempt is an exact, fresh run.'],
  ['Ghosts and medals', 'Race your best and the author ghost. Bronze, silver, gold, author.'],
  ['Track of the day', 'A different campaign track every day, the same for everyone.'],
  ['Any controller', 'Keyboard, gamepad with rumble, mouse steering, or touch with tilt. Works offline.'],
];

/**
 * The landing page: a full-screen hero over the showroom with the call to play, then the five worlds,
 * the four cars, what makes it tick, the controls and a last call to play.
 */
export class LandingScreen implements Screen {
  readonly el = h('div', { class: 'screen landing' });
  readonly backdropShift = 0.22;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const cont = this.app.continueLevel();
    const play = (cls = ''): HTMLElement => h('button', { class: `ld-go ${cls}`.trim(), type: 'button', onclick: () => this.app.playLevel(cont) }, h('span', {}, 'Play now'));
    const hero = h('section', { class: 'ld-hero' },
      h('div', { class: 'ld-kicker' }, 'Time-attack racing · free in your browser'),
      h('h1', { class: 'ld-logo', html: 'NITRO<span>VOLT</span>' }),
      h('p', { class: 'ld-tag' }, 'Four cars. Hand-built tracks through forest, snow and desert. Learn the line, shave the tenths, beat the author.'),
      h('div', { class: 'ld-cta' }, play('ld-play'), h('button', { class: 'ld-alt', type: 'button', onclick: () => this.app.screens.pop() }, h('span', {}, 'Main menu'))),
      h('div', { class: 'ld-facts' }, ...[`${CAR_IDS.length} cars`, `${CAMPAIGN.length} campaign tracks`, `${TRAINING.length} training`, 'track of the day', 'ghosts', 'works offline'].map((t) => h('span', {}, t))),
      h('div', { class: 'ld-scroll' }, 'Scroll'),
    );
    const worlds = h('section', { class: 'ld-sec' },
      h('div', { class: 'ld-h' }, h('small', {}, 'Environments'), h('h2', {}, 'Five worlds')),
      h('div', { class: 'ld-worlds' }, ...WORLDS.map(([id, name, text]) => h('div', { class: 'ld-world' },
        h('img', { src: art(`${id}.jpg`), alt: `${name} track`, loading: 'lazy' }),
        h('div', { class: 'ld-world-txt' }, h('b', {}, name), h('small', {}, text)),
      ))),
    );
    const cars = h('section', { class: 'ld-sec ld-sec-alt' },
      h('div', { class: 'ld-h' }, h('small', {}, 'Garage'), h('h2', {}, 'Four cars, one run')),
      h('p', { class: 'ld-lead' }, 'Car gates switch you mid-track: a stadium section, a rally sector through the trees, a snowy pass, a desert jump.'),
      h('div', { class: 'ld-cars' }, ...CAR_IDS.map((id) => {
        const c = CARS[id];
        const st = CAR_STATS[id]!;
        const bar = (label: string, v: number): HTMLElement => h('div', { class: 'cc-stat' }, h('span', {}, label), h('i', { style: `--v:${v / 5}` }));
        return h('div', { class: 'ld-car' },
          h('img', { src: art(`car-${id}.png`), alt: `${c.label} car`, loading: 'lazy' }),
          h('div', { class: 'ld-car-name' }, `${c.label} car`),
          h('p', {}, c.blurb.replace(/^[^:]+:\s*/, '').replace(/^./, (x) => x.toUpperCase())),
          bar('Speed', st.speed), bar('Grip', st.grip), bar('Air', st.air),
        );
      })),
    );
    const features = h('section', { class: 'ld-sec' },
      h('div', { class: 'ld-h' }, h('small', {}, 'Why one more try'), h('h2', {}, 'Built for flow')),
      h('div', { class: 'ld-features' }, ...FEATURES.map(([t, d], i) => h('div', { class: 'ld-feat' }, h('span', { class: 'ld-num' }, String(i + 1).padStart(2, '0')), h('b', {}, t), h('p', {}, d)))),
    );
    const controls = h('section', { class: 'ld-sec ld-sec-alt' },
      h('div', { class: 'ld-h' }, h('small', {}, 'Controls'), h('h2', {}, 'Pick up and drive')),
      h('div', { class: 'ld-keys', html: [
        ['W / ↑ / RT', 'Accelerate'], ['S / ↓ / LT', 'Brake, reverse'], ['A D / ← → / stick', 'Steer'], ['Enter / Y', 'Restart instantly'],
        ['Backspace / B', 'Back to checkpoint'], ['C', 'Camera'], ['G', 'Ghosts'], ['Esc / Start', 'Pause'],
      ].map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('') }),
      h('div', { class: 'ld-cta' }, play()),
    );
    const foot = h('footer', { class: 'ld-foot' }, 'NITROVOLT · everything you see and hear is generated in code · no tracking, your saves stay on your device');
    this.el.replaceChildren(hero, worlds, cars, features, controls, foot);
    (hero.querySelector('.ld-play') as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return false; // Esc leaves the landing page for the main menu
  }
}
