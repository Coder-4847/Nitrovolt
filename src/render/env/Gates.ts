import { AdditiveBlending, Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { TrackTrigger } from '../../tracks/TrackTypes';
import { ThemeDef } from './Theme';

/**
 * Holographic curtains across every checkpoint and finish line: a soft gradient with scrolling scan lines,
 * a chequered band on the finish, and a bright flash when the car crosses.
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
        blending: AdditiveBlending,
        fog: true,
        uniforms: {
          uCol: { value: new Color(finish ? theme.gate.finish : theme.gate.checkpoint) },
          uTime: { value: 0 },
          uFlash: { value: 0 },
          uFinish: { value: finish ? 1 : 0 },
          uAspect: { value: 1 },
          fogColor: { value: new Color(theme.fog.color) },
          fogNear: { value: theme.fog.near },
          fogFar: { value: theme.fog.far },
        },
        vertexShader: `
          varying vec2 vUv;
          #include <fog_pars_vertex>
          void main() {
            vUv = uv;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform vec3 uCol; uniform float uTime, uFlash, uFinish, uAspect;
          varying vec2 vUv;
          #include <fog_pars_fragment>
          void main() {
            float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
            float rise = pow(1.0 - vUv.y, 1.6);
            float scan = 0.55 + 0.45 * sin(vUv.y * 80.0 - uTime * 6.0);
            float side = smoothstep(0.035, 0.0, min(vUv.x, 1.0 - vUv.x));
            float a = (rise * 0.16 * scan + side * 0.5) * edge + uFlash * 0.55 * edge;
            vec3 col = uCol;
            if (uFinish > 0.5 && vUv.y > 0.82) {
              vec2 c = floor(vec2(vUv.x * uAspect * 2.0, vUv.y * 22.0));
              float chk = mod(c.x + c.y, 2.0);
              col = mix(vec3(0.05), vec3(1.0), chk);
              a = 0.55 * edge + uFlash * 0.3;
            }
            gl_FragColor = vec4(col * a * 1.6, 1.0);
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

  update(time: number, dt: number): void {
    for (const it of this.items) {
      it.mat.uniforms.uTime!.value = time;
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
