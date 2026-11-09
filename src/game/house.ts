import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';
import { mergeStaticMeshes } from './perf';
import { FRIENDS, FriendKind } from './friends';

/**
 * Whiskers' fish house in the Grand Lake. Its pointy shell roof pokes out of the water so it's
 * easy to find. Swim in through the round door to visit: decorate it with stars, see the
 * treasures you found on the trophy shelf and your friends on the picture wall, and tap the
 * clamshell bed for bedtime.
 */
export interface HouseItem {
  id: string;
  name: string;
  icon: string;
  price: number;
}

export const HOUSE_ITEMS: HouseItem[] = [
  { id: 'rug', name: 'Shell rug', icon: '🐚', price: 5 },
  { id: 'plant', name: 'Seaweed plant', icon: '🌿', price: 6 },
  { id: 'starfish', name: 'Starfish picture', icon: '⭐', price: 7 },
  { id: 'lamp', name: 'Coral lamp', icon: '🪸', price: 8 },
  { id: 'boat', name: 'Toy boat', icon: '⛵', price: 9 },
  { id: 'bubbles', name: 'Bubble machine', icon: '🫧', price: 10 },
  { id: 'chest', name: 'Treasure chest', icon: '💰', price: 12 },
  { id: 'chandelier', name: 'Pearl chandelier', icon: '💡', price: 15 },
];

export interface HouseState {
  owned: string[];
  spent: number;
}

const HOUSE_KEY = 'whiskers_house_v1';

export function loadHouse(): HouseState {
  try {
    const raw = JSON.parse(localStorage.getItem(HOUSE_KEY) || '{}');
    const valid = new Set(HOUSE_ITEMS.map((i) => i.id));
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((id: unknown) => typeof id === 'string' && valid.has(id)) : [];
    return { owned, spent: Math.max(0, Number(raw.spent) || 0) };
  } catch {
    return { owned: [], spent: 0 };
  }
}

export function saveHouse(state: HouseState) {
  try {
    localStorage.setItem(HOUSE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export type HouseView = 'room' | 'trophies' | 'friends' | 'bed';

export interface TrophyCounts {
  smoothStones: number;
  shimmeringScales: number;
  lostTrinkets: number;
  riverPearls: number;
}

const HOUSE_DIST = 2690;
const HOUSE_LATERAL = -36;
const R = 6;
const DOOR_HALF_ANGLE = 0.26; // the round door is about 3 m wide

type PartFn = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r?: number[]) => THREE.Mesh;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function labelTexture(text: string, w = 128, h = 64, font = 'bold 40px system-ui, sans-serif', bg = 'rgba(255,255,255,0.92)', fg = '#1e3a5f') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  roundedRect(ctx, 2, 2, w - 4, h - 4, Math.min(h / 2.4, w / 2.4));
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FishHouse {
  public group = new THREE.Group();
  /** Everything inside, in a frame where +Z points out of the door. */
  private room = new THREE.Group();
  public center = new THREE.Vector3();
  public doorDir = new THREE.Vector3();
  public floorY = 0;
  private ceilY = 4;
  private decor = new Map<string, THREE.Object3D>();
  private trophyLabels: THREE.Sprite[] = [];
  private trophyRows: THREE.Object3D[][] = [];
  private frames: { kind: FriendKind; mat: THREE.MeshBasicMaterial }[] = [];
  private loadedPictures = new Map<FriendKind, string>();
  private bubbles: THREE.Mesh[] = [];
  private chandelier: THREE.Object3D | null = null;
  private disposables: { dispose: () => void }[] = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const { position, normal } = getRiverPath(HOUSE_DIST);
    this.center.set(position.x + normal.x * HOUSE_LATERAL, 0, position.z + normal.z * HOUSE_LATERAL);
    this.doorDir.set(normal.x, 0, normal.z).normalize(); // toward the middle of the lake
    // Floor sits just above the highest bit of lakebed under the house.
    let top = -Infinity;
    for (const dd of [-6, 0, 6]) for (const dl of [-6, 0, 6]) top = Math.max(top, getRiverBedElevationAt(HOUSE_DIST + dd, HOUSE_LATERAL + dl));
    this.floorY = top + 0.1;
    this.room.position.set(this.center.x, this.floorY, this.center.z);
    this.room.rotation.y = Math.atan2(this.doorDir.x, this.doorDir.z);
    this.group.add(this.room);
    this.build();
  }

  private mat(params: THREE.MeshStandardMaterialParameters) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.7, ...params });
    this.disposables.push(m);
    return m;
  }

  private build() {
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 18);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cone = new THREE.ConeGeometry(1, 1, 14);
    this.disposables.push(sphere, cyl, box, cone);
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p[0], p[1], p[2]);
      m.scale.set(s[0], s[1], s[2]);
      m.rotation.set(r[0], r[1], r[2]);
      return m;
    };

    const wallH = -this.floorY + 0.7; // walls reach just above the water
    const skirt = 2.0; // walls go a bit below the floor so there's no gap over the sloping lakebed
    this.ceilY = Math.min(4.6, wallH - 0.95); // ceiling stays under the water surface
    const outer = this.mat({ color: '#ffb48f', roughness: 0.8 });
    const inner = this.mat({ color: '#ffe7c7', roughness: 0.9, side: THREE.BackSide });
    const trim = this.mat({ color: '#ff7f6b', roughness: 0.6 });
    const roofMat = this.mat({ color: '#ffd7e6', roughness: 0.55 });
    const roofStripe = this.mat({ color: '#ff8fb8', roughness: 0.55 });
    const glow = this.mat({ color: '#fff3b0', emissive: '#ffcf4d', emissiveIntensity: 1.1 });
    const sand = this.mat({ color: '#f1dcaa', roughness: 1 });
    const wood = this.mat({ color: '#b97a4c', roughness: 0.8 });
    const shell = new THREE.Group();

    // Walls with a gap for the round door (cylinder angle 0 is +Z, where the door faces).
    const wallGeo = new THREE.CylinderGeometry(R, R, wallH + skirt, 48, 1, true, DOOR_HALF_ANGLE, Math.PI * 2 - DOOR_HALF_ANGLE * 2);
    const wallInGeo = new THREE.CylinderGeometry(R - 0.25, R - 0.25, wallH + skirt, 48, 1, true, DOOR_HALF_ANGLE, Math.PI * 2 - DOOR_HALF_ANGLE * 2);
    this.disposables.push(wallGeo, wallInGeo);
    const wallOut = new THREE.Mesh(wallGeo, outer);
    const wallIn = new THREE.Mesh(wallInGeo, inner);
    wallOut.position.y = wallIn.position.y = (wallH - skirt) / 2;
    shell.add(wallOut, wallIn);
    // Door arch and round windows.
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.22, 10, 24, Math.PI), trim);
    this.disposables.push(arch.geometry);
    arch.position.set(0, 2.4, R - 0.05);
    shell.add(arch);
    shell.add(part(box, trim, [-1.55, 1.2, R - 0.05], [0.44, 2.4, 0.44]));
    shell.add(part(box, trim, [1.55, 1.2, R - 0.05], [0.44, 2.4, 0.44]));
    const ring = new THREE.TorusGeometry(0.62, 0.12, 8, 20);
    const pane = new THREE.CircleGeometry(0.6, 20);
    this.disposables.push(ring, pane);
    for (const a of [0.9, 2.1, -0.9, -2.1, Math.PI]) {
      const x = Math.sin(a) * (R + 0.02);
      const z = Math.cos(a) * (R + 0.02);
      const w = new THREE.Mesh(pane, glow);
      w.position.set(x, 2.6, z);
      w.rotation.y = a;
      const fr = new THREE.Mesh(ring, trim);
      fr.position.copy(w.position);
      fr.rotation.y = a;
      // The same window seen from inside.
      const wi = new THREE.Mesh(pane, glow);
      wi.position.set(Math.sin(a) * (R - 0.27), 2.6, Math.cos(a) * (R - 0.27));
      wi.rotation.y = a + Math.PI;
      shell.add(w, fr, wi);
    }
    // Pointy spiral-shell roof above the water, with a little fish flag on top.
    const roofBase = wallH;
    shell.add(part(cone, roofMat, [0, roofBase + 2.4, 0], [R + 0.7, 4.8, R + 0.7]));
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      const tor = new THREE.Mesh(new THREE.TorusGeometry((R + 0.6) * (1 - t * 0.95) * 0.98, 0.16, 6, 36), roofStripe);
      this.disposables.push(tor.geometry);
      tor.rotation.x = Math.PI / 2;
      tor.position.y = roofBase + 0.15 + t * 4.6;
      shell.add(tor);
    }
    shell.add(part(cyl, wood, [0, roofBase + 5.6, 0], [0.06, 1.8, 0.06]));
    shell.add(part(sphere, trim, [0.45, roofBase + 6.1, 0], [0.42, 0.24, 0.06]));
    shell.add(part(cone, trim, [-0.05, roofBase + 6.1, 0], [0.22, 0.3, 0.06], [0, 0, Math.PI / 2]));
    // Sandy floor and a ceiling just under the water surface.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 40), sand);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 40), this.mat({ color: '#ffd9b8', roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = this.ceilY;
    this.disposables.push(floor.geometry, ceil.geometry);
    shell.add(floor, ceil);
    mergeStaticMeshes(shell);
    this.room.add(shell);

    // Sign over the door.
    const signTex = labelTexture("Whiskers' House", 512, 128, 'bold 64px system-ui, sans-serif', '#fff6e0', '#c2410c');
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signGeo = new THREE.PlaneGeometry(3.6, 0.9);
    this.disposables.push(signTex, signMat, signGeo);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 4.35, R + 0.12);
    this.room.add(sign);

    this.buildBed(part, box);
    this.buildFriendsWall(box, wood);
    this.buildTrophyShelf(part, sphere, cyl, box, wood);
    this.buildDecor(part, sphere, cyl, box, cone);
  }

  private buildBed(part: PartFn, box: THREE.BufferGeometry) {
    const pink = this.mat({ color: '#ffb3c7', roughness: 0.45 });
    const pinkIn = this.mat({ color: '#fff0f4', roughness: 0.4, side: THREE.DoubleSide });
    const sponge = this.mat({ color: '#ffe066', roughness: 0.9 });
    const blanket = this.mat({ color: '#7cc8ff', roughness: 0.8 });
    const bed = new THREE.Group();
    const half = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    this.disposables.push(half);
    const bottom = new THREE.Mesh(half, pink);
    bottom.scale.set(1.5, 0.55, 1.2);
    bottom.position.y = 0.6;
    const lid = new THREE.Mesh(half, pinkIn);
    lid.scale.set(1.5, 0.55, 1.2);
    lid.rotation.set(Math.PI + 0.9, 0, 0);
    lid.position.set(0, 0.7, -1.0);
    bed.add(bottom, lid);
    bed.add(part(box, sponge, [0, 0.72, -0.6], [1.0, 0.25, 0.45]));
    bed.add(part(box, blanket, [0, 0.66, 0.35], [1.9, 0.12, 1.3]));
    mergeStaticMeshes(bed);
    bed.position.set(-4.0, 0, -0.8);
    bed.rotation.y = Math.PI / 2;
    this.room.add(bed);
  }

  private buildFriendsWall(box: THREE.BufferGeometry, wood: THREE.Material) {
    const wall = new THREE.Group();
    const board = new THREE.Mesh(box, wood);
    board.scale.set(3.9, 3.0, 0.1);
    board.position.set(0, 2.3, 0);
    wall.add(board);
    const plane = new THREE.PlaneGeometry(1.0, 1.0);
    const frameMat = this.mat({ color: '#fff2c4', roughness: 0.6 });
    this.disposables.push(plane);
    FRIENDS.forEach((f, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - 1) * 1.22;
      const y = 3.3 - row * 1.0;
      const frame = new THREE.Mesh(box, frameMat);
      frame.scale.set(1.08, 0.9, 0.06);
      frame.position.set(x, y, 0.07);
      const mat = new THREE.MeshBasicMaterial({ color: '#9fb6c8', transparent: true });
      this.disposables.push(mat);
      const pic = new THREE.Mesh(plane, mat);
      pic.scale.set(0.95, 0.8, 1);
      pic.position.set(x, y, 0.11);
      wall.add(frame, pic);
      this.frames.push({ kind: f.kind, mat });
    });
    wall.position.set(-2.3, 0, -5.15);
    wall.rotation.y = 0.42;
    this.room.add(wall);
  }

  private buildTrophyShelf(
    part: PartFn,
    sphere: THREE.BufferGeometry,
    cyl: THREE.BufferGeometry,
    box: THREE.BufferGeometry,
    wood: THREE.Material
  ) {
    const shelf = new THREE.Group();
    shelf.add(part(box, wood, [0, 2.2, -0.12], [3.8, 3.4, 0.1]));
    for (const y of [0.9, 1.85, 2.8, 3.75]) shelf.add(part(box, wood, [0, y, 0.18], [3.8, 0.1, 0.6]));
    const stone = this.mat({ color: '#9aa3ad', roughness: 0.9 });
    const scale = this.mat({ color: '#9ff0ff', roughness: 0.2, metalness: 0.6, emissive: '#2aa6c0', emissiveIntensity: 0.3 });
    const gold = this.mat({ color: '#ffcf3a', roughness: 0.3, metalness: 0.7 });
    const pearl = this.mat({ color: '#fffaf0', roughness: 0.15, metalness: 0.2, emissive: '#fff0f8', emissiveIntensity: 0.25 });
    const makers: (() => THREE.Object3D)[] = [
      () => part(sphere, stone, [0, 0.11, 0], [0.18, 0.1, 0.14]),
      () => part(cyl, scale, [0, 0.16, 0], [0.15, 0.025, 0.15], [Math.PI / 2.4, 0, 0]),
      () => {
        const g = new THREE.Group();
        g.add(part(cyl, gold, [0, 0.14, 0], [0.14, 0.03, 0.14], [Math.PI / 2.2, 0, 0]));
        g.add(part(sphere, gold, [0, 0.3, 0], [0.04, 0.04, 0.04]));
        return g;
      },
      () => part(sphere, pearl, [0, 0.12, 0], [0.12, 0.12, 0.12]),
    ];
    const shelfY = [0.95, 1.9, 2.85, 3.8];
    makers.forEach((make, row) => {
      const items: THREE.Object3D[] = [];
      for (let k = 0; k < 6; k++) {
        const it = make();
        it.position.set(-1.6 + k * 0.42, shelfY[row], 0.22);
        it.visible = false;
        shelf.add(it);
        items.push(it);
      }
      this.trophyRows.push(items);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('×0'), depthWrite: false }));
      this.disposables.push(label.material);
      label.scale.set(0.6, 0.3, 1);
      label.position.set(1.45, shelfY[row] + 0.25, 0.3);
      shelf.add(label);
      this.trophyLabels.push(label);
    });
    shelf.position.set(2.3, 0, -5.15);
    shelf.rotation.y = -0.42;
    this.room.add(shelf);
  }

  private buildDecor(
    part: PartFn,
    sphere: THREE.BufferGeometry,
    cyl: THREE.BufferGeometry,
    box: THREE.BufferGeometry,
    cone: THREE.BufferGeometry
  ) {
    const add = (id: string, g: THREE.Object3D, keep: THREE.Object3D[] = []) => {
      if (g instanceof THREE.Group) mergeStaticMeshes(g, keep);
      g.visible = false;
      this.decor.set(id, g);
      this.room.add(g);
    };

    // Shell rug: a big round rug with sunray stripes.
    {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d')!;
      for (let k = 0; k < 16; k++) {
        ctx.fillStyle = k % 2 ? '#ff9ec4' : '#ffd1e3';
        ctx.beginPath();
        ctx.moveTo(128, 128);
        ctx.arc(128, 128, 128, (k / 16) * Math.PI * 2, ((k + 1) / 16) * Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3f8';
      ctx.beginPath();
      ctx.arc(128, 128, 30, 0, Math.PI * 2);
      ctx.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
      const geo = new THREE.CircleGeometry(2.1, 40);
      this.disposables.push(tex, m, geo);
      const rug = new THREE.Mesh(geo, m);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.05, -0.6);
      add('rug', rug);
    }
    // Seaweed plant in a pot.
    {
      const g = new THREE.Group();
      g.add(part(cyl, this.mat({ color: '#d9734e' }), [0, 0.35, 0], [0.45, 0.7, 0.45]));
      const leaf = this.mat({ color: '#3fbf6a', roughness: 0.6 });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.add(part(sphere, leaf, [Math.cos(a) * 0.18, 1.2 + (k % 3) * 0.2, Math.sin(a) * 0.18], [0.1, 0.75 + (k % 2) * 0.25, 0.05], [Math.sin(a) * 0.25, a, Math.cos(a) * 0.25]));
      }
      g.position.set(3.7, 0, 2.2);
      add('plant', g);
    }
    // Starfish picture on the wall above the bed.
    {
      const shape = new THREE.Shape();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.28 : 0.7;
        const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
        if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
      this.disposables.push(geo);
      const star = new THREE.Mesh(geo, this.mat({ color: '#ff9a3c', roughness: 0.6 }));
      star.position.set(-5.55, 2.9, -0.8);
      star.rotation.y = Math.PI / 2;
      add('starfish', star);
    }
    // Coral lamp with a glowing bulb.
    {
      const g = new THREE.Group();
      const coral = this.mat({ color: '#ff6f91', roughness: 0.5 });
      g.add(part(cyl, coral, [0, 0.6, 0], [0.12, 1.2, 0.12]));
      g.add(part(cyl, coral, [0.25, 1.1, 0], [0.08, 0.6, 0.08], [0, 0, -0.6]));
      g.add(part(cyl, coral, [-0.22, 1.0, 0.05], [0.08, 0.55, 0.08], [0, 0, 0.6]));
      g.add(part(sphere, this.mat({ color: '#fff6c2', emissive: '#ffd36b', emissiveIntensity: 1.6 }), [0, 1.45, 0], [0.32, 0.32, 0.32]));
      g.position.set(4.3, 0, -2.4);
      add('lamp', g);
    }
    // Toy sailboat.
    {
      const g = new THREE.Group();
      g.add(part(box, this.mat({ color: '#e14b3b' }), [0, 0.25, 0], [1.1, 0.35, 0.45]));
      g.add(part(cyl, this.mat({ color: '#7a4a2a' }), [0, 0.9, 0], [0.04, 1.1, 0.04]));
      g.add(part(cone, this.mat({ color: '#ffffff', side: THREE.DoubleSide }), [0.22, 0.95, 0], [0.4, 0.9, 0.02], [0, 0, 0]));
      g.position.set(1.9, 0, 1.2);
      g.rotation.y = -0.6;
      add('boat', g);
    }
    // Bubble machine (bubbles float up while you visit).
    {
      const g = new THREE.Group();
      g.add(part(box, this.mat({ color: '#5bc0eb' }), [0, 0.35, 0], [0.7, 0.7, 0.7]));
      g.add(part(cyl, this.mat({ color: '#ffd166' }), [0, 0.85, 0], [0.12, 0.3, 0.12]));
      const bubMat = new THREE.MeshStandardMaterial({ color: '#e9fbff', transparent: true, opacity: 0.55, roughness: 0.1 });
      this.disposables.push(bubMat);
      const keep: THREE.Object3D[] = [];
      for (let k = 0; k < 8; k++) {
        const b = part(sphere, bubMat, [0, 1, 0], [0.1, 0.1, 0.1]);
        b.userData.phase = k / 8;
        g.add(b);
        keep.push(b);
        this.bubbles.push(b);
      }
      g.position.set(-3.3, 0, 2.6);
      add('bubbles', g, keep);
    }
    // Treasure chest full of gold.
    {
      const g = new THREE.Group();
      const woodD = this.mat({ color: '#8a5a33' });
      const gold = this.mat({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 });
      g.add(part(box, woodD, [0, 0.35, 0], [1.1, 0.7, 0.7]));
      g.add(part(box, woodD, [0, 0.95, -0.42], [1.1, 0.7, 0.1], [-0.5, 0, 0]));
      for (let k = 0; k < 7; k++) g.add(part(sphere, gold, [-0.4 + k * 0.13, 0.75 + (k % 2) * 0.05, (k % 3) * 0.1 - 0.1], [0.12, 0.05, 0.12]));
      g.position.set(4.3, 0, 0.5);
      g.rotation.y = -Math.PI / 2;
      add('chest', g);
    }
    // Pearl chandelier hanging from the ceiling.
    {
      const g = new THREE.Group();
      const pearl = this.mat({ color: '#fffaf2', emissive: '#fff4e0', emissiveIntensity: 0.6, roughness: 0.15 });
      const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 6, 24);
      this.disposables.push(ringGeo);
      const ring = new THREE.Mesh(ringGeo, this.mat({ color: '#ffd166', metalness: 0.6, roughness: 0.3 }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        g.add(part(sphere, pearl, [Math.cos(a) * 0.8, -0.18, Math.sin(a) * 0.8], [0.13, 0.13, 0.13]));
      }
      g.add(part(sphere, pearl, [0, -0.35, 0], [0.22, 0.22, 0.22]));
      g.add(part(cyl, this.mat({ color: '#ffd166' }), [0, 0.5, 0], [0.03, 1.0, 0.03]));
      g.position.set(0, this.ceilY - 1.0, -0.6);
      this.chandelier = g;
      add('chandelier', g);
    }
  }

  /** Show the decorations Whiskers owns. */
  public setOwned(owned: string[]) {
    this.decor.forEach((obj, id) => (obj.visible = owned.includes(id)));
  }

  /** Fill the trophy shelf (up to 6 of each, plus a count). */
  public setTrophies(c: TrophyCounts) {
    const counts = [c.smoothStones, c.shimmeringScales, c.lostTrinkets, c.riverPearls];
    counts.forEach((n, row) => {
      this.trophyRows[row].forEach((it, k) => (it.visible = k < n));
      const label = this.trophyLabels[row];
      const mat = label.material as THREE.SpriteMaterial;
      const old = mat.map;
      mat.map = labelTexture(`×${n}`);
      mat.needsUpdate = true;
      old?.dispose();
    });
  }

  /** Put each friend's sticker picture in its frame (unmet friends stay a gray "?" card). */
  public setFriendPictures(met: FriendKind[], pictures: Partial<Record<FriendKind, string>>) {
    const loader = new THREE.TextureLoader();
    for (const f of this.frames) {
      const url = pictures[f.kind];
      if (met.includes(f.kind) && url) {
        if (this.loadedPictures.get(f.kind) === url) continue;
        this.loadedPictures.set(f.kind, url);
        loader.load(url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          f.mat.map?.dispose();
          f.mat.map = tex;
          f.mat.color.set('#ffffff');
          f.mat.needsUpdate = true;
        });
      } else if (!this.loadedPictures.has(f.kind) && !f.mat.map) {
        f.mat.map = labelTexture('?', 128, 128, 'bold 90px system-ui, sans-serif', '#c7d6e2', '#6b8296');
        f.mat.needsUpdate = true;
      }
    }
  }

  /** True when Whiskers is swimming in through the door. */
  public isAtDoor(p: THREE.Vector3): boolean {
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    const d = Math.hypot(dx, dz);
    if (d > R + 1.6 || d < 0.01) return false;
    return (dx * this.doorDir.x + dz * this.doorDir.z) / d > Math.cos(DOOR_HALF_ANGLE * 1.6);
  }

  /** True when Whiskers would swim into the walls from outside (not through the door). */
  public hitsWall(p: THREE.Vector3): boolean {
    return Math.hypot(p.x - this.center.x, p.z - this.center.z) < R + 1.0;
  }

  /** Where to put the camera and Whiskers for each view inside the house. */
  public viewPose(view: HouseView, t: number) {
    const local = {
      room: { cam: [0, 2.4, 5.1], look: [0, 1.6, -3.6] },
      trophies: { cam: [0.6, 2.3, -0.8], look: [2.3, 2.2, -5.2] },
      friends: { cam: [-0.6, 2.3, -0.8], look: [-2.3, 2.3, -5.2] },
      bed: { cam: [-0.4, 2.4, 2.2], look: [-4.0, 0.9, -0.8] },
    }[view];
    const cam = this.room.localToWorld(new THREE.Vector3(local.cam[0], local.cam[1], local.cam[2]));
    const look = this.room.localToWorld(new THREE.Vector3(local.look[0], local.look[1], local.look[2]));
    let whiskers: THREE.Vector3;
    let yaw: number;
    if (view === 'bed') {
      // Tucked in, head on the sponge pillow by the wall.
      whiskers = this.room.localToWorld(new THREE.Vector3(-3.9, 1.05, -0.8));
      yaw = this.room.rotation.y - Math.PI / 2;
    } else {
      // Little laps: in the middle of the room, or off to the side while looking at a wall.
      const c = view === 'trophies' ? [-2.2, 1.6] : view === 'friends' ? [2.2, 1.6] : [0, -1.7];
      const rx = view === 'room' ? 1.3 : 0.9;
      const rz = view === 'room' ? 0.8 : 0.7;
      const a = t * 0.6;
      whiskers = this.room.localToWorld(new THREE.Vector3(c[0] + Math.sin(a) * rx, 1.4 + Math.sin(t * 1.3) * 0.12, c[1] + Math.cos(a) * rz));
      yaw = this.room.rotation.y + Math.atan2(Math.cos(a) * rx, -Math.sin(a) * rz);
    }
    return { cam, look, whiskers, yaw };
  }

  /** Just outside the door, facing out into the lake. */
  public exitPose() {
    return {
      pos: new THREE.Vector3(this.center.x + this.doorDir.x * (R + 9), -1.6, this.center.z + this.doorDir.z * (R + 9)),
      heading: Math.atan2(this.doorDir.x, this.doorDir.z),
    };
  }

  public update(dt: number) {
    this.time += dt;
    this.bubbles.forEach((b) => {
      const t = (this.time * 0.35 + b.userData.phase) % 1;
      b.position.set(Math.sin(t * 9 + b.userData.phase * 6) * 0.15, 1 + t * 3, Math.cos(t * 7) * 0.1);
      b.scale.setScalar(0.06 + t * 0.08);
    });
    if (this.chandelier) this.chandelier.rotation.y = Math.sin(this.time * 0.6) * 0.15;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
