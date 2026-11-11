import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt, worldToRiver } from './worldGen';
import { mergeStaticMeshes } from './perf';
import type { Sparkles } from './sparkles';

/**
 * Things to do while free swimming in the Grand Lake:
 * - Bubble geysers that launch Whiskers out of the water.
 * - A daily treasure dive: five pearls hidden in clams on the lake floor.
 * - An otter who plays tag.
 * - A waterfall: ride the bubble lift up, then slide down into the lake.
 */

function lakePoint(dist: number, lateral: number, out = new THREE.Vector3()) {
  const { position, normal } = getRiverPath(dist);
  return out.set(position.x + normal.x * lateral, 0, position.z + normal.z * lateral);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const DAILY_KEY = 'whiskers_lake_daily_v1';

/** Stars from repeatable lake games are limited per day, so they stay special. */
export function dailyAllowance(kind: string, max: number): boolean {
  const day = todayKey();
  let data: { day: string; counts: Record<string, number> } = { day, counts: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    if (raw && raw.day === day && raw.counts) data = raw;
  } catch {
    // ignore
  }
  const n = data.counts[kind] || 0;
  if (n >= max) return false;
  data.counts[kind] = n + 1;
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
  return true;
}

type PartFn = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r?: number[]) => THREE.Mesh;
const makePart: PartFn = (geo, mat, p, s, r = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.scale.set(s[0], s[1], s[2]);
  m.rotation.set(r[0], r[1], r[2]);
  return m;
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// ------------------------------------------------------------------ Bubble geysers
const GEYSER_SPOTS: [number, number][] = [
  [2560, -18],
  [2780, 32],
  [2905, -12],
];
const BUBBLES_PER_GEYSER = 36;

export class BubbleGeysers {
  public group = new THREE.Group();
  private geysers: { pos: THREE.Vector3; bed: number; bubbles: THREE.InstancedMesh; ring: THREE.Mesh; cooldown: number }[] = [];
  private disposables: { dispose: () => void }[] = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const rock = new THREE.MeshStandardMaterial({ color: '#8d8f86', roughness: 0.95, flatShading: true });
    const bubbleMat = new THREE.MeshStandardMaterial({ color: '#eafcff', transparent: true, opacity: 0.6, roughness: 0.05, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
    const ringGeo = new THREE.RingGeometry(1.2, 2.2, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.disposables.push(rock, bubbleMat, ringMat, rockGeo, bubbleGeo, ringGeo);

    for (const [d, lat] of GEYSER_SPOTS) {
      const pos = lakePoint(d, lat);
      const bed = getRiverBedElevationAt(d, lat);
      const g = new THREE.Group();
      g.position.copy(pos);
      const vent = new THREE.Group();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        vent.add(makePart(rockGeo, rock, [Math.cos(a) * 1.3, bed + 0.2, Math.sin(a) * 1.3], [0.55, 0.45 + (k % 3) * 0.15, 0.55], [k, k * 2, 0]));
      }
      mergeStaticMeshes(vent);
      g.add(vent);
      const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLES_PER_GEYSER);
      bubbles.frustumCulled = false;
      g.add(bubbles);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.04;
      g.add(ring);
      this.group.add(g);
      this.geysers.push({ pos, bed, bubbles, ring, cooldown: 0 });
    }
  }

  /** Returns the geyser Whiskers swam into this frame, or -1. */
  public update(dt: number, player: THREE.Vector3, canLaunch: boolean): number {
    this.time += dt;
    let hit = -1;
    this.geysers.forEach((g, gi) => {
      g.cooldown = Math.max(0, g.cooldown - dt);
      const near = Math.hypot(player.x - g.pos.x, player.z - g.pos.z);
      if (near < 120) {
        for (let k = 0; k < BUBBLES_PER_GEYSER; k++) {
          const t = (this.time * 0.45 + k / BUBBLES_PER_GEYSER) % 1;
          const a = k * 2.4;
          const r = 0.25 + t * 0.8;
          _p.set(Math.cos(a + this.time) * r, g.bed + 0.3 + t * (-g.bed - 0.2), Math.sin(a + this.time) * r);
          _s.setScalar(0.08 + ((k * 7) % 5) * 0.03 + t * 0.12);
          _m.compose(_p, _q, _s);
          g.bubbles.setMatrixAt(k, _m);
        }
        g.bubbles.instanceMatrix.needsUpdate = true;
        const pulse = 1 + Math.sin(this.time * 4 + gi) * 0.12;
        g.ring.scale.set(pulse, 1, pulse);
      }
      if (canLaunch && g.cooldown <= 0 && near < 2.4) {
        g.cooldown = 2;
        hit = gi;
      }
    });
    return hit;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}

// ------------------------------------------------------------------ Treasure dive
const DIVE_CANDIDATES: [number, number][] = [
  [2500, -6],
  [2540, 20],
  [2575, -32],
  [2620, 12],
  [2660, -14],
  [2700, 26],
  [2735, -4],
  [2770, -30],
  [2815, 14],
  [2850, -22],
  [2880, 30],
  [2930, 4],
];
const PEARLS_PER_DAY = 5;
const DIVE_KEY = 'whiskers_dive_v1';

export class TreasureDive {
  public group = new THREE.Group();
  private clams: { group: THREE.Group; lid: THREE.Object3D; pearl: THREE.Mesh; glow: THREE.Sprite; pos: THREE.Vector3; found: boolean }[] = [];
  private disposables: { dispose: () => void }[] = [];
  private day = '';
  private time = 0;
  /** Set when Whiskers is right above a pearl but not deep enough to grab it. */
  public aboveButHigh = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const shellMat = new THREE.MeshStandardMaterial({ color: '#c58ae0', roughness: 0.45 });
    const shellIn = new THREE.MeshStandardMaterial({ color: '#ffe8f6', roughness: 0.35, side: THREE.DoubleSide });
    const pearlMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff0fa', emissiveIntensity: 0.9, roughness: 0.1 });
    const half = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const ball = new THREE.SphereGeometry(1, 16, 12);
    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,240,250,0.5)');
      grd.addColorStop(1, 'rgba(255,240,250,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.disposables.push(shellMat, shellIn, pearlMat, half, ball, glowTex);

    for (let i = 0; i < PEARLS_PER_DAY; i++) {
      const group = new THREE.Group();
      const bottom = makePart(half, shellMat, [0, 0, 0], [0.75, 0.35, 0.65]);
      const lid = new THREE.Group();
      lid.position.set(0, 0.02, -0.6);
      lid.add(makePart(half, shellIn, [0, 0, 0.6], [0.75, 0.35, 0.65], [Math.PI, 0, 0]));
      lid.rotation.x = -1.0;
      const pearl = makePart(ball, pearlMat, [0, 0.12, 0], [0.24, 0.24, 0.24]);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#fff3fb', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.disposables.push(glowMat);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(2.2);
      glow.position.y = 0.2;
      group.add(bottom, lid, pearl, glow);
      this.group.add(group);
      this.clams.push({ group, lid, pearl, glow, pos: new THREE.Vector3(), found: false });
    }
    this.placeForToday();
  }

  /** Today's five spots (the same all day, different tomorrow). */
  private placeForToday() {
    this.day = todayKey();
    let seed = 0;
    for (const ch of this.day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const order = DIVE_CANDIDATES.map((_, i) => i).sort(() => rand() - 0.5);
    let found: number[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(DIVE_KEY) || 'null');
      if (raw && raw.day === this.day && Array.isArray(raw.found)) found = raw.found;
    } catch {
      // ignore
    }
    this.clams.forEach((c, i) => {
      const [d, lat] = DIVE_CANDIDATES[order[i]];
      lakePoint(d, lat, c.pos);
      c.pos.y = getRiverBedElevationAt(d, lat) + 0.15;
      c.group.position.copy(c.pos);
      c.group.rotation.y = rand() * Math.PI * 2;
      this.setFound(c, found.includes(i));
    });
  }

  private setFound(c: TreasureDive['clams'][number], found: boolean) {
    c.found = found;
    c.pearl.visible = !found;
    c.glow.visible = !found;
    c.lid.rotation.x = found ? -0.15 : -1.0;
  }

  private save() {
    try {
      localStorage.setItem(DIVE_KEY, JSON.stringify({ day: this.day, found: this.clams.map((c, i) => (c.found ? i : -1)).filter((i) => i >= 0) }));
    } catch {
      // ignore
    }
  }

  public get total() {
    return this.clams.length;
  }

  public get foundCount() {
    return this.clams.filter((c) => c.found).length;
  }

  /** Returns true when Whiskers picked up a pearl this frame. */
  public update(dt: number, player: THREE.Vector3): boolean {
    this.time += dt;
    if (todayKey() !== this.day) this.placeForToday();
    let got = false;
    this.aboveButHigh = false;
    for (const c of this.clams) {
      if (c.found) continue;
      const s = 2 + Math.sin(this.time * 3 + c.pos.x) * 0.4;
      c.glow.scale.setScalar(s);
      const d = Math.hypot(player.x - c.pos.x, player.z - c.pos.z);
      if (d < 2.3 && player.y < c.pos.y + 2.6) {
        this.setFound(c, true);
        this.save();
        got = true;
      } else if (d < 4) {
        this.aboveButHigh = true;
      }
    }
    return got;
  }

  public nearest(player: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const c of this.clams) {
      if (c.found) continue;
      const d = c.pos.distanceToSquared(player);
      if (d < bestD) {
        bestD = d;
        best = c.pos;
      }
    }
    return best;
  }

  /** Sniff: a trail of sparkles toward the nearest pearl. */
  public showDirection(player: THREE.Vector3, sparkles: Sparkles) {
    const target = this.nearest(player);
    if (!target) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dz = target.z - player.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const p = new THREE.Vector3();
    for (let k = 1; k <= 6; k++) {
      p.set(player.x + (dx / len) * k * 1.4, player.y + 0.3 + (dy / len) * k * 1.4, player.z + (dz / len) * k * 1.4);
      sparkles.burst(p, ['#ffe8f6', '#ffffff', '#c58ae0'], 3, 0.35, 0.2);
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}

// ------------------------------------------------------------------ Otter tag
export type OtterEvent = 'invite' | 'tag' | 'win' | 'bye' | null;
const OTTER_HOME: [number, number] = [2830, 4];

export class Otter {
  public group = new THREE.Group();
  /** The otter itself (rolls belly-up while floating). Used for its sticker. */
  public body = new THREE.Group();
  private tail = new THREE.Group();
  private paws: THREE.Object3D[] = [];
  private home = new THREE.Vector3();
  private state: 'float' | 'flee' | 'flip' = 'float';
  private timer = 0;
  private rest = 0;
  private heading = 0;
  private time = 0;
  private tags = 0;
  private farTime = 0;
  private disposables: { dispose: () => void }[] = [];
  public active = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    lakePoint(OTTER_HOME[0], OTTER_HOME[1], this.home);
    this.group.position.copy(this.home).setY(-0.15);
    this.group.add(this.body);
    this.build();
  }

  private build() {
    const fur = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 });
    const cream = new THREE.MeshStandardMaterial({ color: '#f2d9ae', roughness: 0.75 });
    const dark = new THREE.MeshBasicMaterial({ color: '#1a1410' });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const sphere = new THREE.SphereGeometry(1, 18, 12);
    const cone = new THREE.ConeGeometry(1, 1, 12);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.disposables.push(fur, cream, dark, white, sphere, cone, cyl);
    const b = this.body;
    b.add(makePart(sphere, fur, [0, 0, 0], [0.32, 0.28, 0.72]));
    b.add(makePart(sphere, cream, [0, -0.08, 0.15], [0.26, 0.2, 0.5]));
    b.add(makePart(sphere, fur, [0, 0.08, 0.72], [0.27, 0.25, 0.27]));
    b.add(makePart(sphere, cream, [0, 0.0, 0.9], [0.17, 0.13, 0.14]));
    b.add(makePart(sphere, dark, [0, 0.06, 1.03], [0.06, 0.045, 0.04]));
    for (const x of [0.12, -0.12]) {
      b.add(makePart(sphere, dark, [x, 0.17, 0.92], [0.045, 0.05, 0.03]));
      b.add(makePart(sphere, white, [x + 0.015, 0.19, 0.945], [0.012, 0.012, 0.01]));
      b.add(makePart(sphere, fur, [x * 1.7, 0.27, 0.66], [0.07, 0.06, 0.04]));
      for (let k = 0; k < 2; k++) {
        b.add(makePart(cyl, white, [x * 1.9, -0.01 + k * 0.03, 0.95], [0.004, 0.22, 0.004], [0, 0, (x > 0 ? 1 : -1) * (Math.PI / 2 + (k - 0.5) * 0.2)]));
      }
    }
    // Paddling paws.
    for (const [x, z] of [[0.24, 0.35], [-0.24, 0.35], [0.22, -0.4], [-0.22, -0.4]]) {
      const paw = makePart(sphere, fur, [x, -0.15, z], [0.08, 0.06, 0.12]);
      b.add(paw);
      this.paws.push(paw);
    }
    // Long tapering tail.
    this.tail.position.set(0, 0, -0.65);
    this.tail.add(makePart(cone, fur, [0, 0, -0.45], [0.16, 0.95, 0.12], [-Math.PI / 2, 0, 0]));
    b.add(this.tail);
    mergeStaticMeshes(b, [this.tail, ...this.paws]);
    this.group.scale.setScalar(1.15);
  }

  /** `fleeSpeed` should be catchable with Zoom. Returns what happened this frame. */
  public update(dt: number, player: THREE.Vector3, fleeSpeed: number, allowed: boolean): OtterEvent {
    this.time += dt;
    this.rest = Math.max(0, this.rest - dt);
    const g = this.group;
    const dx = player.x - g.position.x;
    const dz = player.z - g.position.z;
    const d = Math.hypot(dx, dz);
    let ev: OtterEvent = null;

    // Swimming wiggle.
    const swimming = this.state !== 'float';
    this.tail.rotation.y = Math.sin(this.time * (swimming ? 10 : 2)) * (swimming ? 0.45 : 0.15);
    this.paws.forEach((p, k) => (p.rotation.x = Math.sin(this.time * (swimming ? 12 : 3) + k * 1.6) * 0.8));

    if (this.state === 'float') {
      this.active = false;
      // Floating on its back near home, slowly turning.
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, Math.PI, 4, dt);
      this.body.rotation.x = 0;
      _p.copy(this.home).setY(-0.1);
      g.position.lerp(_p, Math.min(1, dt * 0.4));
      g.position.y = -0.12 + Math.sin(this.time * 1.4) * 0.05;
      g.rotation.y += dt * 0.25;
      if (allowed && this.rest <= 0 && d < 12) {
        this.state = 'flee';
        this.tags = 0;
        this.farTime = 0;
        this.heading = Math.atan2(-dx, -dz);
        this.active = true;
        ev = 'invite';
      }
    } else if (this.state === 'flee' || this.state === 'flip') {
      this.active = true;
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, 0, 8, dt);
      if (this.state === 'flip') {
        this.timer += dt;
        this.body.rotation.x = -this.timer * Math.PI * 2 / 0.7;
        g.position.y = -0.2 + Math.sin(Math.min(1, this.timer / 0.7) * Math.PI) * 1.4;
        if (this.timer > 0.7) {
          this.state = 'flee';
          this.body.rotation.x = 0;
        }
      } else {
        // Away from Whiskers with a playful zigzag, and back toward the middle near the shore.
        const away = Math.atan2(-dx, -dz) + Math.sin(this.time * 1.3) * 0.6;
        let want = away;
        const r = worldToRiver(g.position.x, g.position.z);
        if (Math.abs(r.lateral) > 38 || r.distance < 2500 || r.distance > 2940) {
          _p.copy(this.home);
          want = Math.atan2(_p.x - g.position.x, _p.z - g.position.z);
        }
        const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
        this.heading += diff * Math.min(1, dt * 2.2);
        // Slow down when far ahead so Whiskers can catch up.
        const speed = d > 14 ? fleeSpeed * 0.55 : fleeSpeed;
        g.position.x += Math.sin(this.heading) * speed * dt;
        g.position.z += Math.cos(this.heading) * speed * dt;
        g.position.y = -0.45 + Math.sin(this.time * 4) * 0.25;
        g.rotation.y = this.heading;
        if (d < 2.1 && Math.abs(player.y - g.position.y) < 2) {
          this.tags++;
          ev = this.tags >= 3 ? 'win' : 'tag';
          this.state = 'flip';
          this.timer = 0;
          if (this.tags >= 3) {
            this.state = 'float';
            this.rest = 25;
          }
        }
        this.farTime = d > 40 ? this.farTime + dt : 0;
        if (this.farTime > 4 || !allowed) {
          this.state = 'float';
          this.rest = 8;
          ev = 'bye';
        }
      }
    }
    return ev;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}

// ------------------------------------------------------------------ Waterfall slide
const FALLS_DIST = 2860;
const FALLS_LAT = 61;

export class WaterfallSlide {
  public group = new THREE.Group();
  private curve: THREE.CatmullRomCurve3;
  private fallsMat: THREE.ShaderMaterial;
  private liftBubbles: THREE.InstancedMesh;
  private foam: THREE.Mesh[] = [];
  public entry = new THREE.Vector3();
  public camSpot = new THREE.Vector3();
  private riding = false;
  private t = 0;
  private splashed = false;
  private cooldown = 0;
  private time = 0;
  private disposables: { dispose: () => void }[] = [];
  private static readonly DURATION = 6.2;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const P = (dd: number, lat: number, y: number) => lakePoint(FALLS_DIST + dd, lat).setY(y);
    // Everything visible is placed relative to the falls, so distance streaming works.
    const origin = P(0, FALLS_LAT, 0);
    this.group.position.copy(origin);
    const L = (dd: number, lat: number, y: number) => P(dd, lat, y).sub(origin);
    lakePoint(FALLS_DIST, 53, this.entry).setY(-1);
    this.camSpot.copy(P(-14, 36, 5.5));
    this.curve = new THREE.CatmullRomCurve3([
      P(0, 53, -1.1),
      P(-1.5, 57.5, -0.4),
      P(-3, 59.5, 2.5),
      P(-3, 61, 6.5),
      P(-2, 63.5, 9.4),
      P(1, 66.5, 9.7),
      P(3, 65.5, 9.6),
      P(2, 63.3, 9.3),
      P(1, 61.4, 5.5),
      P(0.5, 59.4, 1.2),
      P(0, 56.5, -0.8),
      P(0, 51, -1.4),
    ], false, 'catmullrom', 0.4);

    const rock = new THREE.MeshStandardMaterial({ color: '#8b8172', roughness: 0.95, flatShading: true });
    const moss = new THREE.MeshStandardMaterial({ color: '#5aa84a', roughness: 0.9, flatShading: true });
    const poolMat = new THREE.MeshStandardMaterial({ color: '#4fc3e8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
    const foamMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.85 });
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const sphere = new THREE.SphereGeometry(1, 14, 10);
    this.disposables.push(rock, moss, poolMat, foamMat, rockGeo, sphere);

    // Cliff: a pile of big rocks with mossy tops, on both sides of the falls and behind the pool.
    const cliff = new THREE.Group();
    const blobs: [number, number, number, number, number, number][] = [
      // [dd, lat, y, sx, sy, sz]
      [-8, 64, 3.5, 4.5, 6, 4],
      [8, 64, 3.5, 4.5, 6.5, 4.2],
      [-6, 69, 4.5, 5, 7, 5],
      [6, 69, 4.5, 5, 7.5, 5],
      [0, 72, 5, 7, 7.5, 4.5],
      [-11, 67, 2.5, 3.5, 4.5, 3.5],
      [11, 67, 2.5, 3.5, 4.8, 3.5],
      [-3.8, 63.5, 4.2, 2.2, 5.6, 2.4],
      [3.8, 63.5, 4.2, 2.2, 5.6, 2.4],
      [0, 66.5, 4.2, 3.4, 5.3, 3.2],
    ];
    blobs.forEach(([dd, lat, y, sx, sy, sz], k) => {
      const p = L(dd, lat, y);
      cliff.add(makePart(rockGeo, rock, [p.x, p.y, p.z], [sx, sy, sz], [k * 0.7, k * 1.3, 0]));
      if (sy > 5) cliff.add(makePart(rockGeo, moss, [p.x, p.y + sy * 0.82, p.z], [sx * 0.8, sy * 0.22, sz * 0.8], [k, k, 0]));
    });
    mergeStaticMeshes(cliff);
    this.group.add(cliff);

    // Top pool.
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), poolMat);
    this.disposables.push(pool.geometry);
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(L(0.5, 65.5, 9.45));
    this.group.add(pool);

    // The falling water: a ribbon along the curve's slide part with streaks flowing down.
    this.fallsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime;
        void main(){
          float streak = sin(vUv.x * 40.0 + sin(vUv.x * 13.0) * 2.0) * 0.5 + 0.5;
          float flow = fract(vUv.y * 3.0 - uTime * 1.6 + streak * 0.35);
          float white = smoothstep(0.55, 1.0, flow) * 0.7 + streak * 0.15;
          vec3 col = mix(vec3(0.55, 0.85, 0.97), vec3(1.0), white);
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          gl_FragColor = vec4(col, 0.82 * edge);
        }`,
    });
    this.disposables.push(this.fallsMat);
    const fallsPts = [L(2, 63.6, 9.5), L(1.2, 62.2, 7.4), L(0.8, 61, 4.6), L(0.4, 59.8, 1.8), L(0, 58.6, 0)];
    const fallsCurve = new THREE.CatmullRomCurve3(fallsPts);
    const segs = 24;
    const width = 4.2;
    const verts: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const { tangent } = getRiverPath(FALLS_DIST);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const c = fallsCurve.getPoint(u);
      for (let j = 0; j <= 1; j++) {
        const off = (j - 0.5) * width;
        verts.push(c.x + tangent.x * off, c.y, c.z + tangent.z * off);
        uvs.push(j, u);
      }
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const fallsGeo = new THREE.BufferGeometry();
    fallsGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    fallsGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fallsGeo.setIndex(idx);
    this.disposables.push(fallsGeo);
    this.group.add(new THREE.Mesh(fallsGeo, this.fallsMat));

    // Foam where the falls hit the lake.
    for (let k = 0; k < 5; k++) {
      const f = makePart(sphere, foamMat, [0, 0, 0], [1, 0.35, 1]);
      f.position.copy(L((k - 2) * 0.9, 57.8 + (k % 2) * 0.8, 0.05));
      this.foam.push(f);
      this.group.add(f);
    }

    // Bubble lift beside the falls (shows where to swim in).
    const bubMat = new THREE.MeshStandardMaterial({ color: '#eafcff', transparent: true, opacity: 0.65, roughness: 0.05, depthWrite: false });
    this.disposables.push(bubMat);
    this.liftBubbles = new THREE.InstancedMesh(sphere, bubMat, 40);
    this.liftBubbles.frustumCulled = false;
    this.group.add(this.liftBubbles);
  }

  public get isRiding() {
    return this.riding;
  }

  public cancel() {
    this.riding = false;
  }

  /** Start the ride when Whiskers swims into the bubble lift. */
  public tryStart(player: THREE.Vector3): boolean {
    if (this.riding || this.cooldown > 0) return false;
    if (Math.hypot(player.x - this.entry.x, player.z - this.entry.z) > 3.6) return false;
    this.riding = true;
    this.t = 0;
    this.splashed = false;
    return true;
  }

  /** Path position (0..1) for ride time: up the lift, a lap of the pool, then a fast slide. */
  private progress(time: number) {
    const D = WaterfallSlide.DURATION;
    const up = 2.6;
    const pool = 1.3;
    if (time < up) return 0.42 * (time / up);
    if (time < up + pool) return 0.42 + 0.2 * ((time - up) / pool);
    const s = Math.min(1, (time - up - pool) / (D - up - pool));
    return 0.62 + 0.38 * (s * s * (1.6 - 0.6 * s));
  }

  /** Advance the ride. Returns Whiskers' pose and what happened. */
  public updateRide(dt: number, out: THREE.Vector3, tangentOut: THREE.Vector3): 'riding' | 'whee' | 'splash' | 'done' {
    const before = this.t;
    this.t += dt;
    const u = Math.min(1, this.progress(this.t));
    this.curve.getPointAt(u, out);
    this.curve.getTangentAt(u, tangentOut);
    let ev: 'riding' | 'whee' | 'splash' | 'done' = 'riding';
    if (before < 3.9 && this.t >= 3.9) ev = 'whee';
    if (!this.splashed && u > 0.8 && out.y < 0.2) {
      this.splashed = true;
      ev = 'splash';
    }
    if (u >= 1) {
      this.riding = false;
      this.cooldown = 2.5;
      ev = 'done';
    }
    return ev;
  }

  public update(dt: number, player: THREE.Vector3) {
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (Math.hypot(player.x - this.entry.x, player.z - this.entry.z) > 140) return;
    this.fallsMat.uniforms.uTime.value = this.time;
    this.foam.forEach((f, k) => f.scale.set(1 + Math.sin(this.time * 5 + k) * 0.18, 0.35, 1 + Math.cos(this.time * 4 + k) * 0.18));
    for (let k = 0; k < 40; k++) {
      const t = (this.time * 0.35 + k / 40) % 1;
      this.curve.getPointAt(t * 0.42, _p).sub(this.group.position);
      _p.x += Math.sin(k * 3.1 + this.time * 2) * 0.5;
      _p.z += Math.cos(k * 2.3 + this.time * 2) * 0.5;
      _s.setScalar(0.1 + (k % 4) * 0.04);
      _m.compose(_p, _q, _s);
      this.liftBubbles.setMatrixAt(k, _m);
    }
    this.liftBubbles.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
