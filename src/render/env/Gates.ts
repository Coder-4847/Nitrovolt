import { Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { TrackTrigger } from '../../tracks/TrackTypes';
import { ThemeDef } from './Theme';

/**
 * Timing gates across every checkpoint and finish line: a thin light line on the road, a faint glass
 * panel between the gantry posts and, on the finish, a chequered banner under the crossbar. Crossing
 * brightens the gate briefly. The panel fades out as the camera comes close, so driving through never
 * tints the whole screen.
 */
export class Gates {
  readonly group = new Group();
  private readonly items: Array<{ trig: TrackTrigger; mat: ShaderMaterial }> = [];
  private readonly geo = new PlaneGeometry(1, 1).translate(0, 0.5, 0);

  constructor(triggers: readonly TrackTrigger[], theme: ThemeDef) {
    for (const t of triggers) {
      const finish = t.kind === 'finish';
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: true,
        uniforms: {
          uCol: { value: new Color(finish ? theme.gate.finish : theme.gate.checkpoint) },
          uFlash: { value: 0 },
          uFinish: { value: finish ? 1 : 0 },
          uAspect: { value: 1 },
          uHeight: { value: 7.4 },
          fogColor: { value: new Color(theme.fog.color) },
          fogNear: { value: theme.fog.near },
          fogFar: { value: theme.fog.far },
        },
        vertexShader: `
          varying vec2 vUv; varying float vDepth;
          #include <fog_pars_vertex>
          void main() {
            vUv = uv;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mvPosition.z;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform vec3 uCol; uniform float uFlash, uFinish, uAspect, uHeight;
          varying vec2 vUv; varying float vDepth;
          #include <fog_pars_fragment>
          void main() {
            float y = vUv.y * uHeight;
            float near = smoothstep(2.0, 9.0, vDepth);
            float wy = max(fwidth(y), 1e-3);
            float line = 1.0 - smoothstep(0.12, 0.12 + wy, y);
            float glass = (0.05 + 0.18 * uFlash) * (1.0 - smoothstep(0.0, 1.0, vUv.y)) * near;
            vec3 col = mix(uCol, vec3(1.0), 0.35 + 0.4 * uFlash);
            float a = max(line * (0.8 + 0.2 * uFlash), glass);
            if (uFinish > 0.5 && vUv.y > 0.86) {
              vec2 c = floor(vec2(vUv.x * uAspect * 2.0, (vUv.y - 0.86) * 30.0));
              col = mix(vec3(0.08), vec3(0.96), mod(c.x + c.y, 2.0));
              a = 0.95;
            }
            gl_FragColor = vec4(col, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      });
      const w = (t.halfWidth - 3) * 2 + 1.4;
      const h = 7.4;
      mat.uniforms.uAspect!.value = w / h;
      const mesh = new Mesh(this.geo, mat);
      mesh.position.copy(t.position);
      mesh.quaternion.copy(t.quaternion);
      mesh.scale.set(w, h, 1);
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.items.push({ trig: t, mat });
    }
  }

  /** Flash the gate for a checkpoint index, or the finish line. */
  flash(kind: 'checkpoint' | 'finish', index = 0): void {
    for (const it of this.items) if (it.trig.kind === kind && (kind === 'finish' || it.trig.index === index)) it.mat.uniforms.uFlash!.value = 1;
  }

  update(_time: number, dt: number): void {
    for (const it of this.items) {
      it.mat.uniforms.uFlash!.value = Math.max(0, (it.mat.uniforms.uFlash!.value as number) - dt * 2.2);
    }
  }

  reset(): void {
    for (const it of this.items) it.mat.uniforms.uFlash!.value = 0;
  }

  dispose(): void {
    this.geo.dispose();
    for (const it of this.items) it.mat.dispose();
  }
}
