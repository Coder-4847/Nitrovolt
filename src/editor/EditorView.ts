import {
  BufferAttribute, BufferGeometry, Color, ConeGeometry, DoubleSide, GridHelper, Group, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, Scene,
} from 'three';
import { BlockJson, CELL, LEVEL_H, TrackJson } from '../tracks/TrackSchema';
import { buildTrack } from '../tracks/TrackGenerator';
import { CellUse, blockCells } from '../tracks/Footprint';
import { ChainStart } from '../tracks/ChainLayout';

const OK = new Color(0x3ecf8e);
const BAD = new Color(0xff4040);

/** Editor overlays drawn into the game scene: build grid, block preview, cursor arrow, cell outlines. */
export class EditorView {
  readonly group = new Group();
  private readonly grid: GridHelper;
  private readonly arrow: Mesh;
  private readonly previewMat = new MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.45, depthWrite: false, side: DoubleSide });
  private preview: Group | null = null;
  private previewKey = '';
  private readonly hover: LineSegments;
  private readonly issues: LineSegments;
  private readonly cursorBox: LineSegments;

  constructor(private readonly scene: Scene) {
    this.grid = new GridHelper(CELL * 40, 40, 0x3d7eff, 0x4a5058);
    const gm = this.grid.material as LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.45;
    gm.depthWrite = false;
    this.arrow = new Mesh(new ConeGeometry(2.2, 5, 4).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    this.hover = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffd21f, depthTest: false, transparent: true }));
    this.issues = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff7a1a, depthTest: false, transparent: true, opacity: 0.8 }));
    this.cursorBox = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }));
    for (const l of [this.hover, this.issues, this.cursorBox]) {
      l.renderOrder = 20;
      l.frustumCulled = false;
    }
    this.group.add(this.grid, this.arrow, this.hover, this.issues, this.cursorBox);
    scene.add(this.group);
  }

  /** Grid at the cursor height, centred near the cursor, lines on cell edges. */
  setCursor(c: ChainStart): void {
    const [x, y, z] = c.gridPos;
    this.grid.position.set(Math.round(x / 4) * 4 * CELL + CELL / 2, y * LEVEL_H + 0.05, Math.round(z / 4) * 4 * CELL + CELL / 2);
    // arrow at the entry edge of the cursor cell, pointing along the heading
    const ang = (c.rot * Math.PI) / 2;
    this.arrow.position.set(x * CELL + Math.sin(ang) * CELL * 0.5, y * LEVEL_H + 2.5, z * CELL + Math.cos(ang) * CELL * 0.5);
    this.arrow.rotation.set(0, ang, 0);
    this.setOutline(this.cursorBox, [{ x, z, lo: y, hi: y }], 0.15);
  }

  /** Translucent copy of the block about to be placed (green = free, red = overlaps or cannot go there). */
  setPreview(block: BlockJson | null, ok: boolean): void {
    this.previewMat.color.copy(ok ? OK : BAD);
    const key = block ? JSON.stringify(block) : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    if (this.preview) {
      this.group.remove(this.preview);
      this.preview.traverse((o) => o instanceof Mesh && o.geometry.dispose());
      this.preview = null;
    }
    if (!block) return;
    const json: TrackJson = { id: 'preview', name: 'preview', car: 'volt', theme: 'neon', seed: 1, blocks: [block], medalTimes: { author: 0, gold: 0, silver: 0, bronze: 0 } };
    const track = buildTrack(json);
    const g = new Group();
    for (const m of track.meshes) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(m.positions, 3));
      geo.setIndex(new BufferAttribute(m.indices, 1));
      const mesh = new Mesh(geo, this.previewMat);
      mesh.renderOrder = 15;
      g.add(mesh);
    }
    // lift a hair so it does not z-fight with an existing block it replaces
    g.position.y = 0.04;
    this.preview = g;
    this.group.add(g);
  }

  setHover(cells: CellUse[], color: number): void {
    (this.hover.material as LineBasicMaterial).color.setHex(color);
    this.setOutline(this.hover, cells, 0.4);
  }

  /** Outline blocks with problems (unreachable / overlapping). */
  setIssues(blocks: BlockJson[]): void {
    this.setOutline(this.issues, blocks.flatMap((b) => blockCells(b)), 0.7);
  }

  private setOutline(l: LineSegments, cells: CellUse[], inset: number): void {
    const v: number[] = [];
    const h = CELL / 2 - inset;
    for (const c of cells) {
      const cx = c.x * CELL, cz = c.z * CELL;
      for (const y of new Set([c.lo * LEVEL_H + 0.15, c.hi * LEVEL_H + 0.15])) {
        const p = [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]] as const;
        for (let i = 0; i < 4; i++) {
          const a = p[i]!, b = p[(i + 1) % 4]!;
          v.push(a[0], y, a[1], b[0], y, b[1]);
        }
      }
    }
    l.geometry.dispose();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    l.geometry = g;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.setPreview(null, true);
    this.grid.dispose();
    for (const l of [this.hover, this.issues, this.cursorBox]) {
      l.geometry.dispose();
      (l.material as LineBasicMaterial).dispose();
    }
    this.arrow.geometry.dispose();
    this.previewMat.dispose();
  }
}
