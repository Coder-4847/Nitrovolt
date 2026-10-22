import {
  BufferAttribute, BufferGeometry, Color, Group, Material, Mesh, MeshStandardMaterial, Texture,
} from 'three';
import { SURFACES } from '../physics/Surface';
import { TrackData, TrackMesh } from '../tracks/TrackTypes';
import { makeGridTexture, makeStripeTexture } from './Textures';

/** Builds renderable meshes from the same TrackMesh data the colliders use (single source of truth). */
export class TrackView {
  readonly group = new Group();
  private readonly materials = new Map<string, Material>();
  private readonly textures: Texture[] = [];

  constructor(track: TrackData) {
    const grid = makeGridTexture();
    const stripes = makeStripeTexture();
    this.textures.push(grid, stripes);
    for (const m of track.meshes) this.group.add(this.makeMesh(m, grid, stripes));
  }

  private material(m: TrackMesh, grid: Texture, stripes: Texture): Material {
    const key = `${m.kind}:${m.surface}`;
    let mat = this.materials.get(key);
    if (!mat) {
      if (m.kind === 'wall') {
        mat = new MeshStandardMaterial({ map: stripes, roughness: 0.7, metalness: 0.0 });
      } else if (m.kind === 'deco') {
        mat = new MeshStandardMaterial({ color: 0xff4d2e, emissive: new Color(0xff3a14), emissiveIntensity: 0.9, roughness: 0.5 });
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

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
