import { AudioEngine } from '../audio/AudioEngine';
import {
  Bindings, DEFAULT_BINDINGS, KEY_ACTION_LABELS, KeyAction, PAD_ACTION_LABELS, PadAction, prettyKey, saveBindings,
} from '../core/input/Bindings';
import { InputManager } from '../core/input/InputManager';
import { ACCENT_PRESETS, Livery, PRIMARY_PRESETS, fromCss, saveLivery, toCss } from '../core/Livery';
import { storage } from '../core/Storage';
import { QUALITY, QualityLevel, saveQuality } from '../render/Quality';
import { GameRenderer } from '../render/GameRenderer';

export type CountdownMode = 'instant' | 'quick' | 'classic';
export const COUNTDOWN_SECONDS: Record<CountdownMode, number> = { instant: 0, quick: 1.2, classic: 3 };

export interface SettingsHooks {
  onToggle(open: boolean): void;
  toast(msg: string): void;
  levels: Array<{ id: string; name: string }>;
  currentLevel: string;
  onCountdown(mode: CountdownMode): void;
  carId: string;
  carLabel: string;
  livery: Livery;
  onLivery(l: Livery): void;
}

/** Pause menu: graphics, audio, input toggles and the keyboard / gamepad remapping UI. */
export class SettingsMenu {
  private readonly el: HTMLElement;
  private open = false;

  constructor(
    parent: HTMLElement,
    private readonly input: InputManager,
    private readonly audio: AudioEngine,
    private readonly gfx: GameRenderer,
    private readonly hooks: SettingsHooks,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'panel menu';
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.el.classList.toggle('on', v);
    if (v) this.render();
    this.hooks.onToggle(v);
  }

  private render(): void {
    const b = this.input.bindings;
    const q = this.gfx.qualityLevel;
    const a = this.audio.settings;
    const reduced = storage.get<boolean>('nitrovolt.reducedMotion', false);
    const fx = storage.get<boolean>('nitrovolt.speedFx', true);
    const cd = storage.get<CountdownMode>('nitrovolt.countdown', 'quick');

    const keyRows = (Object.keys(KEY_ACTION_LABELS) as KeyAction[])
      .map((act) => `<div class="line"><span>${KEY_ACTION_LABELS[act]}</span><span class="keys">${b.keyboard[act]
        .map((c, i) => `<button class="btn keycap" data-key="${act}:${i}">${prettyKey(c)}</button>`)
        .join('')}</span></div>`)
      .join('');
    const padRows = (Object.keys(PAD_ACTION_LABELS) as PadAction[])
      .map((act) => `<div class="line"><span>${PAD_ACTION_LABELS[act]}</span><button class="btn keycap" data-pad="${act}">Button ${b.gamepad[act]}</button></div>`)
      .join('');

    this.el.innerHTML = `
      <h2>Nitro<span>volt</span> · Menu</h2>
      <div class="note">Esc / P to resume. Changes save automatically.</div>
      <h4>Gameplay</h4>
      <div class="line"><span>Level</span><select data-lv>${this.hooks.levels.map((l) => `<option value="${l.id}" ${l.id === this.hooks.currentLevel ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
      <div class="line"><span>Start countdown</span><select data-cd>
        <option value="instant" ${cd === 'instant' ? 'selected' : ''}>Instant (GO immediately)</option>
        <option value="quick" ${cd === 'quick' ? 'selected' : ''}>Quick 3-2-1 (1.2 s)</option>
        <option value="classic" ${cd === 'classic' ? 'selected' : ''}>Classic 3-2-1 (3 s)</option></select></div>
      <h4>Car · ${this.hooks.carLabel}</h4>
      <div class="line"><span>Paint</span><span class="swatches" data-sw="primary">${PRIMARY_PRESETS.map((c) => `<button class="sw ${c === this.hooks.livery.primary ? 'on' : ''}" style="background:${toCss(c)}" data-c="${c}"></button>`).join('')}<input type="color" value="${toCss(this.hooks.livery.primary)}" data-cp></span></div>
      <div class="line"><span>Accent</span><span class="swatches" data-sw="accent">${ACCENT_PRESETS.map((c) => `<button class="sw ${c === this.hooks.livery.accent ? 'on' : ''}" style="background:${toCss(c)}" data-c="${c}"></button>`).join('')}<input type="color" value="${toCss(this.hooks.livery.accent)}" data-ca></span></div>
      <h4>Graphics</h4>
      <div class="line"><span>Quality</span><select data-q>${(Object.keys(QUALITY) as QualityLevel[]).map((k) => `<option value="${k}" ${k === q ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="line"><span>Speed lines</span><input type="checkbox" data-fx ${fx ? 'checked' : ''}></div>
      <div class="line"><span>Reduced motion (less shake / FOV kick)</span><input type="checkbox" data-rm ${reduced ? 'checked' : ''}></div>
      <h4>Audio</h4>
      <div class="line"><span>Master</span><input type="range" min="0" max="1" step="0.05" value="${a.master}" data-a="master"></div>
      <div class="line"><span>Engine</span><input type="range" min="0" max="1" step="0.05" value="${a.engine}" data-a="engine"></div>
      <div class="line"><span>Effects</span><input type="range" min="0" max="1" step="0.05" value="${a.sfx}" data-a="sfx"></div>
      <h4>Input</h4>
      <div class="line"><span>Mouse steering (LMB gas, RMB brake)</span><input type="checkbox" data-ms ${this.input.mouseSteer ? 'checked' : ''}></div>
      <div class="line"><span>Gamepad dead zone</span><input type="range" min="0" max="0.4" step="0.01" value="${b.deadzone}" data-dz></div>
      <div class="line"><span>Gamepad steering curve</span><input type="range" min="1" max="2.5" step="0.05" value="${b.steerCurve}" data-sc></div>
      <div class="note">${this.input.gamepad.id ? `Gamepad: ${this.input.gamepad.id}` : 'No gamepad detected. Press a button on it to connect.'}</div>
      <h4>Keyboard bindings</h4>${keyRows}
      <h4>Gamepad bindings (click, then press a button)</h4>${padRows}
      <div class="foot"><button class="btn" data-reset>Reset bindings</button><button class="btn primary" data-close>Resume</button></div>`;

    const $ = <T extends Element>(s: string): T => this.el.querySelector<T>(s)!;
    const setLivery = (l: Livery): void => {
      this.hooks.livery = l;
      saveLivery(this.hooks.carId, l);
      this.hooks.onLivery(l);
      this.render();
    };
    this.el.querySelectorAll<HTMLButtonElement>('[data-sw] .sw').forEach((b) => {
      b.onclick = () => {
        const kind = (b.parentElement as HTMLElement).dataset.sw as 'primary' | 'accent';
        setLivery({ ...this.hooks.livery, [kind]: Number(b.dataset.c) });
      };
    });
    $<HTMLInputElement>('[data-cp]').onchange = (e) => setLivery({ ...this.hooks.livery, primary: fromCss((e.target as HTMLInputElement).value) });
    $<HTMLInputElement>('[data-ca]').onchange = (e) => setLivery({ ...this.hooks.livery, accent: fromCss((e.target as HTMLInputElement).value) });
    $<HTMLSelectElement>('[data-lv]').onchange = (e) => {
      const params = new URLSearchParams(location.search);
      params.delete('track');
      params.set('level', (e.target as HTMLSelectElement).value);
      location.search = params.toString();
    };
    $<HTMLSelectElement>('[data-cd]').onchange = (e) => {
      const mode = (e.target as HTMLSelectElement).value as CountdownMode;
      storage.set('nitrovolt.countdown', mode);
      this.hooks.onCountdown(mode);
    };
    $<HTMLSelectElement>('[data-q]').onchange = (e) => {
      const lvl = (e.target as HTMLSelectElement).value as QualityLevel;
      saveQuality(lvl);
      this.gfx.applyQuality(lvl);
      this.hooks.toast(`Quality: ${lvl}`);
    };
    $<HTMLInputElement>('[data-fx]').onchange = (e) => {
      const on = (e.target as HTMLInputElement).checked;
      storage.set('nitrovolt.speedFx', on);
      this.gfx.speedFxEnabled = on;
    };
    $<HTMLInputElement>('[data-rm]').onchange = (e) => {
      const on = (e.target as HTMLInputElement).checked;
      storage.set('nitrovolt.reducedMotion', on);
      this.gfx.rig.reducedMotion = on;
    };
    this.el.querySelectorAll<HTMLInputElement>('[data-a]').forEach((r) => {
      r.oninput = () => {
        this.audio.settings[r.dataset.a as 'master' | 'engine' | 'sfx'] = parseFloat(r.value);
        this.audio.applySettings();
      };
    });
    $<HTMLInputElement>('[data-ms]').onchange = (e) => (this.input.mouseSteer = (e.target as HTMLInputElement).checked);
    $<HTMLInputElement>('[data-dz]').oninput = (e) => this.edit((nb) => (nb.deadzone = parseFloat((e.target as HTMLInputElement).value)), false);
    $<HTMLInputElement>('[data-sc]').oninput = (e) => this.edit((nb) => (nb.steerCurve = parseFloat((e.target as HTMLInputElement).value)), false);

    this.el.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((btn) => {
      btn.onclick = () => {
        const [act, idx] = btn.dataset.key!.split(':') as [KeyAction, string];
        btn.textContent = 'press key…';
        btn.classList.add('wait');
        this.input.keyboard.capture = (code) => {
          this.edit((nb) => {
            nb.keyboard[act][Number(idx)] = code;
          });
        };
      };
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.dataset.pad as PadAction;
        btn.textContent = 'press button…';
        btn.classList.add('wait');
        this.input.gamepad.capture = (idx) => {
          this.edit((nb) => {
            nb.gamepad[act] = idx;
          });
        };
      };
    });
    $<HTMLButtonElement>('[data-reset]').onclick = () => {
      this.input.applyBindings(structuredClone(DEFAULT_BINDINGS));
      saveBindings(this.input.bindings);
      this.render();
    };
    $<HTMLButtonElement>('[data-close]').onclick = () => this.setOpen(false);
  }

  private edit(fn: (b: Bindings) => void, rerender = true): void {
    const nb = structuredClone(this.input.bindings);
    fn(nb);
    this.input.applyBindings(nb);
    saveBindings(nb);
    if (rerender) this.render();
  }
}
