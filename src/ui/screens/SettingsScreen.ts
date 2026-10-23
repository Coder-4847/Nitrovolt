import {
  Bindings, DEFAULT_BINDINGS, KEY_ACTION_LABELS, KeyAction, PAD_ACTION_LABELS, PadAction, prettyKey, saveBindings,
} from '../../core/input/Bindings';
import { ACCENT_PRESETS, PRIMARY_PRESETS, Livery, fromCss, loadLivery, saveLivery, toCss } from '../../core/Livery';
import { Records } from '../../core/Records';
import { exportSave, importSave } from '../../core/SaveFile';
import { GhostShow, CountdownMode, Settings } from '../../core/Settings';
import { GhostStore } from '../../core/GhostStore';
import { CARS, CAR_IDS } from '../../data/cars';
import { QUALITY, QualityLevel, saveQuality } from '../../render/Quality';
import { h } from '../dom';
import { AppApi } from './AppApi';
import { header } from './common';
import { Screen } from './ScreenManager';

type Tab = 'gameplay' | 'graphics' | 'audio' | 'controls' | 'garage' | 'access' | 'data';
const TABS: Array<[Tab, string]> = [
  ['gameplay', 'Gameplay'], ['graphics', 'Graphics'], ['audio', 'Audio'], ['controls', 'Controls'], ['garage', 'Garage'], ['access', 'Accessibility'], ['data', 'Data'],
];
let lastTab: Tab = 'gameplay';

const row = (label: string, control: HTMLElement, hint?: string): HTMLElement =>
  h('label', { class: 'line' }, h('span', {}, label, hint ? h('small', { class: 'hint' }, hint) : null), control);

function select<T extends string>(options: Array<[T, string]>, value: T, onChange: (v: T) => void): HTMLSelectElement {
  const s = h('select', {});
  for (const [v, label] of options) s.append(h('option', { value: v, ...(v === value ? { selected: true } : {}) }, label));
  s.onchange = () => onChange(s.value as T);
  return s;
}

const check = (value: boolean, onChange: (v: boolean) => void): HTMLInputElement => {
  const c = h('input', { type: 'checkbox', ...(value ? { checked: true } : {}) });
  c.onchange = () => onChange(c.checked);
  return c;
};

const range = (min: number, max: number, step: number, value: number, onInput: (v: number) => void): HTMLInputElement => {
  const r = h('input', { type: 'range', min, max, step, value });
  r.oninput = () => onInput(parseFloat(r.value));
  return r;
};

/** Settings with tabs: gameplay, graphics, audio, controls (remapping), garage (liveries), accessibility, data. */
export class SettingsScreen implements Screen {
  readonly el = h('div', { class: 'screen settings' });
  private body!: HTMLElement;
  private resetArmed = 0;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const tabs = h('div', { class: 'tabs' });
    for (const [id, label] of TABS) {
      tabs.append(h('button', { class: `tab${id === lastTab ? ' on' : ''}`, type: 'button', onclick: () => { lastTab = id; this.onShow(); this.el.querySelector<HTMLElement>('.tab.on')?.focus(); } }, label));
    }
    this.body = h('div', { class: 'set-body' });
    this.el.replaceChildren(header('Settings', () => this.app.screens.back()), h('div', { class: 'ls-body' }, tabs, this.body));
    this.fill();
    this.el.querySelector<HTMLElement>('.tab.on')?.setAttribute('data-autofocus', '');
    this.el.querySelector<HTMLElement>('.tab.on')?.focus();
  }

  private fill(): void {
    this.body.replaceChildren();
    const s = Settings.get();
    const { audio, gfx } = this.app;
    const b = this.body;
    switch (lastTab) {
      case 'gameplay':
        b.append(
          row('Start countdown', select<CountdownMode>([['instant', 'Instant (GO immediately)'], ['quick', 'Quick 3-2-1 (1.2 s)'], ['classic', 'Classic 3-2-1 (3 s)']], s.countdown, (v) => Settings.set('countdown', v))),
          row('Ghosts', select<GhostShow>([['pb', 'Personal best'], ['author', 'Author'], ['both', 'Personal best + author'], ['off', 'Off']], s.ghosts, (v) => Settings.set('ghosts', v)), 'Press G in a race to cycle'),
          h('div', { class: 'note' }, 'The countdown is only a display: the car is on the grid and in exactly the same state at GO whichever you pick, so ghosts and records are identical.'),
        );
        break;
      case 'graphics':
        b.append(
          row('Quality', select<QualityLevel>((Object.keys(QUALITY) as QualityLevel[]).map((k) => [k, k]), gfx.qualityLevel, (v) => { saveQuality(v); gfx.applyQuality(v); })),
          row('Speed lines', check(s.speedFx, (v) => Settings.set('speedFx', v))),
          row('Show FPS', check(s.showFps, (v) => Settings.set('showFps', v))),
        );
        break;
      case 'audio': {
        const a = audio.settings;
        const slider = (label: string, key: 'master' | 'engine' | 'sfx'): HTMLElement =>
          row(label, range(0, 1, 0.05, a[key], (v) => { a[key] = v; audio.applySettings(); }));
        b.append(slider('Master', 'master'), slider('Engine', 'engine'), slider('Effects', 'sfx'));
        break;
      }
      case 'controls':
        this.controls(b);
        break;
      case 'garage':
        this.garage(b);
        break;
      case 'access':
        b.append(
          row('HUD size', range(0.8, 1.6, 0.1, s.hudScale, (v) => Settings.set('hudScale', v)), 'Scales the speedometer, clock, splits and results'),
          row('Colour-blind medal colours', check(s.cbMedals, (v) => Settings.set('cbMedals', v)), 'Medals always have a distinct shape too'),
          row('Reduced motion', check(s.reducedMotion, (v) => Settings.set('reducedMotion', v)), 'Less camera shake and FOV kick, no pulsing UI'),
          row('Unlock every level', check(s.unlockAll, (v) => { Settings.set('unlockAll', v); this.app.toast(v ? 'All levels unlocked' : 'Progression restored'); }), 'Skips the medal gates; records still save'),
          h('div', { class: 'note' }, `Medal shapes: ${'◆ Author   ★ Gold   ● Silver   ■ Bronze'}`),
        );
        break;
      case 'data':
        this.data(b);
        break;
    }
  }

  private controls(b: HTMLElement): void {
    const { input } = this.app;
    const bi = input.bindings;
    const edit = (fn: (n: Bindings) => void, rerender = true): void => {
      const nb = structuredClone(input.bindings);
      fn(nb);
      input.applyBindings(nb);
      saveBindings(nb);
      if (rerender) this.fill();
    };
    b.append(
      row('Mouse steering (LMB gas, RMB brake)', check(input.mouseSteer, (v) => (input.mouseSteer = v))),
      row('Gamepad dead zone', range(0, 0.4, 0.01, bi.deadzone, (v) => edit((n) => (n.deadzone = v), false))),
      row('Gamepad steering curve', range(1, 2.5, 0.05, bi.steerCurve, (v) => edit((n) => (n.steerCurve = v), false))),
      h('div', { class: 'note' }, input.gamepad.id ? `Gamepad: ${input.gamepad.id}` : 'No gamepad detected. Press a button on it to connect.'),
      h('h4', {}, 'Keyboard'),
    );
    for (const act of Object.keys(KEY_ACTION_LABELS) as KeyAction[]) {
      const keys = h('span', { class: 'keys' });
      bi.keyboard[act].forEach((code, i) => {
        const k = h('button', { class: 'btn keycap', type: 'button' }, prettyKey(code));
        k.onclick = () => {
          k.textContent = 'press key…';
          k.classList.add('wait');
          input.keyboard.capture = (c) => edit((n) => { n.keyboard[act][i] = c; });
        };
        keys.append(k);
      });
      b.append(h('div', { class: 'line' }, h('span', {}, KEY_ACTION_LABELS[act]), keys));
    }
    b.append(h('h4', {}, 'Gamepad (select, then press a button)'));
    for (const act of Object.keys(PAD_ACTION_LABELS) as PadAction[]) {
      const k = h('button', { class: 'btn keycap', type: 'button' }, `Button ${bi.gamepad[act]}`);
      k.onclick = () => {
        k.textContent = 'press button…';
        k.classList.add('wait');
        input.gamepad.capture = (i) => edit((n) => { n.gamepad[act] = i; });
      };
      b.append(h('div', { class: 'line' }, h('span', {}, PAD_ACTION_LABELS[act]), k));
    }
    b.append(h('div', { class: 'foot' }, h('button', { class: 'btn', type: 'button', onclick: () => { input.applyBindings(structuredClone(DEFAULT_BINDINGS)); saveBindings(input.bindings); this.fill(); } }, 'Reset bindings')));
  }

  private garage(b: HTMLElement): void {
    for (const id of CAR_IDS) {
      const def = CARS[id];
      let lv: Livery = loadLivery(def);
      const apply = (l: Livery): void => {
        lv = l;
        saveLivery(id, l);
        if (this.app.gfx.def.id === id) this.app.gfx.car.setLivery(l.primary, l.accent);
        this.fill();
      };
      const sw = (list: number[], kind: 'primary' | 'accent'): HTMLElement => {
        const wrap = h('span', { class: 'swatches' });
        for (const c of list) {
          const s = h('button', { class: `sw${c === lv[kind] ? ' on' : ''}`, type: 'button', 'aria-label': toCss(c), style: `background:${toCss(c)}` });
          s.onclick = () => apply({ ...lv, [kind]: c });
          wrap.append(s);
        }
        const pick = h('input', { type: 'color', value: toCss(lv[kind]) });
        pick.onchange = () => apply({ ...lv, [kind]: fromCss(pick.value) });
        wrap.append(pick);
        return wrap;
      };
      b.append(
        h('h4', {}, `${def.label}`),
        h('div', { class: 'note' }, def.blurb),
        row('Paint', sw(PRIMARY_PRESETS, 'primary')),
        row('Accent', sw(ACCENT_PRESETS, 'accent')),
      );
    }
  }

  private data(b: HTMLElement): void {
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-file' });
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        await importSave(JSON.parse(await f.text()));
        this.app.toast('Save imported, reloading…');
        setTimeout(() => location.reload(), 700);
      } catch (e) {
        this.app.toast(`Import failed: ${(e as Error).message}`);
      }
    };
    const exp = h('button', { class: 'btn primary', type: 'button' }, 'Export save file');
    exp.onclick = async () => {
      const save = await exportSave();
      const url = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: 'application/json' }));
      const a = h('a', { href: url, download: `nitrovolt-save-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.app.toast(`Exported ${Object.keys(save.storage).length} settings and ${save.ghosts.length} ghosts`);
    };
    const imp = h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'Import save file…');
    const reset = h('button', { class: 'btn danger', type: 'button' }, 'Erase records and ghosts');
    reset.onclick = async () => {
      if (Date.now() - this.resetArmed > 4000) {
        this.resetArmed = Date.now();
        reset.textContent = 'Really erase? Press again';
        return;
      }
      Records.clear();
      await GhostStore.clear();
      this.resetArmed = 0;
      reset.textContent = 'Erased';
      this.app.toast('Records and ghosts erased');
    };
    b.append(
      h('div', { class: 'note' }, 'Your save lives in this browser. Export it to back it up or move to another device; importing replaces the current save.'),
      h('div', { class: 'foot left' }, exp, imp, file),
      h('h4', {}, 'Danger zone'),
      h('div', { class: 'foot left' }, reset),
    );
  }

  onBack(): boolean {
    return false;
  }
}
