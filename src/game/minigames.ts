import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt, RiverWorld } from './worldGen';
import { Sparkles } from './sparkles';

/**
 * Two family mini-games:
 * - Dolphin race: swim between the green start buoys and a pink dolphin races Whiskers to the
 *   checkered finish buoys. Zoom to win.
 * - Hide-and-seek: in the Grand Lake, little brother Pip hides. Bubbles rise where he is, and
 *   Sniff shows which way to go.
 */
export const RACE_START = 2195;
export const RACE_FINISH = 2340;

export interface RaceProgress {
  whiskers: number;
  dolphin: number;
  /** Who Whiskers is racing, for the race bar: the dolphin when not set, nobody when 'none'. */
  rivalIcon?: string;
  rivalLabel?: string;
}

function checkerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#111111' : '#ffffff';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** Green start buoys and checkered finish buoys on both sides of the river. Returns what to dispose. */
export function addRaceGates(group: THREE.Group, start: number, finish: number, halfWidth = 8): { dispose: () => void }[] {
  const red = new THREE.MeshStandardMaterial({ color: '#ff4a3d', roughness: 0.45 });
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 });
  const pole = new THREE.MeshStandardMaterial({ color: '#555b66', roughness: 0.6 });
  const green = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.5, side: THREE.DoubleSide });
  const checker = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6, side: THREE.DoubleSide });
  const cyl = new THREE.CylinderGeometry(0.55, 0.65, 0.45, 18);
  const top = new THREE.SphereGeometry(0.35, 16, 10);
  const stick = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
  const flag = new THREE.PlaneGeometry(0.9, 0.6);

  const buoy = (dist: number, lateral: number, flagMat: THREE.Material) => {
    const { position, normal } = getRiverPath(dist);
    const b = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(cyl, k % 2 === 0 ? red : white);
      m.position.y = -0.35 + k * 0.42;
      m.scale.setScalar(1 - k * 0.12);
      b.add(m);
    }
    const t = new THREE.Mesh(top, red);
    t.position.y = 0.75;
    b.add(t);
    const s = new THREE.Mesh(stick, pole);
    s.position.y = 1.7;
    b.add(s);
    const f = new THREE.Mesh(flag, flagMat);
    f.position.set(0.45, 2.3, 0);
    b.add(f);
    b.position.set(position.x + normal.x * lateral, 0, position.z + normal.z * lateral);
    group.add(b);
  };
  for (const side of [-1, 1]) {
    buoy(start, side * halfWidth, green);
    buoy(finish, side * halfWidth, checker);
  }
  return [red, white, pole, green, checker, checker.map!, cyl, top, stick, flag];
}

export class DolphinRace {
  public group = new THREE.Group();
  public state: 'waiting' | 'racing' | 'done' = 'waiting';
  private dolphin: THREE.Object3D;
  private fluke: THREE.Object3D | null;
  private dolphinDist = 0;
  private dolphinLateral = 0;
  private phase = 0;
  private doneTimer = 0;
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene, template: { group: THREE.Group; tailFluke: THREE.Mesh }) {
    scene.add(this.group);
    this.disposables.push(...addRaceGates(this.group, RACE_START, RACE_FINISH));

    // The racing dolphin is a copy of one of the river's pink dolphins.
    const flukeIndex = template.group.children.indexOf(template.tailFluke);
    this.dolphin = template.group.clone(true);
    this.fluke = flukeIndex >= 0 ? this.dolphin.children[flukeIndex] : null;
    this.dolphin.visible = false;
    scene.add(this.dolphin);
  }

  public reset() {
    this.state = 'waiting';
    this.dolphin.visible = false;
  }

  /**
   * Returns 'start' | 'win' | 'lose' on the frame those happen, plus both racers' progress
   * (0..1) while racing.
   */
  public update(
    dt: number,
    prevDist: number,
    playerDist: number,
    playerLateral: number,
    dolphinSpeed: number
  ): { event: 'start' | 'win' | 'lose' | null; progress: RaceProgress | null } {
    let event: 'start' | 'win' | 'lose' | null = null;
    const span = RACE_FINISH - RACE_START;

    if (this.state === 'waiting') {
      if (prevDist < RACE_START && playerDist >= RACE_START && playerDist < RACE_START + 20) {
        this.state = 'racing';
        this.dolphinDist = playerDist;
        this.dolphinLateral = playerLateral + (playerLateral > 0 ? -3.5 : 3.5);
        this.phase = 0;
        this.dolphin.visible = true;
        event = 'start';
      }
    } else if (this.state === 'racing') {
      this.dolphinDist += dolphinSpeed * dt;
      if (playerDist >= RACE_FINISH) {
        this.state = 'done';
        this.doneTimer = 0;
        event = 'win';
      } else if (this.dolphinDist >= RACE_FINISH) {
        this.state = 'done';
        this.doneTimer = 0;
        event = 'lose';
      } else if (playerDist < RACE_START - 10) {
        this.reset();
      }
    } else if (this.state === 'done') {
      this.doneTimer += dt;
      this.dolphinDist = Math.min(this.dolphinDist + dolphinSpeed * 0.4 * dt, RACE_FINISH + 25);
      if (this.doneTimer > 5) this.dolphin.visible = false;
    }

    if (this.dolphin.visible) {
      this.phase += dt;
      const { position, normal, tangent } = getRiverPath(this.dolphinDist);
      // Playful jumps out of the water while racing.
      const jump = Math.max(0, Math.sin(this.phase * 2.1));
      this.dolphin.position.set(
        position.x + normal.x * this.dolphinLateral,
        -1.1 + jump * 1.9,
        position.z + normal.z * this.dolphinLateral
      );
      this.dolphin.rotation.set(-Math.cos(this.phase * 2.1) * 0.45 * (jump > 0 ? 1 : 0.3), Math.atan2(tangent.x, tangent.z), 0);
      if (this.fluke) this.fluke.rotation.x = Math.sin(this.phase * 9) * 0.4;
    }

    const progress =
      this.state === 'racing'
        ? {
            whiskers: THREE.MathUtils.clamp((playerDist - RACE_START) / span, 0, 1),
            dolphin: THREE.MathUtils.clamp((this.dolphinDist - RACE_START) / span, 0, 1),
          }
        : null;
    return { event, progress };
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
    this.dolphin.parent?.remove(this.dolphin);
  }
}

/** Where Pip can hide in the Grand Lake: [river distance, side offset]. */
const HIDING_SPOTS: [number, number][] = [
  [2525, 14],
  [2470, -30],
  [2640, 36],
  [2700, -24],
  [2590, -8],
  [2780, 22],
  [2860, -16],
  [2560, 42],
];

export class HideAndSeek {
  public active = false;
  private spot = new THREE.Vector3();
  private lastSpot = -1;
  private bubbleTimer = 0;
  private nearAnnounced = false;

  /** Picks a hiding place away from Whiskers and sends Pip there. Returns false if none fits. */
  public start(world: RiverWorld, player: THREE.Vector3): boolean {
    const pip = world.pipIndex;
    if (pip < 0) return false;
    const order = HIDING_SPOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    for (const i of order) {
      if (i === this.lastSpot) continue;
      const [dist, lateral] = HIDING_SPOTS[i];
      const bed = getRiverBedElevationAt(dist, lateral);
      if (bed > -1.6) continue;
      const { position, normal } = getRiverPath(dist);
      const x = position.x + normal.x * lateral;
      const z = position.z + normal.z * lateral;
      if (Math.hypot(x - player.x, z - player.z) < 18) continue;
      this.spot.set(x, Math.max(bed + 0.7, -2.2), z);
      this.lastSpot = i;
      this.active = true;
      this.nearAnnounced = false;
      this.bubbleTimer = 0;
      world.setFamilyHiding(pip, this.spot);
      return true;
    }
    return false;
  }

  public stop(world: RiverWorld) {
    if (!this.active) return;
    this.active = false;
    const pip = world.pipIndex;
    if (pip >= 0) world.setFamilyHiding(pip, null);
  }

  /** Bubbles rise from Pip's hiding place; reports 'near' once and 'found' when reached. */
  public update(dt: number, world: RiverWorld, player: THREE.Vector3, sparkles: Sparkles): 'near' | 'found' | null {
    if (!this.active) return null;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 1.3;
      sparkles.burst(this.spot, ['#e6fbff', '#bff6ff', '#ffffff'], 4, 0.5, 1.6);
    }
    const d = Math.hypot(this.spot.x - player.x, this.spot.z - player.z);
    if (d < 3.4) {
      this.stop(world);
      return 'found';
    }
    if (!this.nearAnnounced && d < 12) {
      this.nearAnnounced = true;
      return 'near';
    }
    return null;
  }

  /** Sniff hint: a short trail of golden sparkles pointing toward Pip. */
  public showDirection(player: THREE.Vector3, sparkles: Sparkles) {
    if (!this.active) return;
    const dx = this.spot.x - player.x;
    const dz = this.spot.z - player.z;
    const len = Math.hypot(dx, dz) || 1;
    const p = new THREE.Vector3();
    for (let k = 1; k <= 6; k++) {
      p.set(player.x + (dx / len) * k * 1.4, player.y + 0.3, player.z + (dz / len) * k * 1.4);
      sparkles.burst(p, ['#ffd23f', '#fff3b0'], 3, 0.35, 0.2);
    }
  }
}
