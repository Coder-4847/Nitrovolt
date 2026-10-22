import { PARAM_DESCRIPTORS, VehicleParams, cloneParams, getParam, setParam } from '../physics/VehicleParams';
import { storage } from '../core/Storage';


/** Dev-only live tuning sliders for every car parameter (`?debug=1`). Mutates the shared params object. */
export class TuningPanel {
  private readonly el: HTMLElement;

  private readonly key: string;

  constructor(parent: HTMLElement, private readonly params: VehicleParams, onChange: () => void, carId: string) {
    this.key = `nitrovolt.tuning.${carId}`;
    const defaults = cloneParams(params);
    const saved = storage.get<Record<string, number> | null>(this.key, null);
    if (saved) for (const [k, v] of Object.entries(saved)) if (typeof v === 'number') setParam(params, k, v);
    onChange();

    this.el = document.createElement('div');
    this.el.className = 'panel tuning on';
    const head = document.createElement('h3');
    head.innerHTML = `<span>Tuning · ${params.name}</span><span>▾</span>`;
    const body = document.createElement('div');
    head.onclick = () => (body.style.display = body.style.display === 'none' ? '' : 'none');
    this.el.append(head, body);

    const groups = new Map<string, HTMLElement>();
    const inputs: Array<{ path: string; range: HTMLInputElement; num: HTMLInputElement }> = [];
    for (const d of PARAM_DESCRIPTORS) {
      let g = groups.get(d.group);
      if (!g) {
        g = document.createElement('div');
        g.className = 'grp';
        const t = document.createElement('div');
        t.className = 't';
        t.textContent = d.group;
        const rows = document.createElement('div');
        t.onclick = () => (rows.style.display = rows.style.display === 'none' ? '' : 'none');
        g.append(t, rows);
        (g as HTMLElement & { rows?: HTMLElement }).rows = rows;
        body.appendChild(g);
        groups.set(d.group, g);
      }
      const rows = (g as HTMLElement & { rows?: HTMLElement }).rows!;
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      label.textContent = d.label;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(d.min); range.max = String(d.max); range.step = String(d.step);
      const num = document.createElement('input');
      num.type = 'number';
      num.step = String(d.step);
      const apply = (val: number): void => {
        setParam(params, d.path, val);
        range.value = String(val);
        num.value = String(+val.toFixed(4));
        onChange();
        this.persist();
      };
      range.oninput = () => apply(parseFloat(range.value));
      range.onchange = () => range.blur();
      num.onchange = () => apply(parseFloat(num.value));
      row.append(label, range, num);
      rows.appendChild(row);
      inputs.push({ path: d.path, range, num });
    }
    const refresh = (): void => {
      for (const i of inputs) {
        const v = getParam(params, i.path);
        i.range.value = String(v);
        i.num.value = String(+v.toFixed(4));
      }
    };
    refresh();

    const actions = document.createElement('div');
    actions.className = 'actions';
    const reset = document.createElement('button');
    reset.className = 'btn';
    reset.textContent = 'Reset';
    reset.onclick = () => {
      for (const d of PARAM_DESCRIPTORS) setParam(params, d.path, getParam(defaults, d.path));
      refresh();
      onChange();
      this.persist();
    };
    const copy = document.createElement('button');
    copy.className = 'btn primary';
    copy.textContent = 'Copy JSON';
    copy.onclick = () => {
      const out: Record<string, number> = {};
      for (const d of PARAM_DESCRIPTORS) out[d.path] = getParam(params, d.path);
      void navigator.clipboard?.writeText(JSON.stringify(out, null, 2));
      copy.textContent = 'Copied!';
      setTimeout(() => (copy.textContent = 'Copy JSON'), 1200);
    };
    actions.append(reset, copy);
    body.appendChild(actions);
    parent.appendChild(this.el);
  }

  private persist(): void {
    const out: Record<string, number> = {};
    for (const d of PARAM_DESCRIPTORS) out[d.path] = getParam(this.params, d.path);
    storage.set(this.key, out);
  }

  toggle(): void {
    this.el.classList.toggle('on');
  }
}
