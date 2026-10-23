import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Material, Mesh, MeshStandardMaterial, Texture,
} from 'three';
import { EFFECTS, EffectId } from '../physics/Surface';
import { TrackData, TrackMesh } from '../tracks/TrackTypes';
import { Gates } from './env/Gates';
import { roadMaterial } from './env/RoadMaterial';
import { THEMES, ThemeDef } from './env/Theme';
import { wallMaterial } from './env/WallMaterial';
import { makeEffectTexture } from './Textures';

/** Block-library deco tints (start / checkpoint / finish / lap gantries, scenery blocks) -> theme paint. */
const DECO = { start: 0x28ff7a, checkpoint: 0x18e0ff, finish: 0xff3b2f, finishAlt: 0xff3a14, lap: 0xffd21f, tower: 0x2a3350, beacon: 0xff8a1f };

/** Effects whose pad texture scrolls along the driving direction. */
const SCROLLING: Partial<Record<EffectId, number>> = { turbo: 1.6, turbo2: 2.6, reactor: 2.2, cruise: 0.8, gravity: 0.7 };

/** Builds renderable meshes from the same TrackMesh data the colliders use (single source of truth). */
export class TrackView {
  readonly group = new Group();
  private readonly materials = new Map<string, Material>();
  private readonly textures: Texture[] = [];
  private readonly effectTextures = new Map<EffectId, CanvasTexture>();
  private readonly fragile = new Map<number, Mesh>();
  readonly gates: Gates;

  constructor(track: TrackData, private readonly theme: ThemeDef = THEMES.stadium) {
    for (const m of track.meshes) {
      const mesh = this.makeMesh(m);
      if (m.effect === 'fragile' && m.blockId >= 0) this.fragile.set(m.blockId, mesh);
      this.group.add(mesh);
    }
    this.gates = new Gates(track.triggers, theme);
    this.group.add(this.gates.group);
  }

  private effectMaterial(effect: EffectId): MeshStandardMaterial {
    const props = EFFECTS[effect];
    let tex = this.effectTextures.get(effect);
    if (!tex) {
      tex = makeEffectTexture(effect, props.color, props.glow);
      this.effectTextures.set(effect, tex);
      this.textures.push(tex);
    }
    // painted pads with a faint backlight on the markings so they stay readable in shade
    const mat = new MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      emissive: new Color(props.glow),
      emissiveMap: props.glow !== 0 ? tex : null,
      emissiveIntensity: props.glow !== 0 ? 0.22 : 0,
      roughness: 0.5,
      metalness: 0.05,
    });
    return mat;
  }

  private decoColor(raw: number): number {
    const t = this.theme;
    switch (raw) {
      case DECO.checkpoint: return t.gate.checkpoint;
      case DECO.finish: case DECO.finishAlt: return t.gate.finish;
      case DECO.start: return 0xeceef1;
      case DECO.lap: return 0xd9a933;
      case DECO.tower: return 0x8c9096;
      case DECO.beacon: return 0xe07a2a;
      default: return raw;
    }
  }

  private material(m: TrackMesh): Material {
    const key = `${m.kind}:${m.surface}:${m.tint ?? ''}:${m.effect ?? ''}`;
    let mat = this.materials.get(key);
    if (!mat) {
      const t = this.theme;
      if (m.kind === 'wall') {
        mat = wallMaterial(t);
      } else if (m.kind === 'deco') {
        // gantries and scenery blocks: painted steel in the theme's gate colours
        mat = new MeshStandardMaterial({ color: this.decoColor(m.tint ?? DECO.finish), roughness: 0.45, metalness: 0.35 });
      } else if (m.effect) {
        mat = this.effectMaterial(m.effect);
      } else {
        mat = roadMaterial(m.surface, t);
      }
      this.materials.set(key, mat);
    }
    return mat;
  }

  private makeMesh(m: TrackMesh): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new BufferAttribute(m.uvs, 2));
    const vc = m.positions.length / 3;
    const lat = m.lateral && m.lateral.length === vc * 2 ? m.lateral : new Float32Array(vc * 2).fill(-1);
    g.setAttribute('lateral', new BufferAttribute(lat, 2));
    g.setIndex(new BufferAttribute(m.indices, 1));
    g.computeBoundingSphere();
    const mesh = new Mesh(g, this.material(m));
    mesh.castShadow = m.kind !== 'road';
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Hide the meshes of broken fragile blocks; pass an empty set to restore everything. */
  setBroken(ids: ReadonlySet<number>): void {
    for (const [id, mesh] of this.fragile) mesh.visible = !ids.has(id);
  }

  /** Animate boost pads (scrolling chevrons) and the gates. */
  update(timeSeconds: number, dt = 0.016): void {
    this.gates.update(timeSeconds, dt);
    for (const [effect, tex] of this.effectTextures) {
      const speed = SCROLLING[effect];
      if (speed) tex.offset.y = -(timeSeconds * speed) % 1;
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    for (const m of this.materials.values()) m.dispose();
    this.gates.dispose();
    for (const t of this.textures) t.dispose();
  }
}
