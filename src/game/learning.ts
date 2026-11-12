import * as THREE from 'three';
import { getRiverPath } from './worldGen';

/**
 * Learning moments for ages 4-7, woven into the swim (and read aloud):
 * - Color bubbles: "Swim through the BLUE bubble!"
 * - Letter bubbles: "Find the letter S!" (often the first letter of the player's name)
 * - Counting: a little school of fish swims by: "How many fish?" with three big number buttons.
 * Right answers earn stars; a wrong answer just gets a friendly "good try". Never a penalty.
 */
export interface LearningPrompt {
  text: string;
  /** Number buttons for counting questions (empty for bubble quests). */
  options: string[];
}

export type LearningEvent =
  | { type: 'prompt'; prompt: LearningPrompt; say: string }
  | { type: 'result'; correct: boolean; text: string; say: string; at: THREE.Vector3 }
  | { type: 'clear' };

const COLORS = [
  { name: 'red', hex: '#ff4d4d' },
  { name: 'blue', hex: '#3d8bff' },
  { name: 'yellow', hex: '#ffd23f' },
  { name: 'green', hex: '#3ecf6a' },
  { name: 'purple', hex: '#a35cff' },
  { name: 'orange', hex: '#ff9a3c' },
];
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUW'.split('');
const FISH_COLORS = ['#ff7a59', '#ffd23f', '#4fb7ff', '#ff7fbf', '#8be36b'];
const KEY = 'whiskers_learning';

export function loadLearningEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveLearningEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, String(on));
  } catch {
    // ignore
  }
}

function shuffle<T>(a: T[]): T[] {
  return a
    .map((v) => ({ v, k: Math.random() }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.v);
}

function letterTexture(letter: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '900 96px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1e3a5f';
  ctx.strokeText(letter, 64, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(letter, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Bubble {
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  sprite: THREE.Sprite | null;
  lateral: number;
  label: string;
}

type Quest =
  | { kind: 'bubbles'; mode: 'color' | 'letter'; dist: number; answer: number; bubbles: Bubble[]; popT: number; done: boolean }
  | { kind: 'count'; n: number; t: number; fish: THREE.Group[]; answered: boolean; leaveT: number };

export class LearningMoments {
  public group = new THREE.Group();
  public enabled = loadLearningEnabled();
  private quest: Quest | null = null;
  private timer = 40; // first one after ~40 s of swimming
  private turn = 0;
  private time = 0;
  private sphere = new THREE.SphereGeometry(1, 24, 18);
  private fishBody = new THREE.SphereGeometry(1, 14, 10);
  private fishTail = new THREE.ConeGeometry(1, 1, 8);

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  public setEnabled(on: boolean) {
    this.enabled = on;
    saveLearningEnabled(on);
    if (!on) this.clear();
  }

  public get active() {
    return this.quest !== null;
  }

  /** Remove whatever quest is showing (start over, free swim, etc.). */
  public clear() {
    if (!this.quest) return;
    if (this.quest.kind === 'bubbles') {
      this.quest.bubbles.forEach((b) => {
        this.group.remove(b.group);
        b.mat.dispose();
        if (b.sprite) {
          (b.sprite.material as THREE.SpriteMaterial).map?.dispose();
          b.sprite.material.dispose();
        }
      });
    } else {
      this.quest.fish.forEach((f) => this.group.remove(f));
    }
    this.quest = null;
  }

  public reset() {
    this.clear();
    this.timer = 40;
  }

  private place(dist: number, lateral: number, y: number, out: THREE.Vector3) {
    const { position, normal } = getRiverPath(dist);
    return out.set(position.x + normal.x * lateral, y, position.z + normal.z * lateral);
  }

  private startBubbles(distance: number, playerName: string): LearningEvent {
    const mode: 'color' | 'letter' = this.turn % 3 === 0 ? 'letter' : 'color';
    let labels: string[];
    let answerLabel: string;
    if (mode === 'color') {
      const picks = shuffle(COLORS).slice(0, 3);
      labels = picks.map((c) => c.name);
      answerLabel = labels[Math.floor(Math.random() * 3)];
    } else {
      const first = (playerName.trim()[0] || '').toUpperCase();
      answerLabel = /[A-Z]/.test(first) && Math.random() < 0.6 ? first : LETTERS[Math.floor(Math.random() * LETTERS.length)];
      const others = shuffle(LETTERS.filter((l) => l !== answerLabel)).slice(0, 2);
      labels = shuffle([answerLabel, ...others]);
    }
    const dist = distance + 42;
    const { width } = getRiverPath(dist);
    const spread = Math.min(5.5, width / 2 - 4);
    const bubbles: Bubble[] = labels.map((label, i) => {
      const lateral = (i - 1) * spread;
      const g = new THREE.Group();
      const hex = mode === 'color' ? COLORS.find((c) => c.name === label)!.hex : '#e9fbff';
      const mat = new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: mode === 'color' ? 0.45 : 0.15,
        transparent: true,
        opacity: mode === 'color' ? 0.7 : 0.45,
        roughness: 0.15,
        depthWrite: false, // so the letter inside isn't hidden by the bubble's front
      });
      const ball = new THREE.Mesh(this.sphere, mat);
      ball.scale.setScalar(1.5);
      g.add(ball);
      let sprite: THREE.Sprite | null = null;
      if (mode === 'letter') {
        sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(label), depthWrite: false }));
        sprite.scale.setScalar(2.2);
        sprite.renderOrder = 3; // drawn after the bubble and the water, so it always shows
        g.add(sprite);
      }
      this.place(dist, lateral, 0.6, g.position);
      this.group.add(g);
      return { group: g, mat, sprite, lateral, label };
    });
    const answer = labels.indexOf(answerLabel);
    this.quest = { kind: 'bubbles', mode, dist, answer, bubbles, popT: 0, done: false };
    const text = mode === 'color' ? `Swim through the ${answerLabel.toUpperCase()} bubble!` : `Find the letter ${answerLabel}!`;
    const say = mode === 'color' ? `Swim through the ${answerLabel} bubble!` : `Can you find the letter ${answerLabel}? Swim through it!`;
    return { type: 'prompt', prompt: { text: mode === 'color' ? `🫧 ${text}` : `🔤 ${text}`, options: [] }, say };
  }

  private startCount(): LearningEvent {
    const n = 1 + Math.floor(Math.random() * 5);
    const fish: THREE.Group[] = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: FISH_COLORS[i % FISH_COLORS.length], emissive: FISH_COLORS[i % FISH_COLORS.length], emissiveIntensity: 0.3, roughness: 0.4 });
      const body = new THREE.Mesh(this.fishBody, mat);
      body.scale.set(0.22, 0.26, 0.42);
      const tail = new THREE.Mesh(this.fishTail, mat);
      tail.scale.set(0.2, 0.3, 0.06);
      tail.rotation.x = Math.PI / 2;
      tail.position.z = -0.48;
      g.add(body, tail);
      g.userData.mat = mat;
      g.userData.tail = tail;
      g.scale.setScalar(1.8);
      this.group.add(g);
      fish.push(g);
    }
    this.quest = { kind: 'count', n, t: 0, fish, answered: false, leaveT: 0 };
    const options = shuffle([n, ...shuffle([1, 2, 3, 4, 5, 6].filter((k) => k !== n)).slice(0, 2)]).map(String);
    return { type: 'prompt', prompt: { text: '🐟 How many fish?', options }, say: 'Count the fish! How many fish do you see?' };
  }

  /** The child tapped a number on a counting question. */
  public answer(option: string): LearningEvent | null {
    const q = this.quest;
    if (!q || q.kind !== 'count' || q.answered) return null;
    q.answered = true;
    q.leaveT = q.t; // the fish swim away now
    const correct = Number(option) === q.n;
    const at = q.fish[0]?.position.clone() ?? new THREE.Vector3();
    return correct
      ? { type: 'result', correct, text: `Yes! ${q.n} fish!`, say: `Yes! ${q.n} fish! Great counting!`, at }
      : { type: 'result', correct, text: `There were ${q.n} fish. Good try!`, say: `There were ${q.n} fish. Good try!`, at };
  }

  public update(
    dt: number,
    distance: number,
    lateral: number,
    canStart: boolean,
    playerName: string
  ): LearningEvent[] {
    this.time += dt;
    const events: LearningEvent[] = [];
    const q = this.quest;
    if (!q) {
      if (!this.enabled || !canStart) return events;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 70 + Math.random() * 25;
        this.turn++;
        events.push(this.turn % 3 === 2 ? this.startCount() : this.startBubbles(distance, playerName));
      }
      return events;
    }

    if (q.kind === 'bubbles') {
      q.bubbles.forEach((b, i) => {
        b.group.position.y = 0.6 + Math.sin(this.time * 2 + i) * 0.2;
      });
      if (!q.done && distance >= q.dist) {
        q.done = true;
        let hit = -1;
        let best = 2.8;
        q.bubbles.forEach((b, i) => {
          const d = Math.abs(lateral - b.lateral);
          if (d < best) {
            best = d;
            hit = i;
          }
        });
        const right = q.bubbles[q.answer];
        const at = right.group.position.clone();
        const name = q.mode === 'color' ? right.label : `the letter ${right.label}`;
        if (hit === q.answer) {
          events.push({ type: 'result', correct: true, text: q.mode === 'color' ? `Yes! That's ${right.label}!` : `Yes! That's ${right.label}!`, say: `Yes! That's ${name}! Great job!`, at });
        } else if (hit >= 0) {
          const got = q.bubbles[hit].label;
          events.push({
            type: 'result',
            correct: false,
            text: q.mode === 'color' ? `That's ${got}! Good try!` : `That's ${got}! Good try!`,
            say: q.mode === 'color' ? `That's ${got}! The ${right.label} one was close by. Good try!` : `That's the letter ${got}! Good try!`,
            at: q.bubbles[hit].group.position.clone(),
          });
        } else {
          events.push({ type: 'result', correct: false, text: 'You missed the bubbles! Next time!', say: 'Oops! Next time!', at });
        }
      }
      if (q.done) {
        q.popT += dt;
        q.bubbles.forEach((b) => b.group.scale.setScalar(Math.max(0.01, 1 + q.popT * 2.5)));
        q.bubbles.forEach((b) => (b.mat.opacity = Math.max(0, 0.7 - q.popT * 2)));
        if (q.popT > 0.4) {
          this.clear();
          events.push({ type: 'clear' });
        }
      } else if (distance > q.dist + 30 || distance < q.dist - 120) {
        this.clear();
        events.push({ type: 'clear' });
      }
    } else {
      // Counting fish swim across in front of Whiskers, then away.
      q.t += dt;
      const cross = Math.min(1, q.t / 8);
      q.fish.forEach((f, i) => {
        const d = distance + 9 + (i % 2) * 1.2;
        const away = q.answered ? (q.t - q.leaveT) * 10 : 0;
        const lat = -7 + cross * 14 - i * 1.6 + away;
        this.place(d, lat, -0.45 + Math.sin(this.time * 3 + i) * 0.15, f.position);
        const { normal } = getRiverPath(d);
        f.rotation.y = Math.atan2(normal.x, normal.z) + Math.sin(this.time * 4 + i) * 0.1;
        (f.userData.tail as THREE.Object3D).rotation.y = Math.sin(this.time * 14 + i) * 0.5;
      });
      if (!q.answered && q.t > 18) {
        q.answered = true;
        q.leaveT = q.t;
        events.push({ type: 'result', correct: false, text: `There were ${q.n} fish!`, say: `There were ${q.n} fish!`, at: q.fish[0].position.clone() });
      }
      if (q.answered && q.t - q.leaveT > 2) {
        q.fish.forEach((f) => (f.userData.mat as THREE.Material).dispose());
        this.clear();
        events.push({ type: 'clear' });
      }
    }
    return events;
  }

  public dispose() {
    this.clear();
    this.sphere.dispose();
    this.fishBody.dispose();
    this.fishTail.dispose();
    this.group.parent?.remove(this.group);
  }
}
