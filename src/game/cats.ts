import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';
import { mergeStaticMeshes } from './perf';

/**
 * Sneaky black cats hide in bushes at the river's edge (Skylar's idea). Swim too close to the
 * bank and one pops out, wiggles, and pounces with a paw swipe.
 * - Still there when it lands: boing, and it takes a snack (none on Gentle).
 * - Swam away in time: it overreaches and falls in. SPLASH! The soggy cat paddles back,
 *   shakes off, and sulks in its bush.
 * Glowing yellow eyes peek out of the bush as a hint.
 */
export type CatEvent =
  | { type: 'warn' }
  | { type: 'pounce'; at: THREE.Vector3 }
  | { type: 'caught'; at: THREE.Vector3 }
  | { type: 'splash'; at: THREE.Vector3 }
  | { type: 'shake'; at: THREE.Vector3 };

export interface CatTuning {
  /** How close to the cat (meters) before it pops out. */
  trigger: number;
  /** Seconds of butt-wiggle before the pounce: time to swim away. */
  crouch: number;
  /** How well it aims where Whiskers is going (0 = where he was, 1 = where he'll be). */
  lead: number;
}

type CatState = 'hide' | 'pop' | 'crouch' | 'leap' | 'bounceBack' | 'smug' | 'swim' | 'shake' | 'sulk';

interface Cat {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  paw: THREE.Group;
  tail: THREE.Group;
  tailSegs: THREE.Object3D[];
  pupils: THREE.Mesh[];
  ears: THREE.Object3D[];
  bush: THREE.Group;
  /** Facing direction (toward the river). */
  facing: THREE.Vector3;
  hidePos: THREE.Vector3;
  popPos: THREE.Vector3;
  target: THREE.Vector3;
  from: THREE.Vector3;
  state: CatState;
  timer: number;
  phase: number;
  cooldown: number;
  warned: boolean;
}

const CAT_SPOTS: [number, 1 | -1][] = [
  [700, 1],
  [1000, -1],
  [1280, 1],
  [1580, -1],
  [1880, 1],
  [2060, -1],
];
const LEAP_TIME = 0.42;
const REACH = 5.2;
const CATCH_RADIUS = 2.0;

const _v = new THREE.Vector3();

/** Lateral offset of the waterline on one side (where the bank becomes dry). */
function waterline(dist: number, side: number, halfW: number) {
  for (let lat = halfW * 0.7; lat < halfW * 1.6; lat += 0.2) {
    if (getRiverBedElevationAt(dist, side * lat) > -0.05) return lat;
  }
  return halfW;
}

export class BushCats {
  public group = new THREE.Group();
  public tuning: CatTuning = { trigger: 5.5, crouch: 0.6, lead: 0.5 };
  private cats: Cat[] = [];
  private disposables: { dispose: () => void }[] = [];
  private prevPlayer = new THREE.Vector3();
  private playerVel = new THREE.Vector3();
  private hasPrev = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.build();
  }

  private build() {
    const fur = new THREE.MeshStandardMaterial({ color: '#26262e', roughness: 0.55 });
    const furLight = new THREE.MeshStandardMaterial({ color: '#34343e', roughness: 0.6 });
    const pink = new THREE.MeshStandardMaterial({ color: '#ff9fb4', roughness: 0.5 });
    const eye = new THREE.MeshStandardMaterial({
      color: '#ffd23f',
      emissive: '#ffb000',
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    const black = new THREE.MeshBasicMaterial({ color: '#0a0a0a' });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: '#f2f2f2' });
    const leafA = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.85, flatShading: true });
    const leafB = new THREE.MeshStandardMaterial({ color: '#2f7a35', roughness: 0.85, flatShading: true });
    const sphere = new THREE.SphereGeometry(1, 18, 12);
    const cone = new THREE.ConeGeometry(1, 1, 10);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    this.disposables.push(fur, furLight, pink, eye, black, whiskerMat, leafA, leafB, sphere, cone, cyl, leafGeo);

    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.rotation.set(r[0], r[1], r[2]);
      return m;
    };

    CAT_SPOTS.forEach(([dist, side], i) => {
      const { position, normal, width } = getRiverPath(dist);
      const edge = waterline(dist, side, width / 2);
      const at = (lat: number, out: THREE.Vector3) => {
        const y = Math.max(-0.1, getRiverBedElevationAt(dist, side * lat));
        return out.set(position.x + normal.x * side * lat, y, position.z + normal.z * side * lat);
      };
      const facing = new THREE.Vector3(-normal.x * side, 0, -normal.z * side);
      const bushPos = at(edge + 1.1, new THREE.Vector3());
      const hidePos = at(edge + 1.35, new THREE.Vector3());
      hidePos.y -= 0.3;
      const popPos = at(edge + 0.2, new THREE.Vector3());

      // The bush (rustles before the cat pops out).
      const bush = new THREE.Group();
      bush.position.copy(bushPos);
      const blobs: [number, number, number, number][] = [
        [0, 0.55, 0, 0.78],
        [0.62, 0.42, 0.1, 0.6],
        [-0.62, 0.42, 0.05, 0.62],
        [0.3, 0.38, 0.5, 0.48],
        [-0.32, 0.36, 0.48, 0.46],
        [0.05, 0.95, -0.15, 0.5],
        [0, 0.2, -0.05, 0.72],
      ];
      blobs.forEach(([x, y, z, r], k) => bush.add(part(leafGeo, k % 2 ? leafB : leafA, [x, y, z], [r, r * 0.85, r])));
      mergeStaticMeshes(bush);
      bush.rotation.y = Math.atan2(facing.x, facing.z) + Math.PI;
      this.group.add(bush);

      // The cat, built facing +Z with its feet at y = 0.
      const g = new THREE.Group();
      const body = new THREE.Group();
      g.add(body);
      body.add(part(sphere, fur, [0, 0.5, -0.05], [0.3, 0.28, 0.5]));
      body.add(part(sphere, furLight, [0, 0.56, 0.3], [0.27, 0.3, 0.28]));
      // Back legs (haunches) and feet, one still front leg.
      for (const x of [0.19, -0.19]) {
        body.add(part(sphere, fur, [x, 0.36, -0.32], [0.13, 0.22, 0.22]));
        body.add(part(sphere, fur, [x, 0.06, -0.22], [0.09, 0.06, 0.15]));
      }
      body.add(part(cyl, fur, [-0.14, 0.24, 0.36], [0.075, 0.46, 0.075]));
      body.add(part(sphere, fur, [-0.14, 0.04, 0.4], [0.085, 0.06, 0.11]));

      // Swiping front paw on a shoulder hinge.
      const paw = new THREE.Group();
      paw.position.set(0.14, 0.48, 0.36);
      paw.add(part(cyl, fur, [0, -0.22, 0], [0.075, 0.46, 0.075]));
      paw.add(part(sphere, fur, [0, -0.44, 0.04], [0.09, 0.065, 0.11]));
      for (const x of [-0.04, 0, 0.04]) paw.add(part(sphere, pink, [x, -0.47, 0.11], [0.022, 0.018, 0.022]));
      body.add(paw);

      // Head with big glowing eyes, pink nose, whiskers and pointy ears.
      const head = new THREE.Group();
      head.position.set(0, 0.88, 0.5);
      head.add(part(sphere, fur, [0, 0, 0], [0.3, 0.26, 0.27]));
      head.add(part(sphere, furLight, [0, -0.08, 0.2], [0.14, 0.09, 0.1]));
      head.add(part(sphere, pink, [0, -0.03, 0.29], [0.035, 0.025, 0.02]));
      const ears: THREE.Object3D[] = [];
      for (const x of [0.16, -0.16]) {
        const ear = new THREE.Group();
        ear.position.set(x, 0.2, -0.02);
        ear.rotation.z = x > 0 ? -0.3 : 0.3;
        ear.add(part(cone, fur, [0, 0.1, 0], [0.11, 0.22, 0.07]));
        ear.add(part(cone, pink, [0, 0.08, 0.035], [0.065, 0.15, 0.02]));
        head.add(ear);
        ears.push(ear);
      }
      const pupils: THREE.Mesh[] = [];
      for (const x of [0.115, -0.115]) {
        head.add(part(sphere, eye, [x, 0.04, 0.215], [0.085, 0.095, 0.05]));
        const pupil = part(sphere, black, [x, 0.04, 0.262], [0.018, 0.07, 0.012]);
        pupils.push(pupil);
        head.add(pupil);
        const sx = x > 0 ? 1 : -1;
        for (let k = 0; k < 3; k++) {
          const w = part(cyl, whiskerMat, [sx * 0.2, -0.07 + k * 0.03, 0.22], [0.005, 0.24, 0.005], [0, 0, sx * (Math.PI / 2 + (k - 1) * 0.18)]);
          head.add(w);
        }
      }
      mergeStaticMeshes(head, [...pupils, ...ears]);
      ears.forEach((e) => mergeStaticMeshes(e));
      body.add(head);

      // Curvy tail made of segments so it can swish.
      const tail = new THREE.Group();
      tail.position.set(0, 0.55, -0.5);
      const tailSegs: THREE.Object3D[] = [];
      let parent: THREE.Object3D = tail;
      for (let k = 0; k < 5; k++) {
        const seg = new THREE.Group();
        if (k > 0) seg.position.set(0, 0.14, 0);
        seg.rotation.x = k === 0 ? -0.9 : 0.25;
        seg.add(part(sphere, fur, [0, 0.07, 0], [0.055 - k * 0.004, 0.1, 0.055 - k * 0.004]));
        parent.add(seg);
        tailSegs.push(seg);
        parent = seg;
      }
      body.add(tail);

      mergeStaticMeshes(body, [paw, head, tail]);
      mergeStaticMeshes(paw);
      g.scale.setScalar(1.35);
      g.position.copy(hidePos);
      g.rotation.y = Math.atan2(facing.x, facing.z);
      this.group.add(g);

      this.cats.push({
        group: g,
        body,
        head,
        paw,
        tail,
        tailSegs,
        pupils,
        ears,
        bush,
        facing,
        hidePos,
        popPos,
        target: new THREE.Vector3(),
        from: new THREE.Vector3(),
        state: 'hide',
        timer: 0,
        phase: i * 1.7,
        cooldown: 0,
        warned: false,
      });
    });
  }

  public reset() {
    for (const c of this.cats) this.toHiding(c, 0);
    this.hasPrev = false;
  }

  private toHiding(c: Cat, cooldown: number) {
    c.state = 'hide';
    c.timer = 0;
    c.cooldown = cooldown;
    c.group.position.copy(c.hidePos);
    c.group.rotation.set(0, Math.atan2(c.facing.x, c.facing.z), 0);
    c.body.rotation.set(0, 0, 0);
    c.paw.rotation.set(0, 0, 0);
    c.head.rotation.set(0, 0, 0);
    c.ears.forEach((e, k) => {
      e.rotation.x = 0;
      e.rotation.z = k === 0 ? -0.3 : 0.3;
    });
    this.setPupils(c, 0.018);
  }

  private setPupils(c: Cat, width: number) {
    c.pupils.forEach((p) => (p.scale.x = width));
  }

  /** Updates cats near Whiskers. Returns what happened this frame. */
  public update(dt: number, player: THREE.Vector3): CatEvent[] {
    const events: CatEvent[] = [];
    if (this.hasPrev && dt > 0) {
      _v.subVectors(player, this.prevPlayer).divideScalar(dt);
      if (_v.lengthSq() < 900) this.playerVel.lerp(_v, Math.min(1, dt * 8));
    }
    this.prevPlayer.copy(player);
    this.hasPrev = true;

    for (const c of this.cats) {
      const g = c.group;
      const dx = c.popPos.x - player.x;
      const dz = c.popPos.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > 100 && c.state === 'hide') continue;
      c.phase += dt;
      c.timer += dt;
      c.cooldown = Math.max(0, c.cooldown - dt);
      // Tail always swishes, faster when excited.
      const excited = c.state === 'crouch' || c.state === 'pop' || c.state === 'leap';
      c.tailSegs.forEach((s, k) => {
        s.rotation.z = Math.sin(c.phase * (excited ? 9 : 2.2) - k * 0.6) * (excited ? 0.45 : 0.22);
      });

      switch (c.state) {
        case 'hide': {
          // Peek: slow blink, bush breathes.
          const blink = (c.phase % 4.2) < 0.15;
          c.pupils.forEach((p) => (p.scale.y = blink ? 0.01 : 0.07));
          c.bush.scale.setScalar(1 + Math.sin(c.phase * 1.3) * 0.015);
          // Glowing eyes follow Whiskers as he swims by: a hint that someone's in there.
          if (d < 30) this.faceToward(c, player, dt * 3);
          if (d > 40) c.warned = false;
          if (!c.warned && d < 16) {
            c.warned = true;
            events.push({ type: 'warn' });
          }
          if (c.cooldown <= 0 && d < this.tuning.trigger && player.y > -2.8) {
            c.state = 'pop';
            c.timer = 0;
            this.setPupils(c, 0.05);
            c.pupils.forEach((p) => (p.scale.y = 0.075));
            events.push({ type: 'pounce', at: c.popPos.clone() });
          }
          break;
        }
        case 'pop': {
          // Jump out of the bush to the water's edge.
          const t = Math.min(1, c.timer / 0.28);
          g.position.lerpVectors(c.hidePos, c.popPos, t);
          g.position.y += Math.sin(t * Math.PI) * 0.6;
          c.bush.scale.set(1 + Math.sin(c.timer * 40) * 0.08, 1 - Math.sin(c.timer * 40) * 0.06, 1);
          this.faceToward(c, player, dt * 12);
          if (t >= 1) {
            c.state = 'crouch';
            c.timer = 0;
            c.bush.scale.setScalar(1);
          }
          break;
        }
        case 'crouch': {
          // Low crouch and a butt wiggle: fair warning to swim away.
          this.faceToward(c, player, dt * 6);
          c.body.rotation.x = 0.12;
          c.body.rotation.z = Math.sin(c.timer * 26) * 0.08;
          g.position.y = c.popPos.y - 0.08;
          c.ears.forEach((e) => (e.rotation.x = -0.25));
          if (c.timer >= this.tuning.crouch) {
            // Aim where Whiskers is heading, within reach of the bank.
            c.target.copy(player).addScaledVector(this.playerVel, LEAP_TIME * this.tuning.lead);
            c.target.y = 0;
            _v.subVectors(c.target, c.popPos).setY(0);
            if (_v.length() > REACH) _v.setLength(REACH);
            c.target.set(c.popPos.x + _v.x, -0.15, c.popPos.z + _v.z);
            c.from.copy(g.position);
            c.state = 'leap';
            c.timer = 0;
            c.body.rotation.z = 0;
          }
          break;
        }
        case 'leap': {
          const t = Math.min(1, c.timer / LEAP_TIME);
          g.position.lerpVectors(c.from, c.target, t);
          g.position.y += 4 * 1.4 * t * (1 - t);
          c.body.rotation.x = -0.35 + t * 0.6;
          // Paw up high, then SWIPE.
          c.paw.rotation.x = t < 0.6 ? -2.4 * (t / 0.6) : -2.4 + ((t - 0.6) / 0.4) * 2.8;
          if (t >= 1) {
            const hit =
              Math.hypot(player.x - c.target.x, player.z - c.target.z) < CATCH_RADIUS && player.y > -3;
            c.timer = 0;
            c.paw.rotation.x = 0;
            if (hit) {
              events.push({ type: 'caught', at: c.target.clone() });
              c.from.copy(g.position);
              c.state = 'bounceBack';
            } else {
              events.push({ type: 'splash', at: c.target.clone() });
              c.state = 'swim';
              c.body.rotation.x = 0;
              this.setPupils(c, 0.065);
              c.pupils.forEach((p) => (p.scale.y = 0.09));
              c.ears.forEach((e, k) => (e.rotation.z = k === 0 ? -1.2 : 1.2)); // soggy, flat ears
            }
          }
          break;
        }
        case 'bounceBack': {
          // Backflip onto the bank, looking very pleased.
          const t = Math.min(1, c.timer / 0.45);
          g.position.lerpVectors(c.from, c.popPos, t);
          g.position.y += Math.sin(t * Math.PI) * 1.2;
          c.body.rotation.x = -t * Math.PI * 2;
          if (t >= 1) {
            c.body.rotation.x = 0;
            c.state = 'smug';
            c.timer = 0;
            this.setPupils(c, 0.018);
          }
          break;
        }
        case 'smug': {
          // Sit and lick a paw.
          c.paw.rotation.x = -1.6 + Math.sin(c.timer * 9) * 0.25;
          c.head.rotation.x = 0.25;
          if (c.timer > 1.6) {
            c.paw.rotation.x = 0;
            c.head.rotation.x = 0;
            c.state = 'sulk';
            c.timer = 0;
            c.from.copy(g.position);
          }
          break;
        }
        case 'swim': {
          // Soggy cat paddles back to the bank, head just above the water.
          _v.subVectors(c.popPos, g.position).setY(0);
          const left = _v.length();
          if (left > 0.05) {
            g.rotation.y = Math.atan2(_v.x, _v.z);
            g.position.addScaledVector(_v.normalize(), Math.min(left, 1.5 * dt));
          }
          g.position.y = -0.62 + Math.sin(c.timer * 8) * 0.05;
          c.paw.rotation.x = Math.sin(c.timer * 14) * 0.9;
          if (left < 0.3 || c.timer > 5) {
            c.state = 'shake';
            c.timer = 0;
            g.position.copy(c.popPos);
            events.push({ type: 'shake', at: g.position.clone().setY(g.position.y + 0.8) });
          }
          break;
        }
        case 'shake': {
          c.paw.rotation.x = 0;
          c.body.rotation.z = Math.sin(c.timer * 45) * 0.3;
          if (c.timer > 0.7) {
            c.body.rotation.z = 0;
            c.state = 'sulk';
            c.timer = 0;
            c.from.copy(g.position);
          }
          break;
        }
        case 'sulk': {
          // Slink back into the bush.
          const t = Math.min(1, c.timer / 0.6);
          g.position.lerpVectors(c.from, c.hidePos, t);
          if (t >= 1) {
            c.warned = true;
            this.toHiding(c, 12);
          }
          break;
        }
      }
    }
    return events;
  }

  private faceToward(c: Cat, p: THREE.Vector3, k: number) {
    const want = Math.atan2(p.x - c.group.position.x, p.z - c.group.position.z);
    let diff = want - c.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.group.rotation.y += diff * Math.min(1, k);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
