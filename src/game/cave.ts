import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';
import { FriendSpot } from './friends';
import { mergeStaticMeshes } from './perf';

/**
 * The glowing cave under the Grand Lake (Skylar's pick). Dive to the glowing ring on the lake
 * floor to swim in. Inside:
 * - sparkly crystals that light up the cave as Whiskers finds them,
 * - glowing friends for the sticker book (lantern fish, glow jellies),
 * - Grandpa Turtle, who gives Whiskers a ride around the cave,
 * - a hidden treasure chest with the Crystal Crown.
 * The cave is built far away from the river (inside a closed rock dome), so nothing else shows.
 */
export const CAVE_ENTRANCE_DIST = 2610;
export const CAVE_ENTRANCE_LATERAL = 10;
const ORIGIN = new THREE.Vector3(3000, -60, 3000);
/** Swimmable space: an ellipsoid with these half sizes (meters). */
const R = 26;
const H = 10;
const CRYSTAL_COLORS = ['#5ef2ff', '#ff7ad9', '#b48cff', '#ffd76a', '#7dffb2'];

export type CaveEvent =
  | { type: 'crystal'; found: number; total: number; at: THREE.Vector3 }
  | { type: 'allCrystals' }
  | { type: 'rideStart' }
  | { type: 'rideEnd' }
  | { type: 'chest'; at: THREE.Vector3 }
  | { type: 'exit' };

interface Crystal {
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  found: boolean;
  phase: number;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class LakeCave {
  /** The cave itself (only shown while Whiskers is inside). */
  public group = new THREE.Group();
  /** The glowing way in, on the lake floor. */
  public entrance = new THREE.Group();
  public entrancePos = new THREE.Vector3();
  public friendSpots: FriendSpot[] = [];
  public riding = false;
  private crystals: Crystal[] = [];
  private lanternSchool = new THREE.Group();
  private lanternFish: { body: THREE.Object3D; phase: number; r: number; y: number }[] = [];
  private jellies: { group: THREE.Group; base: THREE.Vector3; phase: number }[] = [];
  private turtle = new THREE.Group();
  private flippers: THREE.Object3D[] = [];
  private turtleAngle = 0;
  private rideTime = 0;
  private rideCooldown = 0;
  private chestLid = new THREE.Group();
  private chestPos = new THREE.Vector3();
  private chestOpen = false;
  private exitRing = new THREE.Group();
  private exitPos = new THREE.Vector3();
  private shaft: THREE.Mesh;
  private entranceGlow: THREE.MeshBasicMaterial;
  private time = 0;
  private insideTime = 0;
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene) {
    this.group.position.copy(ORIGIN);
    this.group.visible = false;
    scene.add(this.group);
    this.buildRock();
    this.buildCrystals();
    this.buildLanternFish();
    this.buildJellies();
    this.buildTurtle();
    this.buildChest();
    this.buildExit();
    const ent = this.buildEntrance();
    this.shaft = ent.shaft;
    this.entranceGlow = ent.glow;
    scene.add(this.entrance);
  }

  private track<T extends { dispose: () => void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  get total() {
    return this.crystals.length;
  }

  get found() {
    return this.crystals.filter((c) => c.found).length;
  }

  /** How bright the cave is (0 dim .. 1 all crystals found). */
  get glow() {
    return this.total ? this.found / this.total : 0;
  }

  // ------------------------------------------------------------------ building
  private buildRock() {
    const r = rng(77);
    // Closed dome around everything, rough and rocky, seen from the inside.
    const dome = new THREE.SphereGeometry(1, 56, 28);
    const pos = dome.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const floor = new THREE.Color('#3b3570');
    const wall = new THREE.Color('#232a5c');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = 1 + Math.sin(x * 7.1 + z * 3.3) * 0.05 + Math.cos(z * 6.3 - y * 4.1) * 0.05;
      // Flatter floor so there's a cave bottom to look at.
      const yy = y < -0.55 ? -0.55 - (y + 0.55) * 0.25 : y;
      pos.setXYZ(i, x * (R + 7) * n, yy * (H + 5) * n, z * (R + 7) * n);
      c.copy(wall).lerp(floor, THREE.MathUtils.clamp(-y * 1.6, 0, 1));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    dome.computeVertexNormals();
    const rock = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.BackSide, flatShading: true }));
    this.group.add(new THREE.Mesh(this.track(dome), rock));

    // Stalactites, stalagmites and glowing mushrooms.
    const spikes = new THREE.Group();
    const stone = this.track(new THREE.MeshStandardMaterial({ color: '#3a3f78', roughness: 0.9, flatShading: true }));
    const cone = this.track(new THREE.ConeGeometry(1, 1, 7));
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * (R - 4);
      const up = i % 3 !== 0;
      const len = 2 + r() * 4.5;
      const m = new THREE.Mesh(cone, stone);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const edge = Math.sqrt(Math.max(0.05, 1 - (d * d) / ((R + 7) * (R + 7))));
      const yWall = (H + 5) * edge;
      m.scale.set(0.5 + r() * 0.6, len, 0.5 + r() * 0.6);
      if (up) {
        m.rotation.x = Math.PI;
        m.position.set(x, yWall - len / 2 + 0.6, z);
      } else {
        m.position.set(x, -(H + 3) * edge * 0.6 + len / 2 - 0.4, z);
      }
      spikes.add(m);
    }
    const shroomCap = this.track(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    const stem = this.track(new THREE.CylinderGeometry(0.12, 0.16, 1, 6));
    const stemMat = this.track(new THREE.MeshStandardMaterial({ color: '#d8d2ff', roughness: 0.8 }));
    const capMats = ['#4de8ff', '#ff6fd8', '#9dff6b'].map((col) =>
      this.track(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.5 }))
    );
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2;
      const d = 5 + r() * (R - 2);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const y = this.floorY(x, z);
      const s = 0.35 + r() * 0.5;
      const st = new THREE.Mesh(stem, stemMat);
      st.scale.set(s, s * 1.4, s);
      st.position.set(x, y + s * 0.7, z);
      spikes.add(st);
      const cap = new THREE.Mesh(shroomCap, capMats[i % 3]);
      cap.scale.set(s * 0.9, s * 0.6, s * 0.9);
      cap.position.set(x, y + s * 1.4, z);
      spikes.add(cap);
    }
    mergeStaticMeshes(spikes);
    this.group.add(spikes);
  }

  /** Height of the cave floor at (x, z) in cave space. */
  private floorY(x: number, z: number) {
    const d2 = (x * x + z * z) / ((R + 7) * (R + 7));
    return -(H + 5) * 0.55 * Math.sqrt(Math.max(0, 1 - d2)) - 0.2;
  }

  private buildCrystals() {
    const r = rng(1234);
    const oct = this.track(new THREE.OctahedronGeometry(0.5, 0));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + r() * 0.3;
      const d = 9 + r() * (R - 12);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      // Some on the floor, some high on the walls.
      const high = i % 3 === 2;
      const y = high ? 3 + r() * 3 : this.floorY(x, z) + 0.3;
      const color = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
      const mat = this.track(
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })
      );
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(oct, mat);
        const tall = 1.2 + r() * 1.4;
        m.scale.set(0.5 + r() * 0.3, tall, 0.5 + r() * 0.3);
        m.position.set((r() - 0.5) * 0.8, tall * 0.4, (r() - 0.5) * 0.8);
        m.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
        g.add(m);
      }
      g.position.set(x, y, z);
      this.group.add(g);
      this.crystals.push({ group: g, mat, found: false, phase: r() * 6 });
    }
  }

  private buildLanternFish() {
    const body = this.track(new THREE.SphereGeometry(0.22, 12, 8));
    const tail = this.track(new THREE.ConeGeometry(0.14, 0.3, 6));
    const lure = this.track(new THREE.SphereGeometry(0.07, 8, 6));
    const bodyMat = this.track(new THREE.MeshStandardMaterial({ color: '#2b4a7a', emissive: '#4fd6ff', emissiveIntensity: 0.55, roughness: 0.4 }));
    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: '#fff27a' }));
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Group();
      const b = new THREE.Mesh(body, bodyMat);
      b.scale.set(0.8, 0.9, 1.5);
      f.add(b);
      const t = new THREE.Mesh(tail, bodyMat);
      t.rotation.x = Math.PI / 2;
      t.position.z = -0.42;
      f.add(t);
      const l = new THREE.Mesh(lure, glowMat);
      l.position.set(0, 0.32, 0.3);
      f.add(l);
      mergeStaticMeshes(f);
      this.lanternSchool.add(f);
      this.lanternFish.push({ body: f, phase: (i / 9) * Math.PI * 2, r: 1.2 + (i % 3) * 0.7, y: ((i % 4) - 1.5) * 0.5 });
    }
    this.lanternSchool.position.set(10, 1, -8);
    this.group.add(this.lanternSchool);
    this.friendSpots.push({ kind: 'lanternfish', object: this.lanternSchool });
  }

  private buildJellies() {
    const bell = this.track(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const tent = this.track(new THREE.CylinderGeometry(0.03, 0.01, 1.6, 4));
    const mats = ['#ff8ad8', '#9fd0ff', '#c9a2ff'].map((col) =>
      this.track(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, transparent: true, opacity: 0.75, roughness: 0.3, side: THREE.DoubleSide }))
    );
    const spots: [number, number, number][] = [[-9, 2, 6], [-12, 4, -4], [-5, 5, 12], [4, 3, 14], [-15, 1, 2]];
    spots.forEach(([x, y, z], i) => {
      const g = new THREE.Group();
      const m = mats[i % mats.length];
      g.add(new THREE.Mesh(bell, m));
      for (let k = 0; k < 6; k++) {
        const t = new THREE.Mesh(tent, m);
        const a = (k / 6) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.4, -0.8, Math.sin(a) * 0.4);
        g.add(t);
      }
      g.position.set(x, y, z);
      this.group.add(g);
      this.jellies.push({ group: g, base: new THREE.Vector3(x, y, z), phase: i * 1.3 });
    });
    this.friendSpots.push({ kind: 'jellyfish', object: this.jellies[0].group });
  }

  private buildTurtle() {
    const shellMat = this.track(new THREE.MeshStandardMaterial({ color: '#5c8a4a', roughness: 0.6 }));
    const plateMat = this.track(new THREE.MeshStandardMaterial({ color: '#8fbf5a', roughness: 0.6 }));
    const skinMat = this.track(new THREE.MeshStandardMaterial({ color: '#a8c98a', roughness: 0.7 }));
    const eyeMat = this.track(new THREE.MeshBasicMaterial({ color: '#111111' }));
    const white = this.track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
    const half = this.track(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    const ball = this.track(new THREE.SphereGeometry(1, 16, 10));
    const shell = new THREE.Mesh(half, shellMat);
    shell.scale.set(2.1, 1.1, 2.6);
    this.turtle.add(shell);
    const belly = new THREE.Mesh(ball, skinMat);
    belly.scale.set(2.0, 0.35, 2.5);
    this.turtle.add(belly);
    // Light plates on the shell.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const p = new THREE.Mesh(ball, plateMat);
      const rr = i === 0 ? 0 : 1.15;
      p.scale.set(0.55, 0.12, 0.6);
      p.position.set(Math.cos(a) * rr, i === 0 ? 1.08 : 0.85, Math.sin(a) * rr * 1.2);
      p.rotation.set(Math.sin(a) * (i === 0 ? 0 : 0.5), 0, -Math.cos(a) * (i === 0 ? 0 : 0.5));
      this.turtle.add(p);
    }
    const head = new THREE.Mesh(ball, skinMat);
    head.scale.set(0.6, 0.55, 0.75);
    head.position.set(0, 0.25, 3.0);
    this.turtle.add(head);
    for (const x of [0.3, -0.3]) {
      const e = new THREE.Mesh(ball, white);
      e.scale.setScalar(0.16);
      e.position.set(x, 0.45, 3.5);
      this.turtle.add(e);
      const p = new THREE.Mesh(ball, eyeMat);
      p.scale.setScalar(0.09);
      p.position.set(x * 1.05, 0.46, 3.62);
      this.turtle.add(p);
    }
    // A sleepy smile.
    const smile = new THREE.Mesh(ball, eyeMat);
    smile.scale.set(0.2, 0.03, 0.05);
    smile.position.set(0, 0.12, 3.7);
    this.turtle.add(smile);
    mergeStaticMeshes(this.turtle);
    for (const [x, z] of [[1.9, 1.3], [-1.9, 1.3], [1.6, -1.6], [-1.6, -1.6]] as const) {
      const f = new THREE.Mesh(ball, skinMat);
      f.scale.set(1.0, 0.12, z > 0 ? 0.55 : 0.4);
      f.position.set(x, -0.05, z);
      this.turtle.add(f);
      this.flippers.push(f);
    }
    this.turtle.scale.setScalar(1.2);
    this.group.add(this.turtle);
    this.friendSpots.push({ kind: 'seaturtle', object: this.turtle });
  }

  private buildChest() {
    // Tucked behind the rocks on the far side of the cave.
    const a = Math.PI * 1.15;
    const d = R - 3;
    this.chestPos.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    this.chestPos.y = this.floorY(this.chestPos.x, this.chestPos.z) + 0.45;
    const wood = this.track(new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.7 }));
    const gold = this.track(new THREE.MeshStandardMaterial({ color: '#ffd04a', metalness: 0.8, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.4 }));
    const box = this.track(new THREE.BoxGeometry(1.4, 0.8, 0.9));
    const band = this.track(new THREE.BoxGeometry(1.46, 0.12, 0.96));
    const lidGeo = this.track(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 12, 1, false, 0, Math.PI));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box, wood));
    const b1 = new THREE.Mesh(band, gold);
    b1.position.y = 0.2;
    g.add(b1);
    const lid = new THREE.Mesh(lidGeo, wood);
    lid.rotation.z = Math.PI / 2;
    lid.rotation.y = Math.PI / 2;
    lid.position.set(0, 0, 0.45);
    this.chestLid.add(lid);
    this.chestLid.position.set(0, 0.4, -0.45);
    g.add(this.chestLid);
    // A soft glow so it can be spotted from across the cave.
    const glowTex = this.track(glowTexture('#ffe08a'));
    const glow = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.scale.setScalar(4.5);
    glow.position.y = 0.6;
    g.add(glow);
    g.position.copy(this.chestPos);
    g.rotation.y = Math.atan2(-this.chestPos.x, -this.chestPos.z);
    this.group.add(g);
  }

  private buildExit() {
    // Where Whiskers arrives, and swims back out.
    this.exitPos.set(R - 2, 1, 0);
    const ringMat = this.track(new THREE.MeshBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.85 }));
    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.2, 0.18, 8, 32)), ringMat);
    ring.rotation.y = Math.PI / 2;
    this.exitRing.add(ring);
    const inner = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(2.1, 32)),
      this.track(new THREE.MeshBasicMaterial({ color: '#bff9ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }))
    );
    inner.rotation.y = Math.PI / 2;
    this.exitRing.add(inner);
    this.exitRing.position.copy(this.exitPos);
    this.group.add(this.exitRing);
  }

  private buildEntrance() {
    const { position, normal } = getRiverPath(CAVE_ENTRANCE_DIST);
    const bed = getRiverBedElevationAt(CAVE_ENTRANCE_DIST, CAVE_ENTRANCE_LATERAL);
    this.entrancePos.set(position.x + normal.x * CAVE_ENTRANCE_LATERAL, bed, position.z + normal.z * CAVE_ENTRANCE_LATERAL);
    this.entrance.position.copy(this.entrancePos);
    // A dark hole ringed by glowing crystals.
    const hole = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(2.2, 32)),
      this.track(new THREE.MeshBasicMaterial({ color: '#0b1030' }))
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.06;
    this.entrance.add(hole);
    const oct = this.track(new THREE.OctahedronGeometry(0.4, 0));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const col = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
      const m = new THREE.Mesh(oct, this.track(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1 })));
      m.scale.set(0.7, 1.8, 0.7);
      m.position.set(Math.cos(a) * 2.6, 0.6, Math.sin(a) * 2.6);
      m.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      this.entrance.add(m);
    }
    // A soft beam of light up to the surface so it can be found from above.
    const height = Math.max(1, -bed - 0.6);
    const fade = this.track(beamTexture());
    const glow = this.track(
      new THREE.MeshBasicMaterial({ color: '#7ff6ff', map: fade, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    const shaft = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.9, 2.2, height, 24, 1, true)), glow);
    shaft.position.y = height / 2;
    this.entrance.add(shaft);
    return { shaft, glow };
  }

  // ------------------------------------------------------------------ visits
  /** Start a visit: crystals dim again, chest closed. Returns where Whiskers appears. */
  public enter(): { pos: THREE.Vector3; heading: number } {
    this.group.visible = true;
    this.insideTime = 0;
    this.riding = false;
    // Grandpa Turtle starts across the cave, so arriving doesn't hop straight onto him.
    this.rideCooldown = 6;
    this.turtleAngle = Math.PI;
    this.chestOpen = false;
    this.chestLid.rotation.x = 0;
    for (const c of this.crystals) {
      c.found = false;
      c.mat.emissiveIntensity = 0.25;
    }
    const pos = this.toWorld(this.exitPos.clone().add(new THREE.Vector3(-3.5, 0, 0)));
    return { pos, heading: -Math.PI / 2 };
  }

  public leave() {
    this.group.visible = false;
    this.riding = false;
  }

  /** Back in the lake, just above the entrance, swimming away from it. */
  public lakePose(): { pos: THREE.Vector3; heading: number } {
    const { tangent } = getRiverPath(CAVE_ENTRANCE_DIST);
    const heading = Math.atan2(tangent.x, tangent.z);
    const pos = this.entrancePos.clone();
    pos.x += tangent.x * 4;
    pos.z += tangent.z * 4;
    pos.y = Math.min(-1.2, this.entrancePos.y + 2.6);
    return { pos, heading };
  }

  /** Whiskers is near the entrance and down near the lake floor. */
  public atEntrance(p: THREE.Vector3) {
    const dx = p.x - this.entrancePos.x;
    const dz = p.z - this.entrancePos.z;
    return dx * dx + dz * dz < 3.4 * 3.4 && p.y < this.entrancePos.y + 2.4;
  }

  public toWorld(local: THREE.Vector3) {
    return local.add(ORIGIN);
  }

  /** Keep a point inside the swimmable space; returns true if it had to be pulled in. */
  public keepInside(p: THREE.Vector3, margin = 1.5) {
    const lx = p.x - ORIGIN.x;
    const ly = p.y - ORIGIN.y;
    const lz = p.z - ORIGIN.z;
    let changed = false;
    const floor = this.floorY(lx, lz) + 0.6;
    let y = ly;
    if (y < floor) {
      y = floor;
      changed = true;
    }
    const e = (lx * lx + lz * lz) / ((R - margin) * (R - margin)) + (y * y) / ((H - margin * 0.3) * (H - margin * 0.3));
    let x = lx;
    let z = lz;
    if (e > 1) {
      const k = 1 / Math.sqrt(e);
      x *= k;
      z *= k;
      y = Math.max(floor, y * k);
      changed = true;
    }
    p.set(x + ORIGIN.x, y + ORIGIN.y, z + ORIGIN.z);
    return changed;
  }

  /** The heading that points from `p` back toward the middle of the cave. */
  public headingToCenter(p: THREE.Vector3) {
    return Math.atan2(ORIGIN.x - p.x, ORIGIN.z - p.z);
  }

  /** Where Whiskers sits while riding, and which way the turtle faces. */
  public seat(out: THREE.Vector3): number {
    this.turtle.updateMatrixWorld(true);
    this.turtle.localToWorld(out.set(0, 1.55, 0.2));
    return this.turtle.rotation.y;
  }

  public update(dt: number, player: THREE.Vector3, inside: boolean): CaveEvent[] {
    const events: CaveEvent[] = [];
    this.time += dt;
    // The entrance beam gently pulses.
    this.entranceGlow.opacity = 0.42 + Math.sin(this.time * 1.6) * 0.12;
    this.shaft.rotation.y += dt * 0.2;
    if (!inside) return events;
    this.insideTime += dt;

    // Crystals: twinkle, and light up when Whiskers swims close.
    for (const c of this.crystals) {
      const target = c.found ? 1.6 + Math.sin(this.time * 2 + c.phase) * 0.25 : 0.2 + Math.sin(this.time * 1.5 + c.phase) * 0.08;
      c.mat.emissiveIntensity += (target - c.mat.emissiveIntensity) * Math.min(1, dt * 3);
      if (!c.found) {
        c.group.getWorldPosition(_v);
        _v.y += 0.8;
        if (_v.distanceToSquared(player) < 3.2 * 3.2) {
          c.found = true;
          events.push({ type: 'crystal', found: this.found, total: this.total, at: _v.clone() });
          if (this.found === this.total) events.push({ type: 'allCrystals' });
        }
      }
    }

    // Lantern fish circle together; the school drifts in a slow loop.
    this.lanternSchool.position.set(Math.cos(this.time * 0.12) * 11, 1.5 + Math.sin(this.time * 0.4) * 1.2, Math.sin(this.time * 0.12) * 11);
    this.lanternSchool.rotation.y = -this.time * 0.12;
    for (const f of this.lanternFish) {
      const a = f.phase + this.time * 1.4;
      f.body.position.set(Math.cos(a) * f.r, f.y + Math.sin(a * 2) * 0.2, Math.sin(a) * f.r);
      f.body.rotation.y = -a;
    }

    // Jellies bob up and down.
    for (const j of this.jellies) {
      const s = Math.sin(this.time * 1.2 + j.phase);
      j.group.position.set(j.base.x + Math.sin(this.time * 0.3 + j.phase) * 1.2, j.base.y + s * 0.8, j.base.z);
      j.group.scale.set(1 + s * 0.08, 1 - s * 0.08, 1 + s * 0.08);
    }

    // Grandpa Turtle paddles around the cave, faster with a rider.
    this.rideCooldown = Math.max(0, this.rideCooldown - dt);
    const speed = this.riding ? 0.16 : 0.09;
    this.turtleAngle += dt * speed;
    const tr = 15;
    this.turtle.position.set(Math.cos(this.turtleAngle) * tr, -3 + Math.sin(this.time * 0.5) * (this.riding ? 2 : 0.6), Math.sin(this.turtleAngle) * tr);
    this.turtle.rotation.y = Math.atan2(-Math.sin(this.turtleAngle), Math.cos(this.turtleAngle));
    this.flippers.forEach((f, k) => (f.rotation.z = Math.sin(this.time * 2.2 + (k % 2) * Math.PI) * 0.35 * (k < 2 ? 1 : 0.6)));
    if (this.riding) {
      this.rideTime += dt;
      if (this.rideTime > 15) {
        this.riding = false;
        this.rideCooldown = 8;
        events.push({ type: 'rideEnd' });
      }
    } else if (this.rideCooldown <= 0) {
      this.seat(_w);
      if (_w.distanceToSquared(player) < 3.6 * 3.6) {
        this.riding = true;
        this.rideTime = 0;
        events.push({ type: 'rideStart' });
      }
    }

    // The treasure chest opens when Whiskers swims up to it.
    if (!this.chestOpen) {
      this.toWorld(_v.copy(this.chestPos));
      if (_v.distanceToSquared(player) < 3 * 3) {
        this.chestOpen = true;
        events.push({ type: 'chest', at: _v.clone().setY(_v.y + 1) });
      }
    } else if (this.chestLid.rotation.x > -1.9) {
      this.chestLid.rotation.x -= dt * 3;
    }

    // Swim back into the glowing ring to go home (after a moment, so arriving doesn't count).
    this.exitRing.rotation.x += dt * 0.6;
    if (this.insideTime > 4 && !this.riding) {
      this.toWorld(_v.copy(this.exitPos));
      if (_v.distanceToSquared(player) < 2.4 * 2.4) events.push({ type: 'exit' });
    }
    return events;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
    this.entrance.parent?.remove(this.entrance);
  }
}

/** Bright at the bottom, fading to nothing at the top (for the entrance light beam). */
function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
