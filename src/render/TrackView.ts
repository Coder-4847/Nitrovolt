import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Material, Mesh, MeshStandardMaterial, Texture,
} from 'three';
import { EFFECTS, EffectId, SURFACES } from '../physics/Surface';
import { TrackData, TrackMesh } from '../tracks/TrackTypes';
import { makeEffectTexture, makeGridTexture, makeStripeTexture } from './Textures';

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

  constructor(track: TrackData) {
    const grid = makeGridTexture();
    const stripes = makeStripeTexture();
    this.textures.push(grid, stripes);
    for (const m of track.meshes) {
      const mesh = this.makeMesh(m, grid, stripes);
      if (m.effect === 'fragile' && m.blockId >= 0) this.fragile.set(m.blockId, mesh);
      this.group.add(mesh);
    }
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

  private material(m: TrackMesh, grid: Texture, stripes: Texture): Material {
    const key = `${m.kind}:${m.surface}:${m.tint ?? ''}:${m.effect ?? ''}`;
    let mat = this.materials.get(key);
    if (!mat) {
      if (m.kind === 'wall') {
        mat = new MeshStandardMaterial({ map: stripes, roughness: 0.7, metalness: 0.0 });
      } else if (m.kind === 'deco') {
        const c = m.tint ?? 0xff4d2e;
        mat = new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: 0.9, roughness: 0.5 });
      } else if (m.effect) {
        mat = this.effectMaterial(m.effect);
      } else {
        mat = new MeshStandardMaterial({ map: grid, color: SURFACES[m.surface].color, roughness: m.surface === 'ice' ? 0.12 : 0.85, metalness: 0.05 });
      }
      this.materials.set(key, mat);
    }
    return mat;
  }

  private makeMesh(m: TrackMesh, grid: Texture, stripes: Texture): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new BufferAttribute(m.uvs, 2));
    g.setIndex(new BufferAttribute(m.indices, 1));
    g.computeBoundingSphere();
    const mesh = new Mesh(g, this.material(m, grid, stripes));
    mesh.castShadow = m.kind !== 'road';
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Hide the meshes of broken fragile blocks; pass an empty set to restore everything. */
  setBroken(ids: ReadonlySet<number>): void {
    for (const [id, mesh] of this.fragile) mesh.visible = !ids.has(id);
  }

  /** Animate boost pads (scrolling chevrons, pulsing glow). */
  update(timeSeconds: number): void {
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
    for (const t of this.textures) t.dispose();
  }
}
