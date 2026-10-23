import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { GhostData, levelFingerprint } from '../core/Ghost';
import { MetaActions } from '../core/input/InputManager';
import { CARS, CAR_IDS } from '../data/cars';
import { EFFECTS, EffectId, SURFACE_IDS, SurfaceSpec } from '../physics/Surface';
import { RenderPose } from '../physics/Vehicle';
import { THEMES, ThemeId } from '../render/env/Theme';
import { GameRenderer } from '../render/GameRenderer';
import { BLOCKS, BLOCK_IDS, BlockCategory } from '../tracks/BlockLibrary';
import { Occupancy, blockCells } from '../tracks/Footprint';
import { CELL, LEVEL_H, TrackJson, Variant } from '../tracks/TrackSchema';
import { buildTrack } from '../tracks/TrackGenerator';
import { validateLevel } from '../tracks/Validate';
import { h } from '../ui/dom';
import { formatTime } from '../ui/Hud';
import { blockIcon } from './BlockIcons';
import { LevelCheck, checkLevel } from './Checks';
import { EditorCamera } from './EditorCamera';
import { Brush, EditorModel, Tool } from './EditorModel';
import { EditorView } from './EditorView';

/** Medal margins for player-made levels (the same as season 2 of the campaign). */
export const USER_MEDAL_FACTORS: [number, number, number] = [1.08, 1.2, 1.42];

export function medalTimesFor(author: number): TrackJson['medalTimes'] {
  const [g, s, b] = USER_MEDAL_FACTORS;
  return { author, gold: Math.round(author * g), silver: Math.round(author * s), bronze: Math.round(author * b) };
}

/** What the editor needs from the app around it. */
export interface EditorHost {
  readonly gfx: GameRenderer;
  readonly audio: AudioEngine;
  toast(msg: string): void;
  /** Drive the current draft (the editor resumes afterwards). */
  testDrive(json: TrackJson): void;
  /** Persist the draft (autosave). */
  save(json: TrackJson): void;
  /** The validated author run of this level, if any. */
  author(): GhostData | undefined;
  /** A new author run (bot validation). */
  setAuthor(ghost: GhostData, by: 'bot' | 'player'): void;
  openMenu(): void;
  /** True while a modal screen is open over the editor (keys go there). */
  modalOpen(): boolean;
}

const PALETTE: Array<[string, BlockCategory[]]> = [
  ['Road', ['straight', 'platform']],
  ['Curves', ['curve', 'bank', 'chicane']],
  ['Slopes & jumps', ['slope', 'jump']],
  ['Stunts', ['special', 'spiral']],
  ['Start / CP', ['gameplay']],
  ['Scenery', ['scenery']],
];

const SPECIAL_LABEL: Record<EffectId, string> = {
  turbo: 'Turbo', turbo2: 'Turbo 2', reactor: 'Reactor boost', noSteer: 'No steering', noBrake: 'No brakes',
  cruise: 'Cruise control', fragile: 'Fragile', slowMo: 'Slow motion', engineOff: 'Engine off', gravity: 'Low gravity',
};
const TOOL_KEYS: Record<Tool, string> = { place: '1', paint: '2', erase: '3', pick: '4' };
const TOOL_LABEL: Record<Tool, string> = { place: 'Place', paint: 'Paint', erase: 'Erase', pick: 'Pick' };
const HOVER_COLOR: Record<Tool, number> = { place: 0xffffff, paint: 0xffd21f, erase: 0xff4040, pick: 0x18e0ff };

const _ray = new Raycaster();
const _ndc = new Vector2();
const _hit = new Vector3();

/**
 * The track editor: a grid cursor driven by mouse, touch or keys, a block palette, brush properties,
 * level settings, live checks, test drive and bot validation. Edits a TrackJson through `EditorModel`.
 */
export class EditorSession {
  paused = false;
  readonly model: EditorModel;
  readonly cam = new EditorCamera();
  private readonly view: EditorView;
  private readonly ui: HTMLElement;
  private readonly refs: Record<string, HTMLElement> = {};
  private shown = -1;
  private check: LevelCheck | null = null;
  private pose: RenderPose | null = null;
  private hovered = -1;
  private readonly keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; button: number; type: string; moved: boolean }>();
  private pinch = 0;
  /** After a chain placement the cursor stays on the exit until the mouse really moves. */
  private lockAt: { x: number; y: number } | null = null;
  private lastTapCell = '';
  private lastMouse = { x: -1e4, y: -1e4 };
  private saveTimer = 0;
  private validating: { cancel: boolean } | null = null;
  private category = 0;
  private disposed = false;

  constructor(
    private readonly host: EditorHost,
    model: EditorModel,
    camState?: ReturnType<EditorCamera['snapshot']>,
  ) {
    this.model = model;
    this.view = new EditorView(host.gfx.scene);
    if (camState) this.cam.restore(camState);
    else this.frameTrack();
    this.ui = this.buildUi();
    document.getElementById('app')!.appendChild(this.ui);
    const el = host.gfx.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    model.onChange = () => this.scheduleSave();
    this.refreshPalette(true);
  }

  // ------------------------------------------------------------------ lifecycle

  step(): void {
    /* the editor has no fixed-step simulation */
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.validating) this.validating.cancel = true;
    clearTimeout(this.saveTimer);
    this.host.save(this.model.json);
    const el = this.host.gfx.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.view.dispose();
    this.ui.remove();
    this.host.gfx.viewCamera = null;
    this.model.onChange = () => undefined;
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.host.save(this.model.json), 700);
  }

  /** Point the camera at the whole track. */
  frameTrack(): void {
    const cl = buildTrack(this.model.json).centerline;
    if (!cl.length) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, y = 0;
    for (const p of cl) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      y += p.y;
    }
    this.cam.target.set((minX + maxX) / 2, y / cl.length, (minZ + maxZ) / 2);
    this.cam.dist = Math.max(80, Math.min(900, Math.max(maxX - minX, maxZ - minZ) * 1.1));
  }

  // ------------------------------------------------------------------ actions

  private act(): void {
    const m = this.model;
    switch (m.tool) {
      case 'place': {
        const at = m.cursor.gridPos.join();
        if (m.place() < 0) {
          this.host.toast('That block does not fit here');
          return;
        }
        this.host.audio.blip(m.cursor.gridPos.join() === at ? 600 : 760, 40);
        break;
      }
      case 'erase':
        if (this.hovered >= 0) {
          m.erase(this.hovered);
          this.host.audio.blip(300, 50);
        }
        break;
      case 'paint':
        if (this.hovered >= 0) {
          m.paint(this.hovered);
          this.host.audio.blip(900, 30);
        }
        break;
      case 'pick':
        if (this.hovered >= 0) {
          m.pick(this.hovered);
          this.refreshPalette(true);
          this.refreshBrush();
        }
        break;
    }
  }

  private setTool(t: Tool): void {
    this.model.tool = t;
    for (const [k, b] of Object.entries(this.refs)) if (k.startsWith('tool:')) b.classList.toggle('on', k === `tool:${t}`);
  }

  private undo(): void {
    this.model.undo();
    this.host.audio.blip(420, 40);
  }

  private redo(): void {
    this.model.redo();
    this.host.audio.blip(520, 40);
  }

  async validate(): Promise<void> {
    if (this.validating) {
      this.validating.cancel = true;
      return;
    }
    const c = checkLevel(this.model.json);
    if (c.errors.length) {
      this.host.toast(`Fix first: ${c.errors[0]}`);
      return;
    }
    const json = structuredClone(this.model.json);
    const token = { cancel: false };
    this.validating = token;
    const btn = this.refs.validate!;
    btn.textContent = 'Cancel (driving 0 %)';
    try {
      const { run } = await validateLevel(json, undefined, 240, {
        yieldEvery: 300,
        onProgress: (p) => (btn.textContent = `Cancel (driving ${Math.round(p * 100)} %)`),
        cancelled: () => token.cancel || this.disposed,
      });
      if (this.disposed) return;
      if (run.failure === 'cancelled') this.host.toast('Validation cancelled');
      else if (!run.finished || !run.ghost) {
        this.host.toast(`The bot could not finish: ${run.failure ?? 'unknown'}${run.failPos ? ' (marked)' : ''}`);
        if (run.failPos) {
          this.cam.target.set(run.failPos[0], run.failPos[1], run.failPos[2]);
          this.cam.dist = Math.min(this.cam.dist, 120);
        }
      } else if (levelFingerprint(json.blocks, json.car, json.laps ?? 1) !== levelFingerprint(this.model.json.blocks, this.model.json.car, this.model.json.laps ?? 1)) {
        this.host.toast('The track changed while the bot was driving; validate again');
      } else {
        this.host.setAuthor(run.ghost, 'bot');
        this.host.toast(`Validated: author time ${formatTime(run.time)}`);
        this.host.audio.medalJingle(2);
      }
    } finally {
      this.validating = null;
      btn.textContent = 'Validate (bot)';
      this.shown = -1;
    }
  }

  /** Does the brush's block overlap something already placed? */
  private previewOverlaps(block: ReturnType<EditorModel['preview']>): boolean {
    if (!block) return true;
    const def = BLOCKS[block.block.type]!;
    if (!def.chain) return false;
    const occ = new Occupancy(1.2, 1e9);
    const m = this.model;
    const replaces = m.json.blocks.findIndex((b) => b.gridPos.join() === block.block.gridPos.join() && b.rot === block.block.rot);
    m.json.blocks.forEach((b, i) => {
      if (i !== replaces && BLOCKS[b.type]?.chain) occ.add(blockCells(b), 0);
    });
    return occ.conflicts(blockCells(block.block), 5);
  }

  // ------------------------------------------------------------------ input

  private cellUnder(clientX: number, clientY: number): [number, number] | null {
    const el = this.host.gfx.renderer.domElement;
    const r = el.getBoundingClientRect();
    _ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.cam.camera);
    const plane = new Plane(new Vector3(0, 1, 0), -this.model.cursor.gridPos[1] * LEVEL_H);
    if (!_ray.ray.intersectPlane(plane, _hit)) return null;
    return [Math.round(_hit.x / CELL), Math.round(_hit.z / CELL)];
  }

  private hoverAt(clientX: number, clientY: number, moveCursor: boolean): void {
    const c = this.cellUnder(clientX, clientY);
    if (!c) return;
    if (moveCursor && this.model.tool === 'place') {
      if (this.lockAt && Math.hypot(clientX - this.lockAt.x, clientY - this.lockAt.y) < 28) return;
      this.lockAt = null;
      this.model.moveCursor(c[0], c[1]);
    }
    this.hovered = this.model.blockAt(c[0], c[1]);
  }

  private onContext = (e: Event): void => e.preventDefault();

  private onDown = (e: PointerEvent): void => {
    if (this.host.modalOpen()) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType, moved: false });
    if (this.pointers.size === 2) this.pinch = 0;
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && (e.target as HTMLElement).tagName === 'CANVAS') {
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.hoverAt(e.clientX, e.clientY, true);
      }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) p.moved = true;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [typeof p, typeof p];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0) this.cam.zoom(this.pinch / d);
      this.pinch = d;
      this.cam.pan(dx / 2, dy / 2);
      return;
    }
    if (!p.moved) return;
    if (p.button === 2 || p.button === 1 || e.shiftKey) this.cam.pan(dx, dy);
    else this.cam.orbit(dx, dy);
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p || p.moved || this.pointers.size > 0 || p.button !== 0) return;
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    if (p.type === 'touch') {
      // touch: first tap moves the cursor, a second tap on the same cell acts
      const c = this.cellUnder(e.clientX, e.clientY);
      if (!c) return;
      const key = c.join();
      this.hovered = this.model.blockAt(c[0], c[1]);
      if (this.model.tool === 'place' && key !== this.lastTapCell && !(this.lockAt && this.model.cursor.gridPos[0] === c[0] && this.model.cursor.gridPos[2] === c[1])) {
        this.lockAt = null;
        this.model.moveCursor(c[0], c[1]);
        this.lastTapCell = key;
        return;
      }
      this.lastTapCell = '';
    } else this.hoverAt(e.clientX, e.clientY, true);
    this.act();
    if (this.model.tool === 'place' && this.model.chain) {
      this.lockAt = { x: e.clientX, y: e.clientY };
      this.lastTapCell = this.model.cursor.gridPos[0] + ',' + this.model.cursor.gridPos[2];
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.altKey || e.ctrlKey) this.model.setLevel(this.model.cursor.gridPos[1] + (e.deltaY < 0 ? 1 : -1));
    else this.cam.zoom(e.deltaY > 0 ? 1.12 : 0.89);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (this.host.modalOpen()) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
    const m = this.model;
    const ctrl = e.ctrlKey || e.metaKey;
    this.keys.add(e.code);
    const cursorStep = (fx: number, fz: number): void => {
      // arrows move the cursor relative to the camera's facing, snapped to the grid axes
      const yaw = Math.round(this.cam.yaw / (Math.PI / 2)) * (Math.PI / 2);
      const rx = Math.round(Math.cos(yaw)), rz = Math.round(-Math.sin(yaw));
      const ffx = Math.round(-Math.sin(yaw)), ffz = Math.round(-Math.cos(yaw));
      m.moveCursor(m.cursor.gridPos[0] + rx * fx + ffx * fz, m.cursor.gridPos[2] + rz * fx + ffz * fz);
      this.hovered = m.blockAt(m.cursor.gridPos[0], m.cursor.gridPos[2]);
    };
    let used = true;
    if (ctrl && e.code === 'KeyZ') e.shiftKey ? this.redo() : this.undo();
    else if (ctrl && e.code === 'KeyY') this.redo();
    else if (ctrl && e.code === 'KeyS') {
      this.host.save(m.json);
      this.host.toast('Saved');
    } else if (ctrl) used = false;
    else switch (e.code) {
      case 'Digit1': this.setTool('place'); break;
      case 'Digit2': this.setTool('paint'); break;
      case 'Digit3': this.setTool('erase'); break;
      case 'Digit4': this.setTool('pick'); break;
      case 'KeyR': m.rotate(e.shiftKey ? -1 : 1); break;
      case 'PageUp': case 'KeyE': m.setLevel(m.cursor.gridPos[1] + 1); break;
      case 'PageDown': case 'KeyQ': m.setLevel(m.cursor.gridPos[1] - 1); break;
      case 'Space': case 'Enter': {
        this.hovered = m.blockAt(m.cursor.gridPos[0], m.cursor.gridPos[2]);
        this.act();
        // keep the chained cursor until the mouse really moves
        if (m.tool === 'place' && m.chain) this.lockAt = { ...this.lastMouse };
        break;
      }
      case 'Delete': case 'Backspace': {
        const i = this.hovered >= 0 ? this.hovered : m.blockAt(m.cursor.gridPos[0], m.cursor.gridPos[2]);
        if (i >= 0) m.erase(i);
        break;
      }
      case 'KeyC': m.chain = !m.chain; this.refs.chain!.classList.toggle('on', m.chain); this.host.toast(`Chain mode ${m.chain ? 'on' : 'off'}`); break;
      case 'KeyT': this.cam.top = !this.cam.top; break;
      case 'KeyF': this.frameTrack(); break;
      case 'KeyG': this.host.testDrive(m.json); break;
      case 'ArrowUp': cursorStep(0, 1); break;
      case 'ArrowDown': cursorStep(0, -1); break;
      case 'ArrowLeft': cursorStep(-1, 0); break;
      case 'ArrowRight': cursorStep(1, 0); break;
      case 'BracketLeft': this.cycleBlock(-1); break;
      case 'BracketRight': this.cycleBlock(1); break;
      default: used = false;
    }
    if (used) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  /** [ / ] step through the blocks of the current palette group. */
  private cycleBlock(dir: number): void {
    const list = this.blocksIn(this.category);
    const i = list.indexOf(this.model.brush.type);
    this.model.brush.type = list[(i + dir + list.length) % list.length]!;
    this.refreshPalette();
  }

  // ------------------------------------------------------------------ UI

  private blocksIn(cat: number): string[] {
    const cats = PALETTE[cat]![1];
    return BLOCK_IDS.filter((id) => cats.includes(BLOCKS[id]!.category));
  }

  private buildUi(): HTMLElement {
    const r = this.refs;
    const m = this.model;
    const tool = (t: Tool): HTMLButtonElement => {
      const b = h('button', { class: `btn ${m.tool === t ? 'on' : ''}`, type: 'button', title: `${TOOL_LABEL[t]} (${TOOL_KEYS[t]})`, onclick: () => this.setTool(t) }, TOOL_LABEL[t]);
      r[`tool:${t}`] = b;
      return b;
    };
    const small = (label: string, title: string, fn: () => void, key?: string): HTMLButtonElement => {
      const b = h('button', { class: 'btn', type: 'button', title, onclick: fn }, label);
      if (key) r[key] = b;
      return b;
    };
    r.level = h('span', { class: 'ed-level' }, 'Height 0');
    r.chain = small('Chain', 'Chain mode: the cursor jumps to the end of each placed piece (C)', () => {
      m.chain = !m.chain;
      r.chain!.classList.toggle('on', m.chain);
    });
    r.chain.classList.toggle('on', m.chain);
    r.undo = small('Undo', 'Undo (Ctrl+Z)', () => this.undo());
    r.redo = small('Redo', 'Redo (Ctrl+Y)', () => this.redo());
    r.validate = h('button', { class: 'btn', type: 'button', title: 'Let the bot drive it: sets the author time and medals', onclick: () => void this.validate() }, 'Validate (bot)');
    const top = h('div', { class: 'ed-top' },
      h('div', { class: 'ed-tools' }, tool('place'), tool('paint'), tool('erase'), tool('pick')),
      h('div', { class: 'ed-tools' },
        small('Rotate', 'Rotate (R / Shift+R)', () => m.rotate(1)),
        small('Down', 'Cursor height down (Q / PageDown)', () => m.setLevel(m.cursor.gridPos[1] - 1)),
        r.level,
        small('Up', 'Cursor height up (E / PageUp)', () => m.setLevel(m.cursor.gridPos[1] + 1)),
        r.chain,
      ),
      h('div', { class: 'ed-tools' }, r.undo, r.redo, small('Top', 'Top view (T)', () => (this.cam.top = !this.cam.top)), small('Frame', 'Frame the whole track (F)', () => this.frameTrack())),
      h('div', { class: 'ed-tools right' },
        h('button', { class: 'btn primary', type: 'button', title: 'Test drive (G)', onclick: () => this.host.testDrive(m.json) }, 'Test drive'),
        r.validate,
        small('Menu', 'Editor menu (Esc)', () => this.host.openMenu()),
      ),
    );
    // palette
    const tabs = h('div', { class: 'ed-tabs' });
    PALETTE.forEach(([label], i) => {
      const b = h('button', { class: `tab ${i === this.category ? 'on' : ''}`, type: 'button', onclick: () => { this.category = i; this.refreshPalette(); } }, label);
      r[`cat:${i}`] = b;
      tabs.append(b);
    });
    r.blocks = h('div', { class: 'ed-blocks' });
    const palette = h('div', { class: 'ed-palette panel' }, tabs, r.blocks);
    // brush + level settings + checks
    r.brush = h('div', { class: 'ed-brush' });
    r.meta = h('div', { class: 'ed-meta' });
    r.status = h('div', { class: 'ed-status' });
    const side = h('div', { class: 'ed-side panel' }, h('h4', {}, 'Block'), r.brush, h('h4', {}, 'Track'), r.meta, h('h4', {}, 'Checks'), r.status);
    const help = h('div', { class: 'ed-help' }, 'Click: place · Drag: orbit · Right-drag / Shift: pan · Wheel: zoom · R rotate · Q/E height · 1-4 tools · Space place at cursor · arrows move cursor · G test drive');
    const toggle = h('button', { class: 'btn ed-fold', type: 'button', onclick: () => this.ui.classList.toggle('folded') }, 'Panels');
    const ui = h('div', { class: 'editor-ui' }, top, palette, side, help, toggle);
    this.refreshBrushInto(r.brush);
    this.refreshMetaInto(r.meta);
    return ui;
  }

  private refreshPalette(followBrush = false): void {
    const r = this.refs;
    const cur = this.model.brush.type;
    // jump to the group of a picked block
    const ci = PALETTE.findIndex(([, cats]) => cats.includes(BLOCKS[cur]!.category));
    if (followBrush && ci >= 0 && !this.blocksIn(this.category).includes(cur)) this.category = ci;
    PALETTE.forEach((_, i) => r[`cat:${i}`]?.classList.toggle('on', i === this.category));
    const host = r.blocks!;
    host.replaceChildren();
    for (const id of this.blocksIn(this.category)) {
      const def = BLOCKS[id]!;
      const b = h('button', { class: `ed-block ${id === cur ? 'on' : ''}`, type: 'button', title: def.label, onclick: () => { this.model.brush.type = id; this.setTool('place'); this.refreshPalette(); } },
        h('img', { src: blockIcon(id), alt: '', draggable: false }), h('span', {}, def.label));
      host.append(b);
    }
  }

  private refreshBrush(): void {
    this.refreshBrushInto(this.refs.brush!);
  }

  private refreshBrushInto(host: HTMLElement): void {
    const br = this.model.brush;
    const sel = <T extends string>(options: Array<[T, string]>, value: T, on: (v: T) => void): HTMLSelectElement => {
      const s = h('select', {});
      for (const [v, l] of options) s.append(h('option', { value: v, ...(v === value ? { selected: true } : {}) }, l));
      s.onchange = () => on(s.value as T);
      return s;
    };
    const surfaces: Array<[SurfaceSpec, string]> = [
      ...SURFACE_IDS.map((s): [SurfaceSpec, string] => [s, s[0]!.toUpperCase() + s.slice(1)]),
      ...(Object.keys(EFFECTS) as EffectId[]).map((e): [SurfaceSpec, string] => [e, `Special: ${SPECIAL_LABEL[e]}`]),
    ];
    const set = (patch: Partial<Brush>): void => {
      Object.assign(this.model.brush, patch);
    };
    host.replaceChildren(
      h('label', { class: 'line' }, h('span', {}, 'Width'), sel<Variant>([['narrow', 'Narrow 8 m'], ['std', 'Normal 12 m'], ['wide', 'Wide 16 m']], br.variant, (v) => set({ variant: v }))),
      h('label', { class: 'line' }, h('span', {}, 'Surface'), sel<SurfaceSpec>(surfaces, br.surface, (v) => set({ surface: v }))),
      h('label', { class: 'line' }, h('span', {}, 'Walls'), sel<Brush['walls']>([['auto', 'Block default'], ['none', 'None'], ['left', 'Left'], ['right', 'Right'], ['both', 'Both']], br.walls, (v) => set({ walls: v }))),
      h('div', { class: 'note' }, 'Paint (2) applies width, surface and walls to blocks you click.'),
    );
  }

  private refreshMetaInto(host: HTMLElement): void {
    const j = this.model.json;
    const name = h('input', { type: 'text', value: j.name, maxlength: 40 });
    name.onchange = () => this.model.setMeta({ name: name.value.trim() || 'Untitled' });
    const car = h('select', {});
    for (const id of CAR_IDS) car.append(h('option', { value: id, ...(id === j.car ? { selected: true } : {}) }, CARS[id].label));
    car.onchange = () => this.model.setMeta({ car: car.value });
    const theme = h('select', {});
    for (const id of Object.keys(THEMES) as ThemeId[]) theme.append(h('option', { value: id, ...(id === j.theme ? { selected: true } : {}) }, THEMES[id].label));
    theme.onchange = () => this.model.setMeta({ theme: theme.value });
    const laps = h('select', {});
    for (const n of [1, 2, 3, 4, 5]) laps.append(h('option', { value: n, ...(n === (j.laps ?? 1) ? { selected: true } : {}) }, n === 1 ? '1 (sprint)' : `${n} laps`));
    laps.onchange = () => this.model.setMeta({ laps: Number(laps.value) });
    host.replaceChildren(
      h('label', { class: 'line' }, h('span', {}, 'Name'), name),
      h('label', { class: 'line' }, h('span', {}, 'Car'), car),
      h('label', { class: 'line' }, h('span', {}, 'Theme'), theme),
      h('label', { class: 'line' }, h('span', {}, 'Laps'), laps),
    );
  }

  private refreshStatus(): void {
    const c = this.check!;
    const j = this.model.json;
    const a = this.host.author();
    const current = a && a.levelHash === levelFingerprint(j.blocks, j.car, j.laps ?? 1);
    const items: HTMLElement[] = [];
    for (const e of c.errors) items.push(h('div', { class: 'bad' }, `✕ ${e}`));
    for (const w of c.warnings) items.push(h('div', { class: 'warn' }, `! ${w}`));
    if (!c.errors.length) items.push(h('div', { class: 'good' }, `✓ Drivable: ${c.path.length} pieces from start to finish, ${c.checkpoints} checkpoint${c.checkpoints === 1 ? '' : 's'}`));
    items.push(current
      ? h('div', { class: 'good' }, `✓ Author ${formatTime(j.medalTimes.author)} · gold ${formatTime(j.medalTimes.gold)}`)
      : h('div', { class: 'note' }, 'Not validated: run the bot, or finish a test drive and keep your time as the author time.'));
    items.push(h('div', { class: 'note' }, `${j.blocks.length} blocks`));
    this.refs.status!.replaceChildren(...items);
    (this.refs.undo as HTMLButtonElement).disabled = !this.model.canUndo;
    (this.refs.redo as HTMLButtonElement).disabled = !this.model.canRedo;
  }

  // ------------------------------------------------------------------ frame

  render(_alpha: number, dt: number, _meta: MetaActions): void {
    const m = this.model;
    const { gfx } = this.host;
    // WASD pans the view
    if (!this.host.modalOpen()) {
      const k = this.keys;
      const fx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const fz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      if (fx || fz) this.cam.move(fx, fz, dt);
    }
    if (m.revision !== this.shown) {
      this.shown = m.revision;
      const track = buildTrack(m.json);
      gfx.setTrack(track, { scenery: false });
      const p = track.start;
      this.pose = {
        position: p.position.clone(),
        quaternion: p.quaternion.clone(),
        springLen: [0.3, 0.3, 0.3, 0.3],
        steer: [0, 0, 0, 0],
        spin: [0, 0, 0, 0],
      };
      this.check = checkLevel(m.json);
      this.view.setIssues([...this.check.unreachable, ...this.check.overlaps.flat()].map((i) => m.json.blocks[i]!).filter(Boolean));
      this.refreshStatus();
      this.refreshMetaInto(this.refs.meta!);
    }
    this.refs.level!.textContent = `Height ${m.cursor.gridPos[1]}`;
    this.view.setCursor(m.cursor);
    if (m.tool === 'place') {
      const p = m.preview();
      this.view.setPreview(p?.block ?? null, !!p && !this.previewOverlaps(p));
      this.view.setHover([], 0xffffff);
    } else {
      this.view.setPreview(null, true);
      const b = m.json.blocks[this.hovered];
      this.view.setHover(b ? blockCells(b) : [], HOVER_COLOR[m.tool]);
    }
    this.cam.update();
    gfx.viewCamera = this.cam.camera;
    if (this.pose) gfx.render(dt, this.pose, new Vector3(), 0, 0);
  }

  /** Camera state to restore after a test drive. */
  snapshot(): ReturnType<EditorCamera['snapshot']> {
    return this.cam.snapshot();
  }
}
