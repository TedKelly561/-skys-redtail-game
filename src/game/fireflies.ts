import * as THREE from 'three';

/**
 * Night-time fireflies: soft blinking yellow-green lights drifting over the water around
 * Whiskers. One draw call; they quietly respawn ahead as he swims.
 */
const COUNT = 140;
const RADIUS = 26;

export class Fireflies {
  public points: THREE.Points;
  private pos = new Float32Array(COUNT * 3);
  private phase = new Float32Array(COUNT);
  private drift = new Float32Array(COUNT * 3);
  private mat: THREE.ShaderMaterial;
  private opacity = 0;
  private target = 0;
  private seeded = false;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(this.phase, 1));
    for (let i = 0; i < COUNT; i++) {
      this.phase[i] = Math.random() * 100;
      this.drift[i * 3] = (Math.random() - 0.5) * 0.6;
      this.drift[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      this.drift[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        uniform float uScale;
        varying float vGlow;
        void main() {
          // Each firefly blinks slowly on and off on its own rhythm.
          float b = sin(uTime * (0.9 + fract(aPhase) * 0.8) + aPhase);
          vGlow = pow(max(b, 0.0), 2.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (0.35 + vGlow * 0.25) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vGlow;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r);
          a = a * a * (0.15 + vGlow * 0.85) * uOpacity;
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.35) * a, a);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
    scene.add(this.points);
  }

  public setVisible(on: boolean) {
    this.target = on ? 1 : 0;
  }

  private respawn(i: number, center: THREE.Vector3, ahead: boolean) {
    const a = Math.random() * Math.PI * 2;
    const r = ahead ? RADIUS * (0.6 + Math.random() * 0.4) : Math.random() * RADIUS;
    this.pos[i * 3] = center.x + Math.cos(a) * r;
    this.pos[i * 3 + 1] = 0.25 + Math.random() * 3.2;
    this.pos[i * 3 + 2] = center.z + Math.sin(a) * r;
  }

  public update(dt: number, center: THREE.Vector3, pointScale: number) {
    this.opacity = THREE.MathUtils.damp(this.opacity, this.target, 2, dt);
    this.points.visible = this.opacity > 0.01;
    if (!this.points.visible) return;
    if (!this.seeded) {
      for (let i = 0; i < COUNT; i++) this.respawn(i, center, false);
      this.seeded = true;
    }
    const t = (this.mat.uniforms.uTime.value += dt);
    this.mat.uniforms.uOpacity.value = this.opacity;
    this.mat.uniforms.uScale.value = pointScale;
    for (let i = 0; i < COUNT; i++) {
      const k = i * 3;
      this.pos[k] += (this.drift[k] + Math.sin(t * 0.7 + this.phase[i]) * 0.3) * dt;
      this.pos[k + 1] += (this.drift[k + 1] + Math.cos(t * 0.9 + this.phase[i]) * 0.15) * dt;
      this.pos[k + 2] += (this.drift[k + 2] + Math.cos(t * 0.6 + this.phase[i] * 1.3) * 0.3) * dt;
      if (this.pos[k + 1] < 0.15) this.pos[k + 1] = 0.15;
      const dx = this.pos[k] - center.x;
      const dz = this.pos[k + 2] - center.z;
      if (dx * dx + dz * dz > RADIUS * RADIUS) this.respawn(i, center, true);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.points.parent?.remove(this.points);
  }
}
