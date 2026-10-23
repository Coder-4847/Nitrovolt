import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Material, Mesh, MeshStandardMaterial, Texture,
} from 'three';
import { EFFECTS, EffectId } from '../physics/Surface';
import { TrackData, TrackMesh } from '../tracks/TrackTypes';
import { Gates } from './env/Gates';
import { roadMaterial } from './env/RoadMaterial';
import { THEMES, ThemeDef } from './env/Theme';
import { makeEffectTexture, makeStripeTexture } from './Textures';

/** Effects whose pad texture scrolls along the driving direction. */
const SCROLLING: Partial<Record<EffectId, number>> = { turbo: 1.6, turbo2: 2.6, reactor: 2.2, cruise: 0.8, gravity: 0.7 };

/** Builds renderable meshes from the same TrackMesh data the colliders use (single source of truth). */
export class TrackView {
  readonly group = new Group();
  private readonly materials = new Map<string, Material>();
  private readonly textures: Texture[] = [];
  private readonly effectTextures = new Map<EffectId, CanvasTexture>();
  private readonly glowMats: Array<{ mat: MeshStandardMaterial; base: number }> = [];
  private readonly fragile = new Map<number, Mesh>();
  readonly gates: Gates;

  constructor(track: TrackData, private readonly theme: ThemeDef = THEMES.stadium) {
    const stripes = makeStripeTexture(theme.wall.a, theme.wall.b);
    this.textures.push(stripes);
    for (const m of track.meshes) {
      const mesh = this.makeMesh(m, stripes);
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
    const glowing = props.glow !== 0;
    const mat = new MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      emissive: new Color(props.glow),
      emissiveMap: glowing ? tex : null,
      emissiveIntensity: glowing ? 1.1 : 0,
      roughness: 0.55,
      metalness: 0.1,
    });
    if (glowing) this.glowMats.push({ mat, base: 1.1 });
    return mat;
  }

  private material(m: TrackMesh, stripes: Texture): Material {
    const key = `${m.kind}:${m.surface}:${m.tint ?? ''}:${m.effect ?? ''}`;
    let mat = this.materials.get(key);
    if (!mat) {
      const t = this.theme;
      if (m.kind === 'wall') {
        mat = new MeshStandardMaterial({
          map: stripes, roughness: 0.7, metalness: 0.0,
          emissive: new Color(t.wall.glow ? 0xffffff : 0), emissiveMap: t.wall.glow ? stripes : null, emissiveIntensity: 0.55 * t.wall.glow,
        });
      } else if (m.kind === 'deco') {
        // checkpoint / finish gantries take the theme's gate colours
        const raw = m.tint ?? 0xff4d2e;
        const c = raw === 0x18e0ff ? t.gate.checkpoint : raw === 0xff3b2f ? t.gate.finish : raw;
        mat = new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: t.night ? 1.4 : 0.55, roughness: 0.5 });
      } else if (m.effect) {
        mat = this.effectMaterial(m.effect);
      } else {
        mat = roadMaterial(m.surface, t);
      }
      this.materials.set(key, mat);
    }
    return mat;
  }

  private makeMesh(m: TrackMesh, stripes: Texture): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new BufferAttribute(m.uvs, 2));
    const vc = m.positions.length / 3;
    const lat = m.lateral && m.lateral.length === vc * 2 ? m.lateral : new Float32Array(vc * 2).fill(-1);
    g.setAttribute('lateral', new BufferAttribute(lat, 2));
    g.setIndex(new BufferAttribute(m.indices, 1));
    g.computeBoundingSphere();
    const mesh = new Mesh(g, this.material(m, stripes));
    mesh.castShadow = m.kind !== 'road';
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Hide the meshes of broken fragile blocks; pass an empty set to restore everything. */
  setBroken(ids: ReadonlySet<number>): void {
    for (const [id, mesh] of this.fragile) mesh.visible = !ids.has(id);
  }

  /** Animate boost pads (scrolling chevrons, pulsing glow) and the gates. */
  update(timeSeconds: number, dt = 0.016): void {
    this.gates.update(timeSeconds, dt);
    for (const [effect, tex] of this.effectTextures) {
      const speed = SCROLLING[effect];
      if (speed) tex.offset.y = -(timeSeconds * speed) % 1;
    }
    const pulse = 0.85 + 0.25 * Math.sin(timeSeconds * 5);
    for (const g of this.glowMats) g.mat.emissiveIntensity = g.base * pulse;
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
