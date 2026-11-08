import { sound } from './audio';

/**
 * Gentle background music made on the fly with Web Audio (no files to download). Each part
 * of the river has its own little theme; at night everything turns into a slower music box.
 * A tiny look-ahead scheduler keeps timing steady.
 */
type Lead = 'pluck' | 'flute' | 'bell';

interface Theme {
  tempo: number;
  root: number; // MIDI note of the key
  scale: number[];
  progression: number[]; // scale degrees (0-based) of each bar's chord
  lead: Lead;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

const THEMES: Theme[] = [
  { tempo: 96, root: 60, scale: MAJOR, progression: [0, 4, 5, 3], lead: 'pluck' }, // shallows
  { tempo: 88, root: 65, scale: MAJOR, progression: [0, 5, 3, 4], lead: 'flute' }, // lotus groves
  { tempo: 112, root: 67, scale: MAJOR, progression: [0, 3, 4, 3], lead: 'pluck' }, // rapids
  { tempo: 92, root: 62, scale: DORIAN, progression: [0, 3, 0, 6], lead: 'flute' }, // mangroves
  { tempo: 80, root: 60, scale: MAJOR, progression: [3, 0, 4, 5], lead: 'bell' }, // grand lake
];

const STEPS_PER_BAR = 8; // eighth notes
const ENABLED_KEY = 'whiskers_music';

function midiToHz(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Small seeded random so each theme's melody is the same every time (a real "tune"). */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t * 1664525 + 1013904223) % 4294967296;
    return t / 4294967296;
  };
}

class MusicPlayer {
  private enabled = true;
  private playing = false;
  private themeIndex = 0;
  private night = false;
  private pending: { index: number; night: boolean } | null = null;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private melody: (number | null)[] = [];

  constructor() {
    try {
      this.enabled = localStorage.getItem(ENABLED_KEY) !== 'false';
    } catch {
      // keep default
    }
  }

  public getEnabled() {
    return this.enabled;
  }

  public setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(ENABLED_KEY, String(on));
    } catch {
      // ignore
    }
    if (on) this.start(this.themeIndex, this.night);
    else this.stop();
  }

  /** Start (or keep playing) the music, switching theme at the next bar if needed. */
  public start(index: number, night: boolean) {
    if (!this.enabled) {
      this.themeIndex = index;
      this.night = night;
      return;
    }
    if (this.playing) {
      if (index !== this.themeIndex || night !== this.night) this.pending = { index, night };
      return;
    }
    const graph = sound.getGraph();
    if (!graph) return;
    const { ctx, master } = graph;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(night ? 0.09 : 0.11, ctx.currentTime + 2);
    this.gain.connect(master);
    this.setTheme(index, night);
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  public stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const graph = sound.getGraph();
    if (graph && this.gain) {
      const g = this.gain;
      g.gain.cancelScheduledValues(graph.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, graph.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, graph.ctx.currentTime + 0.6);
      window.setTimeout(() => g.disconnect(), 800);
    }
    this.gain = null;
  }

  private setTheme(index: number, night: boolean) {
    this.themeIndex = index;
    this.night = night;
    // A 4-bar tune: mostly chord tones on strong beats, some rests so it breathes.
    const rand = seeded(1234 + index * 97);
    const theme = THEMES[index];
    this.melody = [];
    for (let bar = 0; bar < 4; bar++) {
      const chordDeg = theme.progression[bar];
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const strong = s % 2 === 0;
        if (!strong && rand() < 0.55) {
          this.melody.push(null);
          continue;
        }
        if (strong && rand() < 0.15) {
          this.melody.push(null);
          continue;
        }
        const chordTone = [0, 2, 4][Math.floor(rand() * 3)];
        const passing = Math.floor(rand() * 5) - 2;
        this.melody.push(chordDeg + (strong ? chordTone : chordTone + passing));
      }
    }
  }

  private noteFreq(theme: Theme, degree: number, octave: number) {
    const n = theme.scale.length;
    const o = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return midiToHz(theme.root + theme.scale[d] + 12 * (o + octave));
  }

  private schedule() {
    const graph = sound.getGraph();
    if (!graph || !this.gain) return;
    const { ctx } = graph;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const stepDur = 60 / (THEMES[this.themeIndex].tempo * (this.night ? 0.82 : 1)) / 2;
      const loopStep = this.step % (STEPS_PER_BAR * 4);
      const bar = Math.floor(loopStep / STEPS_PER_BAR);
      const s = loopStep % STEPS_PER_BAR;
      const t = this.nextTime;

      if (s === 0) {
        // Switch themes only at a bar line so changes sound musical.
        if (this.pending) {
          this.setTheme(this.pending.index, this.pending.night);
          this.pending = null;
          this.gain.gain.setTargetAtTime(this.night ? 0.09 : 0.11, t, 0.5);
        }
      }
      const theme = THEMES[this.themeIndex];
      if (s === 0) {
        const chordDeg = theme.progression[bar];
        // Soft pad chord for the whole bar.
        for (const k of [0, 2, 4]) this.pad(this.noteFreq(theme, chordDeg + k, -1), t, stepDur * STEPS_PER_BAR);
      }
      if (s % 4 === 0) {
        this.bass(this.noteFreq(theme, theme.progression[bar], -2), t, stepDur * 3);
      }
      const deg = this.melody[loopStep];
      if (deg !== null && deg !== undefined) {
        const lead: Lead = this.night ? 'bell' : theme.lead;
        this.leadNote(lead, this.noteFreq(theme, deg, this.night ? 1 : 0), t, stepDur * 1.8);
      }

      this.nextTime += stepDur;
      this.step++;
    }
  }

  private voice(type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack = 0.01) {
    const graph = sound.getGraph();
    if (!graph || !this.gain) return;
    const { ctx } = graph;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  private pad(freq: number, t: number, dur: number) {
    this.voice('sine', freq, t, dur, 0.12, 0.4);
  }

  private bass(freq: number, t: number, dur: number) {
    this.voice('triangle', freq, t, dur, 0.35, 0.02);
  }

  private leadNote(lead: Lead, freq: number, t: number, dur: number) {
    if (lead === 'pluck') {
      this.voice('triangle', freq, t, dur * 0.7, 0.45, 0.005);
    } else if (lead === 'flute') {
      const osc = this.voice('sine', freq, t, dur * 1.2, 0.4, 0.06);
      const graph = sound.getGraph();
      if (osc && graph) {
        // Gentle vibrato.
        const lfo = graph.ctx.createOscillator();
        const depth = graph.ctx.createGain();
        lfo.frequency.setValueAtTime(5.5, t);
        depth.gain.setValueAtTime(freq * 0.008, t);
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur * 1.2 + 0.05);
      }
    } else {
      // Music box: a pure tone plus a quiet bright overtone, ringing out.
      this.voice('sine', freq, t, dur * 2, 0.4, 0.004);
      this.voice('sine', freq * 2.01, t, dur * 1.2, 0.12, 0.004);
    }
  }
}

export const music = new MusicPlayer();
