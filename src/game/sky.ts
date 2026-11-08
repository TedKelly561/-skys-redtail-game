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
  };
  private clouds: THREE.Mesh;
  private rainbow: THREE.Mesh;
  private rainbowMat: THREE.ShaderMaterial;
  private rainbowTarget = 0;
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
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          float s = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.9, 0.65) * (pow(s, 6.0) * 0.18 + pow(s, 60.0) * 0.35);
          col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9985, 0.9992, s));
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
    const cloudMat = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#dcecff',
      emissiveIntensity: 0.55,
      fog: false,
      depthWrite: false,
    });
    this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
    this.clouds.renderOrder = -1;
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
    this.disposables.push(cloudGeo, cloudMat);

    // Rainbow arching over the Grand Lake (shown once Whiskers reaches the lake).
    const inner = 70;
    const outer = 82;
    const rainbowGeo = new THREE.RingGeometry(inner, outer, 96, 1, 0, Math.PI);
    this.rainbowMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer } },
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uInner;
        uniform float uOuter;
        varying vec2 vPos;
        void main() {
          float t = clamp((length(vPos) - uInner) / (uOuter - uInner), 0.0, 1.0);
          // Violet (inside) to red (outside).
          vec3 c = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) - t * 0.83 + 0.83));
          float edge = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);
          float ground = smoothstep(-2.0, 12.0, vPos.y);
          gl_FragColor = vec4(c, edge * ground * uOpacity * 0.55);
          #include <colorspace_fragment>
        }
      `,
    });
    this.rainbow = new THREE.Mesh(rainbowGeo, this.rainbowMat);
    this.rainbow.position.set(0, -14, -165);
    this.rainbow.renderOrder = -1;
    this.rainbow.frustumCulled = false;
    this.rainbow.visible = false;
    this.group.add(this.rainbow);
    this.disposables.push(rainbowGeo, this.rainbowMat);

    scene.add(this.group);
  }

  /** Fade the lake rainbow in or out. */
  public setRainbow(on: boolean, instant = false) {
    this.rainbowTarget = on ? 1 : 0;
    if (instant) this.rainbowMat.uniforms.uOpacity.value = this.rainbowTarget;
  }

  /** Horizon matches the chapter's fog color; the top of the sky is a deeper blue. */
  public setColors(horizon: THREE.ColorRepresentation) {
    this.uniforms.uHorizon.value.set(horizon);
    this.uniforms.uZenith.value.set(horizon).lerp(new THREE.Color('#2f8fdc'), 0.7);
  }

  public get zenithColor() {
    return this.uniforms.uZenith.value;
  }

  public update(dt: number, cameraPos: THREE.Vector3) {
    this.group.position.copy(cameraPos);
    this.clouds.rotation.y += dt * 0.004;
    const u = this.rainbowMat.uniforms.uOpacity;
    u.value = THREE.MathUtils.damp(u.value, this.rainbowTarget, 0.8, dt);
    this.rainbow.visible = u.value > 0.01;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
