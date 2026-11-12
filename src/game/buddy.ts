import * as THREE from 'three';

/**
 * Whiskers' baby fish buddy: a tiny fish the player names and colors. It swims along just
 * behind Whiskers everywhere (river, lake, fish house, title screen) and does a happy spin when
 * something good happens.
 */
export interface BuddyLook {
  name: string;
  color: string;
}

export const BUDDY_COLORS: { color: string; label: string }[] = [
  { color: '#ff8c3a', label: 'Orange' },
  { color: '#4fb7ff', label: 'Blue' },
  { color: '#ff7fbf', label: 'Pink' },
  { color: '#ffd23f', label: 'Yellow' },
  { color: '#8be36b', label: 'Green' },
  { color: '#b48cff', label: 'Purple' },
];

export const BUDDY_NAMES = ['Bubbles', 'Finn', 'Coral', 'Sunny', 'Pebble', 'Splash'];
export const MAX_BUDDY_NAME = 14;
const KEY = 'whiskers_buddy_v1';

export function loadBuddy(): BuddyLook | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw.name !== 'string' || typeof raw.color !== 'string') return null;
    const color = BUDDY_COLORS.some((c) => c.color === raw.color) ? raw.color : BUDDY_COLORS[0].color;
    return { name: cleanBuddyName(raw.name) || BUDDY_NAMES[0], color };
  } catch {
    return null;
  }
}

export function saveBuddy(look: BuddyLook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    // ignore
  }
}

export function cleanBuddyName(name: string) {
  return name
    .replace(/[^\p{L}\p{N} '\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BUDDY_NAME);
}

const _target = new THREE.Vector3();

export class BabyFish {
  public group = new THREE.Group();
  private body: THREE.Group;
  private tail: THREE.Object3D;
  private fins: THREE.Object3D[] = [];
  private bodyMat: THREE.MeshStandardMaterial;
  private finMat: THREE.MeshStandardMaterial;
  private disposables: { dispose: () => void }[] = [];
  private time = Math.random() * 10;
  private spin = 0;
  private heading = 0;
  private placed = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: '#ff8c3a', roughness: 0.4 });
    this.finMat = new THREE.MeshStandardMaterial({ color: '#ff8c3a', roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const belly = new THREE.MeshStandardMaterial({ color: '#fff4e6', roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
    const black = new THREE.MeshBasicMaterial({ color: '#111111' });
    const sphere = new THREE.SphereGeometry(1, 18, 14);
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(-0.22, 0.26, -0.34, 0.24);
    tailShape.quadraticCurveTo(-0.24, 0, -0.34, -0.24);
    tailShape.quadraticCurveTo(-0.22, -0.26, 0, 0);
    const tailGeo = new THREE.ShapeGeometry(tailShape);
    tailGeo.rotateY(-Math.PI / 2); // fan out behind the body (-Z), not forward into it
    const finGeo = new THREE.CircleGeometry(0.12, 12, 0, Math.PI);
    this.disposables.push(this.bodyMat, this.finMat, belly, white, black, sphere, tailGeo, finGeo);

    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.rotation.set(r[0], r[1], r[2]);
      return m;
    };

    // Built facing +Z, about 0.5 m long: round and cute, with big eyes.
    this.body = new THREE.Group();
    this.body.add(part(sphere, this.bodyMat, [0, 0, 0], [0.16, 0.19, 0.25]));
    this.body.add(part(sphere, belly, [0, -0.06, 0.04], [0.13, 0.12, 0.19]));
    for (const x of [0.085, -0.085]) {
      this.body.add(part(sphere, white, [x, 0.06, 0.14], [0.07, 0.08, 0.06]));
      this.body.add(part(sphere, black, [x * 1.12, 0.06, 0.18], [0.04, 0.05, 0.03]));
      this.body.add(part(sphere, white, [x * 1.15, 0.085, 0.205], [0.014, 0.014, 0.01]));
    }
    // Little smile.
    this.body.add(part(sphere, black, [0, -0.04, 0.235], [0.03, 0.01, 0.01]));
    const dorsal = part(finGeo, this.finMat, [0, 0.17, -0.02], [1, 1, 1], [0, Math.PI / 2, 0]);
    this.body.add(dorsal);
    for (const x of [0.15, -0.15]) {
      const fin = part(finGeo, this.finMat, [x, -0.04, 0.02], [0.8, 0.8, 0.8], [0, x > 0 ? 0.6 : -0.6, Math.PI / 2]);
      this.body.add(fin);
      this.fins.push(fin);
    }
    this.tail = part(tailGeo, this.finMat, [0, 0, -0.22], [1, 1, 1]);
    this.body.add(this.tail);
    this.body.scale.setScalar(1.35);
    this.group.add(this.body);
  }

  public setColor(color: string) {
    this.bodyMat.color.set(color);
    // A soft glow keeps the colour bright in murky water.
    this.bodyMat.emissive.set(color).multiplyScalar(0.3);
    this.finMat.color.set(color).offsetHSL(0, 0.05, 0.08);
    this.finMat.emissive.set(color).multiplyScalar(0.25);
  }

  /** Pose next to Whiskers' face for a photo (returns a function that puts it back). */
  public poseForPhoto(whiskers: THREE.Object3D, camera: THREE.Vector3): () => void {
    const g = this.group;
    const pos = g.position.clone();
    const rotY = g.rotation.y;
    const h = whiskers.rotation.y;
    g.position.set(
      whiskers.position.x + Math.sin(h) * 0.75 - Math.cos(h) * 0.7,
      whiskers.position.y + 0.45,
      whiskers.position.z + Math.cos(h) * 0.75 + Math.sin(h) * 0.7
    );
    g.rotation.y = Math.atan2(camera.x - g.position.x, camera.z - g.position.z);
    g.updateMatrixWorld(true);
    return () => {
      g.position.copy(pos);
      g.rotation.y = rotY;
    };
  }

  /** A happy little loop-the-loop. */
  public celebrate() {
    this.spin = 1;
  }

  /** Follow Whiskers: a little behind and to the side, bobbing along. */
  public update(dt: number, whiskers: THREE.Object3D) {
    this.time += dt;
    const h = whiskers.rotation.y;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const side = 0.85 + Math.sin(this.time * 0.7) * 0.2;
    const back = 0.5 + Math.sin(this.time * 0.9) * 0.2;
    _target.set(
      whiskers.position.x + Math.cos(h) * side - fx * back,
      whiskers.position.y + 0.45 + Math.sin(this.time * 1.7) * 0.12,
      whiskers.position.z - Math.sin(h) * side - fz * back
    );
    const g = this.group;
    if (!this.placed || g.position.distanceToSquared(_target) > 400) {
      g.position.copy(_target);
      this.placed = true;
    }
    const prevX = g.position.x;
    const prevZ = g.position.z;
    g.position.lerp(_target, Math.min(1, dt * 7));
    const vx = g.position.x - prevX;
    const vz = g.position.z - prevZ;
    const want = vx * vx + vz * vz > 1e-6 ? Math.atan2(vx, vz) : h;
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += diff * Math.min(1, dt * 6);
    g.rotation.y = this.heading;

    // Wiggle, and a spin when celebrating.
    this.tail.rotation.y = Math.sin(this.time * 14) * 0.5;
    this.fins.forEach((f, k) => (f.rotation.x = Math.sin(this.time * 10 + k * Math.PI) * 0.5));
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 1.4);
      this.body.rotation.x = -(1 - this.spin) * Math.PI * 2;
      this.body.position.y = Math.sin((1 - this.spin) * Math.PI) * 0.5;
    } else {
      this.body.rotation.x = 0;
      this.body.position.y = 0;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
