import { prettyKey } from '../../core/input/Bindings';
import { EFFECTS, EffectId } from '../../physics/Surface';
import { h } from '../dom';
import { AppApi } from './AppApi';
import { header } from './common';
import { Screen } from './ScreenManager';

const SPECIALS: Array<[EffectId, string]> = [
  ['turbo', 'Turbo: a strong push past top speed for a few seconds.'],
  ['turbo2', 'Turbo 2: an even stronger, longer push.'],
  ['reactor', 'Reactor: pushes and lifts; you float while it lasts.'],
  ['noSteer', 'No steering: the wheel is locked while you are on it.'],
  ['noBrake', 'No brakes.'],
  ['cruise', 'Cruise control: holds the speed you entered with.'],
  ['engineOff', 'Engine off: you coast.'],
  ['slowMo', 'Slow motion: the world slows down (the clock does not).'],
  ['gravity', 'Low gravity for a few seconds: big, slow jumps.'],
  ['fragile', 'Fragile: breaks if you land on it hard.'],
];

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/** How to play: controls for every device, the special blocks and the main tips. */
export class HelpScreen implements Screen {
  readonly el = h('div', { class: 'screen help' });

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const k = this.app.input.bindings.keyboard;
    const key = (a: keyof typeof k): string => k[a].map(prettyKey).join(' / ');
    const rows: Array<[string, string, string, string]> = [
      ['Accelerate', key('accel'), 'RT', 'GAS'],
      ['Brake / reverse', key('brake'), 'LT', 'BRAKE'],
      ['Steer', `${key('left')} · ${key('right')}`, 'Left stick / D-pad', 'arrows or tilt'],
      ['Restart (instant)', key('restart'), 'Start', 'RESTART'],
      ['Respawn at checkpoint', key('respawn'), 'Y', 'RESPAWN'],
      ['Camera', key('camera'), 'A', 'camera button'],
      ['Ghosts', 'G', '', ''],
      ['Pause / back', key('pause'), 'Back · B in menus', 'menu button'],
    ];
    const table = h('table', { class: 'lb help-table' },
      h('thead', {}, h('tr', {}, ...['Action', 'Keyboard', 'Gamepad', 'Touch'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c))))),
    );
    const specials = h('div', { class: 'help-specials' }, ...SPECIALS.map(([id, text]) => h('div', { class: 'help-sp' }, h('span', { class: 'swatch', style: `background:${hex(EFFECTS[id].glow || EFFECTS[id].color)}` }), h('span', {}, text))));
    const times = h('div', { class: 'help-medals' }, 'There are no stars or unlocks: every track is open and the game is about the clock. Each track has a target time (the track\'s own validation run, its ghost proves it) and your personal best. Beat both: your best run races alongside you as a ghost, with a live gap to it at the top of the screen and a split at every checkpoint.');
    this.el.replaceChildren(
      header('How to play', () => this.app.screens.back()),
      h('div', { class: 'ls-body help-body' },
        h('p', {}, 'Drive from the start through every checkpoint (in order) to the finish as fast as you can. Restarting is instant, so try again and again. Your best run becomes your ghost.'),
        h('p', {}, 'Car gates: drive through a coloured portal and you finish that section in the car it names. A respawn puts you back in the car you had at the checkpoint.'),
        h('h4', {}, 'Controls'), table,
        h('p', { class: 'note' }, 'Keys and buttons can be changed in Settings > Controls. Mouse steering: M.'),
        h('h4', {}, 'Special blocks'), specials,
        h('h4', {}, 'Times and ghosts'), times,
        h('h4', {}, 'Tips'),
        h('ul', {},
          h('li', {}, 'Tap the brake to start a drift, then counter-steer to hold it.'),
          h('li', {}, 'In the air, accelerate tilts the nose down and brake lifts it: land flat to keep your speed.'),
          h('li', {}, 'Each car has its ground: Stadium on tarmac, Rally on dirt, Snow on snow and ice, Desert on sand.'),
          h('li', {}, 'Wall turns and loops need speed: stay on the gas and keep the wheel steady.'),
          h('li', {}, 'Watch the target ghost (Records, or G in a race) to find the line.'),
        ),
      ),
    );
  }
}
