import * as THREE from 'three';

/**
 * Pooled sparkle bursts (one draw call for all of them): little twinkling stars that pop out
 * when Whiskers collects something, swims through a ring, opens a chest or makes a friend.
 */
const MAX = 400;

export class Sparkles {
  public points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private next = 0;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private _c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        uniform float uScale;
        varying vec3 vColor;
        varying float vLife;
        void main() {
          vColor = color;
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aLife > 0.0 ? aSize * uScale / -mv.z * (0.4 + aLife * 0.6) : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vLife;
        void main() {
          if (vLife <= 0.0) discard;
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p);
          // Four-pointed twinkle: bright core plus thin cross rays.
          float core = smoothstep(0.22, 0.0, r);
          float rays = smoothstep(0.06, 0.0, abs(p.x)) * smoothstep(0.5, 0.0, abs(p.y))
                     + smoothstep(0.06, 0.0, abs(p.y)) * smoothstep(0.5, 0.0, abs(p.x));
          float a = clamp(core + rays * 0.8, 0.0, 1.0) * min(1.0, vLife * 2.0);
          gl_FragColor = vec4(vColor * a, a);
        }
      `,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  /** Pop `count` sparkles out from `at` in the given colors. */
  public burst(at: THREE.Vector3, colors: THREE.ColorRepresentation[], count = 14, speed = 2.6, upward = 0.8) {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      this.vel[i * 3] = Math.sin(phi) * Math.cos(theta) * sp;
      this.vel[i * 3 + 1] = Math.cos(phi) * sp + upward;
      this.vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * sp;
      this._c.set(colors[n % colors.length]);
      this.col[i * 3] = this._c.r;
      this.col[i * 3 + 1] = this._c.g;
      this.col[i * 3 + 2] = this._c.b;
      this.maxLife[i] = 0.6 + Math.random() * 0.5;
      this.life[i] = 1;
      this.size[i] = 0.35 + Math.random() * 0.35;
    }
  }

  public update(dt: number, viewportHeight: number) {
    this.mat.uniforms.uScale.value = viewportHeight * 0.5;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt / this.maxLife[i];
      if (this.life[i] < 0) this.life[i] = 0;
      // Drag so bursts puff out then hang and fade.
      const drag = Math.exp(-dt * 3.2);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + dt * 0.4;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aLife as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.points.parent?.remove(this.points);
  }
}
