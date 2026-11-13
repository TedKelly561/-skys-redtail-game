import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';
import { mergeStaticMeshes } from './perf';

/**
 * Gentle bad guys for young players. Nobody gets hurt: if one catches Whiskers it just takes
 * one snack.
 * - Sleepy caimans float at the surface. Bump one (or zoom right past it) and it wakes up
 *   with a SNAP. Swim around it to sneak past.
 * - Grumpy piranhas guard a spot. Swim close and they chase for a few seconds; zoom away.
 * - Tricky: crocs lunge when they wake, and sometimes follow Whiskers for a few seconds.
 */
export type BadGuyEvent =
  | { type: 'caught'; by: 'caiman' | 'piranhas'; at?: THREE.Vector3 }
  | { type: 'bump'; by: 'caiman'; at: THREE.Vector3 }
  | { type: 'warn'; by: 'caiman' | 'piranhas' }
  | { type: 'escaped'; by: 'caiman' | 'piranhas' }
  | { type: 'stalk'; by: 'caiman' };

interface Caiman {
  group: THREE.Group;
  jaw: THREE.Group;
  tail: THREE.Group;
  lids: THREE.Mesh[];
  pupils: THREE.Mesh[];
  zzz: THREE.Sprite[];
  state: 'sleep' | 'snap' | 'awake' | 'stalk';
  /** Decided at the snap: follow Whiskers afterwards (Tricky). */
  willStalk: boolean;
  timer: number;
  phase: number;
  warned: boolean;
  caughtThisSnap: boolean;
  bumpCooldown: number;
  /** Where it sleeps; after a lunge it drifts back here. */
  home: THREE.Vector3;
  homeRot: number;
  /** Only shows up on Tricky. */
  extra: boolean;
}

interface PiranhaSchool {
  group: THREE.Group;
  fish: { body: THREE.Group; tail: THREE.Object3D; offset: THREE.Vector3; phase: number }[];
  home: THREE.Vector3;
  state: 'idle' | 'notice' | 'chase' | 'flee';
  timer: number;
  cooldown: number;
  phase: number;
  extra: boolean;
}

const CAIMAN_SPOTS = [600, 910, 1200, 1500, 1810, 2120];
const PIRANHA_SPOTS = [1080, 1350, 1700, 1990];
/** Extra bad guys that only show up on Tricky. */
const TRICKY_CAIMAN_SPOTS = [760, 1420, 1960];
const TRICKY_PIRANHA_SPOTS = [840, 1190, 1560, 2210];

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function zTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1e3a5f';
  ctx.strokeText('Z', 32, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Z', 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BadGuys {
  public caimanGroup = new THREE.Group();
  public piranhaGroup = new THREE.Group();
  private caimans: Caiman[] = [];
  private schools: PiranhaSchool[] = [];
  private disposables: { dispose: () => void }[] = [];
  /** Tuned by the grown-ups difficulty setting. */
  public tuning = { wake: 2.6, zoomWake: 4.2, lunge: 0, stalk: 0, notice: 14, chaseTime: 3.5 };
  private extrasOn = false;

  /** Tricky adds more crocs and piranhas; on other levels they stay hidden and asleep. */
  public setExtras(on: boolean) {
    this.extrasOn = on;
    for (const c of this.caimans) if (c.extra) c.group.visible = on;
    for (const s of this.schools) if (s.extra) s.group.visible = on;
  }

  constructor(scene: THREE.Scene) {
    scene.add(this.caimanGroup, this.piranhaGroup);
    this.buildCaimans();
    this.buildPiranhas();
  }

  // ---------------------------------------------------------------- Caimans
  private buildCaimans() {
    const skin = new THREE.MeshStandardMaterial({ color: '#6f9440', roughness: 0.75 });
    const dark = new THREE.MeshStandardMaterial({ color: '#4c6b2b', roughness: 0.8 });
    const belly = new THREE.MeshStandardMaterial({ color: '#d8d39a', roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
    const black = new THREE.MeshBasicMaterial({ color: '#111111' });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#f4e36b', roughness: 0.3 });
    const zMat = new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false });
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const cone = new THREE.ConeGeometry(1, 1, 8);
    this.disposables.push(skin, dark, belly, white, black, eyeMat, zMat, sphere, cone);

    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.rotation.set(r[0], r[1], r[2]);
      return m;
    };

    const spots = [...CAIMAN_SPOTS.map((d) => [d, 0]), ...TRICKY_CAIMAN_SPOTS.map((d) => [d, 1])];
    spots.forEach(([dist, extra], i) => {
      const { position, normal, tangent, width } = getRiverPath(dist);
      const lateral = (i % 2 === 0 ? 1 : -1) * width * (0.12 + (i % 3) * 0.05);
      const g = new THREE.Group();

      // Body, belly, head, snout, legs and back ridges (merged later).
      g.add(part(sphere, skin, [0, 0, 0], [0.62, 0.32, 1.35]));
      g.add(part(sphere, belly, [0, -0.1, 0.05], [0.55, 0.22, 1.2]));
      g.add(part(sphere, skin, [0, 0.03, 1.3], [0.46, 0.28, 0.55]));
      g.add(part(sphere, skin, [0, 0.02, 1.95], [0.3, 0.13, 0.62]));
      g.add(part(sphere, dark, [0.09, 0.13, 2.45], [0.05, 0.04, 0.05]));
      g.add(part(sphere, dark, [-0.09, 0.13, 2.45], [0.05, 0.04, 0.05]));
      for (const [x, z] of [[0.55, 0.7], [-0.55, 0.7], [0.55, -0.7], [-0.55, -0.7]]) {
        g.add(part(sphere, skin, [x, -0.2, z], [0.16, 0.12, 0.28], [0, 0, x > 0 ? -0.6 : 0.6]));
      }
      for (let k = 0; k < 7; k++) {
        g.add(part(cone, dark, [0, 0.3, 0.9 - k * 0.32], [0.09, 0.16, 0.09]));
      }
      // Eye bumps.
      for (const x of [0.2, -0.2]) {
        g.add(part(sphere, skin, [x, 0.3, 1.25], [0.14, 0.13, 0.15]));
        g.add(part(sphere, eyeMat, [x, 0.33, 1.32], [0.1, 0.09, 0.08]));
      }

      // Pupils (shown when awake) and eyelids (shown when asleep).
      const pupils: THREE.Mesh[] = [];
      const lids: THREE.Mesh[] = [];
      for (const x of [0.2, -0.2]) {
        const pupil = part(sphere, black, [x, 0.34, 1.39], [0.025, 0.07, 0.02]);
        pupil.visible = false;
        pupils.push(pupil);
        const lid = part(sphere, skin, [x, 0.335, 1.33], [0.11, 0.1, 0.09]);
        lids.push(lid);
        g.add(pupil, lid);
      }

      // Lower jaw on a hinge, with a few small friendly teeth.
      const jaw = new THREE.Group();
      jaw.position.set(0, -0.06, 1.45);
      jaw.add(part(sphere, belly, [0, -0.04, 0.5], [0.27, 0.08, 0.6]));
      for (let k = 0; k < 3; k++) {
        for (const x of [0.2, -0.2]) {
          jaw.add(part(cone, white, [x * (1 - k * 0.12), 0.05, 0.3 + k * 0.25], [0.035, 0.08, 0.035]));
        }
      }
      g.add(jaw);

      // Tail, swaying slowly.
      const tail = new THREE.Group();
      tail.position.set(0, 0, -1.2);
      tail.add(part(cone, skin, [0, 0, -1.0], [0.38, 2.2, 0.22], [-Math.PI / 2, 0, 0]));
      for (let k = 0; k < 5; k++) tail.add(part(cone, dark, [0, 0.18 - k * 0.02, -0.25 - k * 0.38], [0.07, 0.13, 0.07]));
      g.add(tail);

      // Zzz bubbles.
      const zzz: THREE.Sprite[] = [];
      for (let k = 0; k < 3; k++) {
        const zm = zMat.clone();
        this.disposables.push(zm);
        const s = new THREE.Sprite(zm);
        s.scale.setScalar(0.5);
        g.add(s);
        zzz.push(s);
      }

      mergeStaticMeshes(g, [jaw, tail, ...pupils, ...lids, ...zzz]);
      g.scale.setScalar(1.25);
      // Floating at the surface, lying a bit across the river so it's worth steering around.
      g.position.set(position.x + normal.x * lateral, -0.12, position.z + normal.z * lateral);
      g.rotation.y = Math.atan2(tangent.x, tangent.z) + (i % 2 === 0 ? 1.1 : -1.1);
      this.caimanGroup.add(g);
      g.visible = !extra;
      this.caimans.push({
        group: g, jaw, tail, lids, pupils, zzz, state: 'sleep', willStalk: false, timer: 0, phase: i, warned: false, caughtThisSnap: false, bumpCooldown: 0,
        home: g.position.clone(), homeRot: g.rotation.y, extra: extra === 1,
      });
    });
  }

  // ---------------------------------------------------------------- Piranhas
  private buildPiranhas() {
    const back = new THREE.MeshStandardMaterial({ color: '#8d9ba6', roughness: 0.4, metalness: 0.3 });
    const red = new THREE.MeshStandardMaterial({ color: '#ff4a2a', roughness: 0.45 });
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    const black = new THREE.MeshBasicMaterial({ color: '#111111' });
    const fin = new THREE.MeshStandardMaterial({ color: '#5d6a74', roughness: 0.5, side: THREE.DoubleSide });
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const cone = new THREE.ConeGeometry(1, 1, 6);
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.28, 0.22);
    tailShape.quadraticCurveTo(-0.22, 0, -0.28, -0.22);
    tailShape.closePath();
    const tailGeo = new THREE.ShapeGeometry(tailShape);
    tailGeo.rotateY(-Math.PI / 2); // fan out behind the body (-Z)
    this.disposables.push(back, red, white, black, fin, sphere, cone, tailGeo);

    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.rotation.set(r[0], r[1], r[2]);
      return m;
    };

    const makeFish = () => {
      const body = new THREE.Group();
      body.add(part(sphere, back, [0, 0.04, 0], [0.13, 0.28, 0.34]));
      body.add(part(sphere, red, [0, -0.1, 0.03], [0.125, 0.17, 0.28]));
      // Underbite jaw with two little teeth.
      body.add(part(sphere, red, [0, -0.1, 0.27], [0.08, 0.06, 0.08]));
      body.add(part(cone, white, [0.035, -0.04, 0.33], [0.018, 0.04, 0.018]));
      body.add(part(cone, white, [-0.035, -0.04, 0.33], [0.018, 0.04, 0.018]));
      // Big eyes with grumpy eyebrows.
      for (const x of [0.11, -0.11]) {
        body.add(part(sphere, white, [x, 0.08, 0.2], [0.035, 0.05, 0.05]));
        body.add(part(sphere, black, [x * 1.08, 0.075, 0.23], [0.02, 0.03, 0.025]));
        body.add(part(sphere, black, [x * 1.05, 0.15, 0.2], [0.02, 0.012, 0.06], [x > 0 ? -0.5 : 0.5, 0, 0]));
      }
      body.add(part(cone, fin, [0, 0.33, -0.05], [0.02, 0.18, 0.12], [-0.4, 0, 0]));
      const tail = part(tailGeo, fin, [0, 0, -0.32], [1, 1, 1]);
      body.add(tail);
      mergeStaticMeshes(body, [tail]);
      body.scale.setScalar(1.4);
      return { body, tail };
    };

    const spots = [...PIRANHA_SPOTS.map((d) => [d, 0]), ...TRICKY_PIRANHA_SPOTS.map((d) => [d, 1])];
    spots.forEach(([dist, extra], i) => {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (i % 2 === 0 ? -1 : 1) * width * 0.15;
      const bed = getRiverBedElevationAt(dist, lateral);
      const home = new THREE.Vector3(position.x + normal.x * lateral, Math.max(bed + 1.0, -2.0), position.z + normal.z * lateral);
      const group = new THREE.Group();
      group.position.copy(home);
      const fish: PiranhaSchool['fish'] = [];
      for (let k = 0; k < 4; k++) {
        const f = makeFish();
        const offset = new THREE.Vector3(Math.cos(k * 1.6) * 0.6, Math.sin(k * 2.1) * 0.25, Math.sin(k * 1.6) * 0.6);
        f.body.position.copy(offset);
        group.add(f.body);
        fish.push({ ...f, offset, phase: k * 1.7 });
      }
      this.piranhaGroup.add(group);
      group.visible = !extra;
      this.schools.push({ group, fish, home, state: 'idle', timer: 0, cooldown: 0, phase: i * 2, extra: extra === 1 });
    });
  }

  public reset() {
    for (const c of this.caimans) {
      c.state = 'sleep';
      c.timer = 0;
      c.warned = false;
      c.group.position.copy(c.home);
      c.group.rotation.y = c.homeRot;
    }
    for (const s of this.schools) {
      s.state = 'idle';
      s.cooldown = 0;
      s.group.position.copy(s.home);
    }
  }

  /**
   * Updates every bad guy near Whiskers and reports what happened this frame.
   * `chaseSpeed` should be a bit slower than Whiskers' Zoom so zooming always escapes.
   */
  public update(dt: number, player: THREE.Vector3, isBoosting: boolean, chaseSpeed: number): BadGuyEvent[] {
    const events: BadGuyEvent[] = [];

    for (const c of this.caimans) {
      if (c.extra && !this.extrasOn) continue;
      const g = c.group;
      const dx = g.position.x - player.x;
      const dz = g.position.z - player.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 90 * 90) continue;
      c.phase += dt;
      // Distance to the caiman's head (2 m ahead of its center).
      g.localToWorld(_v.set(0, 0, 1.5));
      const headDist = Math.hypot(_v.x - player.x, _v.z - player.z);
      const bodyDist = Math.sqrt(dSq);
      const near = Math.min(headDist, bodyDist);
      const deep = player.y < -3.4; // swimming deep sneaks underneath

      // Solid body: touching it (snout to tail) bumps Whiskers away.
      c.bumpCooldown = Math.max(0, c.bumpCooldown - dt);
      if (!deep && c.bumpCooldown <= 0) {
        const ax = Math.sin(g.rotation.y);
        const az = Math.cos(g.rotation.y);
        const t = THREE.MathUtils.clamp(-dx * ax + -dz * az, -1.9, 3.0);
        const cx = g.position.x + ax * t;
        const cz = g.position.z + az * t;
        if (Math.hypot(player.x - cx, player.z - cz) < 1.35) {
          c.bumpCooldown = 1;
          events.push({ type: 'bump', by: 'caiman', at: new THREE.Vector3(cx, player.y, cz) });
        }
      }

      if (c.state === 'sleep') {
        c.tail.rotation.y = Math.sin(c.phase * 0.8) * 0.12;
        g.position.y = -0.12 + Math.sin(c.phase * 0.9) * 0.03;
        c.zzz.forEach((z, k) => {
          const t = (c.phase * 0.45 + k / 3) % 1;
          z.visible = true;
          z.position.set(0.25 + t * 0.4, 0.5 + t * 1.4, 1.3);
          z.material.opacity = Math.sin(t * Math.PI);
          z.scale.setScalar(0.3 + t * 0.35);
        });
        if (!c.warned && near < 12) {
          c.warned = true;
          events.push({ type: 'warn', by: 'caiman' });
        }
        const wakeRadius = isBoosting ? this.tuning.zoomWake : this.tuning.wake;
        if (near < wakeRadius && !deep) {
          c.state = 'snap';
          c.timer = 0;
          c.caughtThisSnap = false;
          c.zzz.forEach((z) => (z.visible = false));
          c.lids.forEach((l) => (l.visible = false));
          c.pupils.forEach((p) => (p.visible = true));
        }
      } else if (c.state === 'snap') {
        c.timer += dt;
        // Open wide, then SNAP shut at 0.35 s.
        const open = c.timer < 0.35 ? Math.sin((c.timer / 0.35) * Math.PI * 0.5) : Math.max(0, 1 - (c.timer - 0.35) * 8);
        c.jaw.rotation.x = open * 0.7;
        c.tail.rotation.y = Math.sin(c.timer * 20) * 0.35;
        // Tricky: lunge toward Whiskers while the jaws open (never farther than `lunge` from home).
        if (this.tuning.lunge > 0 && c.timer < 0.35) {
          const lx = player.x - g.position.x;
          const lz = player.z - g.position.z;
          const ld = Math.hypot(lx, lz);
          if (ld > 1.2) {
            const step = Math.min(ld - 1.2, (this.tuning.lunge / 0.35) * dt);
            g.position.x += (lx / ld) * step;
            g.position.z += (lz / ld) * step;
            const ox = g.position.x - c.home.x;
            const oz = g.position.z - c.home.z;
            const od = Math.hypot(ox, oz);
            if (od > this.tuning.lunge) {
              g.position.x = c.home.x + (ox / od) * this.tuning.lunge;
              g.position.z = c.home.z + (oz / od) * this.tuning.lunge;
            }
            const want = Math.atan2(lx, lz);
            g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 10);
          }
        }
        if (c.timer >= 0.35 && !c.caughtThisSnap) {
          c.caughtThisSnap = true;
          const caught = near < 3.6 && !deep;
          // Tricky: a croc that missed sometimes swims after Whiskers for a few seconds.
          c.willStalk = !caught && !deep && Math.random() < this.tuning.stalk;
          events.push(caught ? { type: 'caught', by: 'caiman' } : c.willStalk ? { type: 'stalk', by: 'caiman' } : { type: 'escaped', by: 'caiman' });
        }
        if (c.timer > 0.8) {
          c.state = c.willStalk ? 'stalk' : 'awake';
          c.willStalk = false;
          c.timer = 0;
        }
      } else if (c.state === 'stalk') {
        // Paddle after Whiskers: a bit slower than his Zoom, so zooming always gets away.
        c.timer += dt;
        c.tail.rotation.y = Math.sin(c.timer * 14) * 0.45;
        c.jaw.rotation.x = 0.25 + Math.sin(c.timer * 5) * 0.1;
        const sx = player.x - g.position.x;
        const sz = player.z - g.position.z;
        const sd = Math.hypot(sx, sz);
        if (sd > 0.5) {
          const step = Math.min(sd, chaseSpeed * 0.82 * dt);
          g.position.x += (sx / sd) * step;
          g.position.z += (sz / sd) * step;
          const want = Math.atan2(sx, sz);
          g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 6);
        }
        const fromHome = Math.hypot(g.position.x - c.home.x, g.position.z - c.home.z);
        if (headDist < 2.2 && !deep) {
          events.push({ type: 'caught', by: 'caiman' });
          c.state = 'awake';
          c.timer = 0;
        } else if (c.timer > 4 || fromHome > 24 || deep) {
          events.push({ type: 'escaped', by: 'caiman' });
          c.state = 'awake';
          c.timer = 0;
        }
      } else {
        // Awake and grumpy for a few seconds, then back to sleep.
        c.timer += dt;
        c.tail.rotation.y = Math.sin(c.phase * 2) * 0.2;
        // After a lunge, paddle slowly back to its sleeping spot.
        if (c.timer > 1) {
          const k = Math.min(1, dt * 0.8);
          g.position.x += (c.home.x - g.position.x) * k;
          g.position.z += (c.home.z - g.position.z) * k;
          g.rotation.y += Math.atan2(Math.sin(c.homeRot - g.rotation.y), Math.cos(c.homeRot - g.rotation.y)) * k;
        }
        if (c.timer > 4 && near > 6) {
          c.state = 'sleep';
          c.lids.forEach((l) => (l.visible = true));
          c.pupils.forEach((p) => (p.visible = false));
        }
      }
    }

    for (const s of this.schools) {
      if (s.extra && !this.extrasOn) continue;
      const g = s.group;
      const dx = player.x - g.position.x;
      const dy = player.y - g.position.y;
      const dz = player.z - g.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 120 && s.state === 'idle') continue;
      s.phase += dt;
      s.cooldown = Math.max(0, s.cooldown - dt);

      if (s.state === 'idle') {
        // Circle around home.
        _w.set(s.home.x + Math.cos(s.phase * 0.7) * 1.5, s.home.y, s.home.z + Math.sin(s.phase * 0.7) * 1.5);
        g.position.lerp(_w, Math.min(1, dt * 2));
        g.rotation.y = Math.atan2(-Math.sin(s.phase * 0.7), Math.cos(s.phase * 0.7));
        if (d < this.tuning.notice && s.cooldown <= 0) {
          s.state = 'notice';
          s.timer = 0;
          events.push({ type: 'warn', by: 'piranhas' });
        }
      } else if (s.state === 'notice') {
        // Turn to face Whiskers for a moment before chasing (fair warning).
        s.timer += dt;
        g.rotation.y = Math.atan2(dx, dz);
        if (s.timer > 0.7) {
          s.state = 'chase';
          s.timer = 0;
        }
      } else if (s.state === 'chase') {
        s.timer += dt;
        const step = Math.min(d, chaseSpeed * dt);
        g.position.x += (dx / d) * step;
        g.position.y += (dy / d) * step;
        g.position.z += (dz / d) * step;
        g.rotation.y = Math.atan2(dx, dz);
        if (d < 1.5) {
          events.push({ type: 'caught', by: 'piranhas', at: g.position.clone() });
          s.state = 'flee';
          s.timer = 0;
          s.cooldown = 14;
        } else if (s.timer > this.tuning.chaseTime || d > 25) {
          events.push({ type: 'escaped', by: 'piranhas' });
          s.state = 'flee';
          s.timer = 0;
          s.cooldown = 8;
        }
      } else {
        // Swim back home.
        s.timer += dt;
        const hx = s.home.x - g.position.x;
        const hz = s.home.z - g.position.z;
        g.position.lerp(s.home, Math.min(1, dt * 0.8));
        g.rotation.y = Math.atan2(hx, hz);
        if (s.timer > 4) s.state = 'idle';
      }

      const fast = s.state === 'chase' ? 2.2 : 1;
      s.fish.forEach((f) => {
        f.phase += dt * 10 * fast;
        f.tail.rotation.y = Math.sin(f.phase) * 0.5;
        f.body.position.set(
          f.offset.x + Math.sin(s.phase * 1.3 + f.phase * 0.05) * 0.1,
          f.offset.y + Math.sin(s.phase * 2 + f.offset.x) * 0.08,
          f.offset.z
        );
      });
    }
    return events;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.caimanGroup.parent?.remove(this.caimanGroup);
    this.piranhaGroup.parent?.remove(this.piranhaGroup);
  }
}
