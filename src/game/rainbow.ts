import * as THREE from 'three';
import { getRiverPath } from './worldGen';

/**
 * A real rainbow standing in the Grand Lake that Whiskers can swim under. Underneath it floats
 * the Rainbow Pearl; swimming under the arch collects it (once per swim).
 */
export const RAINBOW_DISTANCE = 2600;
const INNER = 24;
const OUTER = 30;

export class RainbowGoal {
  public group = new THREE.Group();
  public pearl: THREE.Mesh;
  private arch: THREE.Mesh;
  private archMat: THREE.ShaderMaterial;
  private pearlMat: THREE.ShaderMaterial;
  private glow: THREE.Mesh;
  private time = { value: 0 };
  private reached = false;
  private fade = 0;
  private fadeTarget = 0;

  constructor(scene: THREE.Scene) {
    const { position, tangent } = getRiverPath(RAINBOW_DISTANCE);
    this.group.position.set(position.x, 0, position.z);
    this.group.rotation.y = Math.atan2(tangent.x, tangent.z);

    const archGeo = new THREE.RingGeometry(INNER, OUTER, 128, 1, 0, Math.PI);
    this.archMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uTime: this.time },
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
        uniform float uTime;
        varying vec2 vPos;
        void main() {
          float t = clamp((length(vPos) - ${INNER.toFixed(1)}) / ${(OUTER - INNER).toFixed(1)}, 0.0, 1.0);
          vec3 c = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) - t * 0.83 + 0.83));
          float edge = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.9, t);
          float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 + atan(vPos.y, vPos.x) * 12.0);
          float foot = smoothstep(-1.0, 4.0, vPos.y);
          gl_FragColor = vec4(c * shimmer, edge * foot * uOpacity * 0.7);
          #include <colorspace_fragment>
        }
      `,
    });
    this.arch = new THREE.Mesh(archGeo, this.archMat);
    this.arch.position.y = -1;
    this.arch.renderOrder = 3;
    this.arch.frustumCulled = false;
    this.group.add(this.arch);

    // The Rainbow Pearl: a glowing, color-shifting pearl under the middle of the arch.
    this.pearlMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.0);
          float h = f * 1.5 + uTime * 0.25 + vN.y * 0.4;
          vec3 c = 0.55 + 0.45 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + h));
          c = mix(vec3(1.0), c, 0.55 + f * 0.45);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.pearl = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24), this.pearlMat);
    this.pearl.position.set(0, -1.6, 0);
    this.group.add(this.pearl);

    const glowMat = new THREE.MeshBasicMaterial({
      color: '#fff6c8',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), glowMat);
    this.glow.position.copy(this.pearl.position);
    this.group.add(this.glow);

    this.group.visible = false;
    scene.add(this.group);
  }

  /** Show the rainbow while Whiskers is in the Grand Lake. */
  public setVisible(on: boolean, instant = false) {
    this.fadeTarget = on ? 1 : 0;
    if (instant) this.fade = this.fadeTarget;
  }

  /** True once, the moment Whiskers swims under the arch (from either side). */
  public checkReached(prevDist: number, dist: number, lateral: number): boolean {
    if (this.reached) return false;
    const crossed =
      (prevDist < RAINBOW_DISTANCE && dist >= RAINBOW_DISTANCE) ||
      (prevDist > RAINBOW_DISTANCE && dist <= RAINBOW_DISTANCE);
    if (crossed && Math.abs(lateral) < INNER) {
      this.reached = true;
      this.pearl.visible = false;
      this.glow.visible = false;
      return true;
    }
    return false;
  }

  public get pearlWorldPosition() {
    return this.pearl.getWorldPosition(new THREE.Vector3());
  }

  public reset() {
    this.reached = false;
    this.pearl.visible = true;
    this.glow.visible = true;
  }

  public update(dt: number) {
    this.time.value += dt;
    this.fade = THREE.MathUtils.damp(this.fade, this.fadeTarget, 0.9, dt);
    this.archMat.uniforms.uOpacity.value = this.fade;
    this.group.visible = this.fade > 0.01;
    this.pearl.position.y = -1.6 + Math.sin(this.time.value * 1.5) * 0.2;
    this.pearl.rotation.y += dt * 0.8;
    this.glow.position.y = this.pearl.position.y;
    this.glow.scale.setScalar(1 + Math.sin(this.time.value * 3) * 0.08);
  }

  public dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    this.group.parent?.remove(this.group);
  }
}
