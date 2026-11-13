import * as THREE from 'three';
import { getRiverPath } from './worldGen';
import { addRaceGates, RaceProgress } from './minigames';
import { activeProfile, otherPlayersValue } from './profiles';

/**
 * Ghost race (for Skylar and her cousin): a short course near the start of the river. Each
 * player's best swim through it is saved, and the next time anyone swims it they race a
 * see-through ghost of the other player's best run (or their own best, if nobody else has one).
 */
export const GHOST_START = 45;
export const GHOST_FINISH = 300;
const KEY = 'whiskers_ghost_v1';
const SAMPLE = 0.1; // seconds between recorded positions
const MAX_TIME = 180; // give up quietly if a run takes longer than this

interface GhostRun {
  time: number;
  name: string;
  color: string;
  /** Flattened [distance*10, lateral*10, depth*100] every SAMPLE seconds. */
  s: number[];
}

export type GhostEvent =
  | { type: 'start'; rival: string | null; own: boolean }
  | { type: 'finish'; time: number; rivalTime: number | null; rival: string | null; won: boolean; own: boolean; record: boolean };

function parseRun(text: string | null): GhostRun | null {
  if (!text) return null;
  try {
    const r = JSON.parse(text);
    if (!r || typeof r.time !== 'number' || !Array.isArray(r.s) || r.s.length < 6) return null;
    if (!r.s.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) return null;
    return { time: r.time, name: typeof r.name === 'string' ? r.name : '', color: typeof r.color === 'string' ? r.color : '#ffffff', s: r.s };
  } catch {
    return null;
  }
}

function loadOwnBest(): GhostRun | null {
  try {
    return parseRun(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function nameTag(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(3.4, 0.85, 1);
  sprite.renderOrder = 4;
  return sprite;
}

export class GhostRace {
  public group = new THREE.Group();
  public state: 'waiting' | 'racing' | 'done' = 'waiting';
  private scene: THREE.Scene;
  private disposables: { dispose: () => void }[] = [];
  private time = 0;
  private sampleTimer = 0;
  private recording: number[] = [];
  private rival: GhostRun | null = null;
  private rivalOwn = false;
  private ghost: THREE.Object3D | null = null;
  private ghostDisposables: { dispose: () => void }[] = [];
  private ghostDist = GHOST_START;
  private doneTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.group);
    this.disposables.push(...addRaceGates(this.group, GHOST_START, GHOST_FINISH));
  }

  public reset() {
    this.state = 'waiting';
    this.removeGhost();
  }

  /** The fastest run by another player on this device, else this player's own best. */
  private pickRival(): { run: GhostRun; own: boolean } | null {
    let best: GhostRun | null = null;
    for (const { profile, value } of otherPlayersValue(KEY)) {
      const run = parseRun(value);
      if (!run) continue;
      run.name = profile.name || run.name || 'Your friend';
      run.color = profile.color || run.color;
      if (!best || run.time < best.time) best = run;
    }
    if (best) return { run: best, own: false };
    const own = loadOwnBest();
    return own ? { run: { ...own, name: 'Your best' }, own: true } : null;
  }

  private makeGhost(template: THREE.Object3D, run: GhostRun) {
    const g = template.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color: run.color,
      emissive: run.color,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      roughness: 0.4,
    });
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = false;
      }
    });
    const tag = nameTag(run.name, '#ffffff');
    tag.position.set(0, 1.9, 0);
    g.add(tag);
    this.ghostDisposables = [mat, tag.material, (tag.material as THREE.SpriteMaterial).map!];
    this.scene.add(g);
    this.ghost = g;
  }

  private removeGhost() {
    if (this.ghost) this.ghost.parent?.remove(this.ghost);
    this.ghost = null;
    this.ghostDisposables.forEach((d) => d.dispose());
    this.ghostDisposables = [];
  }

  /** Where the rival was `t` seconds into their run. */
  private rivalAt(t: number, out: { d: number; l: number; y: number }) {
    const s = this.rival!.s;
    const n = s.length / 3;
    const f = THREE.MathUtils.clamp(t / SAMPLE, 0, n - 1);
    const i = Math.min(Math.floor(f), n - 2);
    const k = f - i;
    out.d = THREE.MathUtils.lerp(s[i * 3], s[i * 3 + 3], k) / 10;
    out.l = THREE.MathUtils.lerp(s[i * 3 + 1], s[i * 3 + 4], k) / 10;
    out.y = THREE.MathUtils.lerp(s[i * 3 + 2], s[i * 3 + 5], k) / 100;
  }

  private record(dist: number, lateral: number, depth: number) {
    this.recording.push(Math.round(dist * 10), Math.round(lateral * 10), Math.round(depth * 100));
  }

  public update(
    dt: number,
    prevDist: number,
    dist: number,
    lateral: number,
    depth: number,
    whiskers: THREE.Object3D
  ): { event: GhostEvent | null; progress: RaceProgress | null } {
    let event: GhostEvent | null = null;
    const span = GHOST_FINISH - GHOST_START;

    if (this.state === 'waiting') {
      if (prevDist < GHOST_START && dist >= GHOST_START && dist < GHOST_START + 20) {
        this.state = 'racing';
        this.time = 0;
        this.sampleTimer = 0;
        this.recording = [];
        this.record(dist, lateral, depth);
        const pick = this.pickRival();
        this.rival = pick ? pick.run : null;
        this.rivalOwn = !!pick?.own;
        this.ghostDist = GHOST_START;
        if (this.rival) this.makeGhost(whiskers, this.rival);
        event = { type: 'start', rival: this.rival ? this.rival.name : null, own: this.rivalOwn };
      }
    } else if (this.state === 'racing') {
      this.time += dt;
      this.sampleTimer += dt;
      while (this.sampleTimer >= SAMPLE) {
        this.sampleTimer -= SAMPLE;
        this.record(dist, lateral, depth);
      }
      if (dist >= GHOST_FINISH) {
        this.record(dist, lateral, depth);
        const time = Math.round(this.time * 10) / 10;
        const own = loadOwnBest();
        const record = !own || time < own.time;
        if (record) {
          const me = activeProfile();
          try {
            localStorage.setItem(KEY, JSON.stringify({ time, name: me.name, color: me.color, s: this.recording }));
          } catch {
            // storage full: the race still counts
          }
        }
        const rivalTime = this.rival ? this.rival.time : null;
        const won = rivalTime === null || time < rivalTime;
        event = { type: 'finish', time, rivalTime, rival: this.rival ? this.rival.name : null, won, own: this.rivalOwn, record };
        this.state = 'done';
        this.doneTimer = 0;
      } else if (dist < GHOST_START - 10 || this.time > MAX_TIME) {
        this.reset();
      }
    } else if (this.state === 'done') {
      this.doneTimer += dt;
      this.time += dt;
      if (this.doneTimer > 4) this.removeGhost();
    }

    // Move the ghost along its recorded path.
    if (this.ghost && this.rival) {
      const a = { d: 0, l: 0, y: 0 };
      const b = { d: 0, l: 0, y: 0 };
      this.rivalAt(this.time, a);
      this.rivalAt(this.time + 0.2, b);
      this.ghostDist = a.d;
      const pa = getRiverPath(a.d);
      const pb = getRiverPath(b.d);
      const ax = pa.position.x + pa.normal.x * a.l;
      const az = pa.position.z + pa.normal.z * a.l;
      const bx = pb.position.x + pb.normal.x * b.l;
      const bz = pb.position.z + pb.normal.z * b.l;
      this.ghost.position.set(ax, a.y + Math.sin(this.time * 6) * 0.05, az);
      if ((bx - ax) ** 2 + (bz - az) ** 2 > 1e-4) this.ghost.rotation.set(0, Math.atan2(bx - ax, bz - az), 0);
    }

    const progress: RaceProgress | null =
      this.state === 'racing'
        ? {
            whiskers: THREE.MathUtils.clamp((dist - GHOST_START) / span, 0, 1),
            dolphin: this.rival ? THREE.MathUtils.clamp((this.ghostDist - GHOST_START) / span, 0, 1) : 0,
            rivalIcon: this.rival ? '👻' : 'none',
            rivalLabel: this.rival ? this.rival.name : undefined,
          }
        : null;
    return { event, progress };
  }

  public dispose() {
    this.removeGhost();
    this.disposables.forEach((d) => d.dispose());
    this.group.parent?.remove(this.group);
  }
}
