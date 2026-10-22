import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Procedural gradient sky dome with a sun glow. Follows the camera. */
export class Sky {
  readonly mesh: Mesh;
  readonly sunDir = new Vector3(0.45, 0.6, 0.35).normalize();
  readonly horizon = new Color(0xffc9a0);
  readonly zenith = new Color(0x2f5fb0);

  constructor() {
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: this.horizon },
        uZenith: { value: this.zenith },
        uSun: { value: this.sunDir },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w; // always at the far plane
        }`,
      fragmentShader: `
        uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uSun;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          float t = pow(max(h, 0.0), 0.55);
          vec3 col = mix(uHorizon, uZenith, t);
          col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.2, vDir.y));
          float s = max(dot(normalize(vDir), uSun), 0.0);
          col += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.28);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(1000, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }
}
