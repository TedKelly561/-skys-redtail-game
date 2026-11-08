import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Sky: a gradient dome (horizon matches the fog so the world fades in softly), a warm sun
 * glow, and puffy cartoon clouds that drift slowly. It follows the camera so it's always
 * "infinitely" far away. Three draw calls in total.
 */
export class Sky {
  public group = new THREE.Group();
  private uniforms = {
    uHorizon: { value: new THREE.Color('#a3e2f0') },
    uZenith: { value: new THREE.Color('#4aa8e8') },
    uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.3).normalize() },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  private nightTarget = 0;
  private cloudMat: THREE.MeshLambertMaterial;
  private clouds: THREE.Mesh;
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene, sunDir: THREE.Vector3) {
    this.uniforms.uSunDir.value.copy(sunDir).normalize();
    const domeGeo = new THREE.SphereGeometry(190, 32, 16);
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      // No tone mapping, so the horizon exactly matches the fog/background color.
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        uniform float uNight;
        uniform float uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));

          // Daytime sun glow.
          float s = max(dot(d, uSunDir), 0.0);
          vec3 day = vec3(1.0, 0.9, 0.65) * (pow(s, 6.0) * 0.18 + pow(s, 60.0) * 0.35);
          col += day * (1.0 - uNight);
          col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9985, 0.9992, s) * (1.0 - uNight));

          // Night: pink sunset glow low down the river, a moon, and twinkling stars.
          vec3 sunsetDir = normalize(vec3(0.0, 0.02, -1.0));
          float ss = max(dot(d, sunsetDir), 0.0);
          float band = exp(-abs(d.y) * 7.0);
          col += uNight * (vec3(1.0, 0.45, 0.55) * pow(ss, 3.0) * band * 0.9 + vec3(1.0, 0.7, 0.4) * pow(ss, 40.0) * 0.6);

          vec3 moonDir = normalize(vec3(0.45, 0.42, -0.78));
          float m = max(dot(d, moonDir), 0.0);
          col += uNight * (vec3(0.75, 0.8, 1.0) * pow(m, 80.0) * 0.5 + vec3(1.0, 0.98, 0.9) * smoothstep(0.9988, 0.9993, m));

          vec2 suv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 70.0;
          vec2 cell = floor(suv);
          float rnd = hash(cell);
          vec2 f = fract(suv) - 0.5 - (vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5) * 0.6;
          float star = step(0.965, rnd) * (1.0 - smoothstep(0.0, 0.16, length(f)));
          float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 3.0) + rnd * 40.0);
          col += uNight * vec3(1.0, 0.97, 0.9) * star * twinkle * smoothstep(0.08, 0.35, d.y) * (1.0 - m * m);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.renderOrder = -2;
    dome.frustumCulled = false;
    this.group.add(dome);
    this.disposables.push(domeGeo, domeMat);

    // Puffy clouds: clusters of soft blobs with flat-ish bottoms, merged into one mesh.
    const blob = new THREE.IcosahedronGeometry(1, 1);
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 140 + Math.random() * 30;
      const cx = Math.cos(a) * dist;
      const cz = Math.sin(a) * dist;
      const cy = 30 + Math.random() * 28;
      const size = 7 + Math.random() * 6;
      const puffs = 5 + Math.floor(Math.random() * 4);
      for (let k = 0; k < puffs; k++) {
        const r = size * (0.55 + Math.random() * 0.45) * (k === 0 ? 1.25 : 1);
        const ox = (k - puffs / 2) * size * 0.55 + (Math.random() - 0.5) * size * 0.4;
        const oy = Math.random() * size * 0.35;
        // Cloud's long axis runs around the sky circle.
        const tx = -Math.sin(a);
        const tz = Math.cos(a);
        m.makeScale(r, r * 0.72, r).setPosition(cx + tx * ox, cy + oy, cz + tz * ox);
        const g = blob.clone().applyMatrix4(m);
        parts.push(g);
      }
    }
    const cloudGeo = mergeGeometries(parts, false)!;
    parts.forEach((g) => g.dispose());
    blob.dispose();
    const cloudMat = (this.cloudMat = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#dcecff',
      emissiveIntensity: 0.55,
      fog: false,
      depthWrite: false,
    }));
    this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
    this.clouds.renderOrder = -1;
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
    this.disposables.push(cloudGeo, cloudMat);

    scene.add(this.group);
  }


  /** Horizon matches the fog color; the top of the sky is a deeper blue (navy at night). */
  public setColors(horizon: THREE.ColorRepresentation, night = false) {
    this.uniforms.uHorizon.value.set(horizon);
    this.uniforms.uZenith.value.set(horizon).lerp(new THREE.Color(night ? '#0f1438' : '#2f8fdc'), night ? 0.85 : 0.7);
    this.nightTarget = night ? 1 : 0;
    this.cloudMat.color.set(night ? '#9b8fc4' : '#ffffff');
    this.cloudMat.emissive.set(night ? '#5a4a8a' : '#dcecff');
  }

  public get zenithColor() {
    return this.uniforms.uZenith.value;
  }

  public update(dt: number, cameraPos: THREE.Vector3) {
    this.group.position.copy(cameraPos);
    this.clouds.rotation.y += dt * 0.004;
    this.uniforms.uTime.value += dt;
    this.uniforms.uNight.value = THREE.MathUtils.damp(this.uniforms.uNight.value, this.nightTarget, 3, dt);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
