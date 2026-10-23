import { Camera, HalfFloatType, Scene, Vector2, WebGLRenderTarget, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ThemeDef } from './env/Theme';

/** Final grade in linear HDR: vignette, a speed / boost colour split toward the edges, faint film grain. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uSplit: { value: 0 },
    uTime: { value: 0 },
    uGrain: { value: 0.025 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette, uSplit, uTime, uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uSplit * r2 * 0.09;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c *= 1.0 - uVignette * smoothstep(0.08, 0.62, r2 * 1.6);
      c += (h(vUv * 913.0) - 0.5) * uGrain * (0.4 + c);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/** EffectComposer chain: scene (MSAA, half-float) -> bloom -> grade -> tone mapping + sRGB output. */
export class PostFx {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private time = 0;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, msaa: number, bloom: boolean) {
    const size = renderer.getDrawingBufferSize(new Vector2());
    const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: msaa });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new Vector2(size.x / 2, size.y / 2), 0.5, 0.5, 0.85);
    this.bloom.enabled = bloom;
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  applyTheme(t: ThemeDef): void {
    this.bloom.strength = t.bloom.strength;
    this.bloom.radius = t.bloom.radius;
    this.bloom.threshold = t.bloom.threshold;
    this.grade.uniforms.uVignette!.value = t.night ? 0.42 : 0.3;
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  /** `speed01` and `boost` drive the colour split; `reduced` (reduced motion) turns it off. */
  render(camera: Camera, dt: number, speed01: number, boost: number, reduced: boolean): void {
    this.time = (this.time + dt) % 100;
    this.renderPass.camera = camera;
    this.grade.uniforms.uTime!.value = this.time;
    this.grade.uniforms.uSplit!.value = reduced ? 0 : Math.min(1.4, speed01 * 0.35 + boost * 1.1);
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
    this.bloom.dispose();
  }
}
