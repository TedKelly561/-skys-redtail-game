/**
 * Procedural Web Audio API sound generator for Whiskers' River Journey.
 * Generates cozy, soothing river ambiences, bubbly sound effects,
 * treasure chimes, hungry tummy rumbles, and magical fanfare without external files.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private isAmbientPlaying: boolean = false;

  constructor() {
    const savedMute = localStorage.getItem('whiskers_sound_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('whiskers_sound_muted', String(muted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.8, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public startRiverAmbience() {
    if (this.isAmbientPlaying) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(360, this.ctx.currentTime);
      this.ambientFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        output[i] = (b0 + b1 + b2) * 0.12;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

      whiteNoise.connect(this.ambientFilter);
      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      whiteNoise.start();
      this.ambientOsc1.start();
      this.isAmbientPlaying = true;
    } catch {
      // ignore autoplay error
    }
  }

  public stopRiverAmbience() {
    if (this.ambientGain && this.ctx) {
      try {
        this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        // ignore
      }
    }
    this.isAmbientPlaying = false;
  }

  /**
   * Sound when eating larvae, tiny fish, or berries
   */
  public playEatFood(isTinyFish: boolean = false) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(isTinyFish ? 380 : 320, now);
    osc1.frequency.exponentialRampToValueAtTime(isTinyFish ? 760 : 680, now + 0.11);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(isTinyFish ? 620 : 540, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(isTinyFish ? 960 : 860, now + 0.22);
    gain2.gain.setValueAtTime(0.24, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.24);
  }

  /**
   * Pleasant multi-note harmonic chime when collecting shiny treasures or stars
   */
  public playCollectTreasure(
    treasureKind: 'star' | 'smooth_stone' | 'shimmering_scale' | 'lost_trinket' | 'pearl' = 'star'
  ) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    let chord: number[] = [523.25, 659.25, 783.99]; // C5, E5, G5
    if (treasureKind === 'smooth_stone') {
      chord = [587.33, 739.99, 880.0]; // D5, F#5, A5 (warm marimba-like chime)
    } else if (treasureKind === 'shimmering_scale') {
      chord = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6 (shimmering harp arpeggio)
    } else if (treasureKind === 'lost_trinket') {
      chord = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // Grand treasure fanfare
    } else if (treasureKind === 'pearl') {
      chord = [698.46, 880.0, 1046.5, 1396.91]; // F5 major 7th sparkle
    }

    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = treasureKind === 'smooth_stone' ? 'triangle' : 'sine';
      const startTime = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.3);

      gain.gain.setValueAtTime(0.26, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.42);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }

  /**
   * Gentle water current whoosh
   */
  public playCurrentBoost() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.25);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playBarbelSense() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playWaterHop() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.35);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playTummyRumble() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(115, now + 0.15);
    osc.frequency.linearRampToValueAtTime(80, now + 0.3);
    osc.frequency.linearRampToValueAtTime(105, now + 0.45);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playMilestone() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.25, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.45);
    });
  }

  public playGrandLakeVictory() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.0, d: 0.2 },
      { f: 659.25, t: 0.18, d: 0.2 },
      { f: 783.99, t: 0.36, d: 0.2 },
      { f: 1046.5, t: 0.54, d: 0.4 },
      { f: 880.0, t: 0.85, d: 0.2 },
      { f: 1046.5, t: 1.05, d: 0.6 },
    ];

    melody.forEach((item) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.f, now + item.t);
      gain.gain.setValueAtTime(0.3, now + item.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + item.t + item.d + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + item.t);
      osc.stop(now + item.t + item.d + 0.15);
    });
  }

  /**
   * Bright, uplifting fanfare when a Daily Mission is completed
   */
  public playMissionComplete() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 587.33, t: 0.0, d: 0.14 }, // D5
      { f: 739.99, t: 0.11, d: 0.14 }, // F#5
      { f: 880.0, t: 0.22, d: 0.16 }, // A5
      { f: 1174.66, t: 0.35, d: 0.38 }, // D6
    ];

    notes.forEach((n) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.28, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.05);
    });
  }

  /** Happy bouncing tune for the rainbow party. */
  public playRainbowParty() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // C major arpeggio up and down, then a little flourish.
    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 783.99, 1046.5, 1318.51, 1046.5, 1318.51, 1567.98];
    melody.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.13;
      const d = i === melody.length - 1 ? 0.6 : 0.16;
      for (const [type, vol, mult] of [['triangle', 0.22, 1], ['sine', 0.12, 2]] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f * mult, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + d);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + d + 0.05);
      }
    });
  }

  /** Springy cartoon "boing" when Whiskers bumps into something. */
  public playBoing() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(230, now + 0.45);
    // Fast wobble on the pitch gives the spring sound.
    lfo.frequency.setValueAtTime(22, now);
    lfoGain.gain.setValueAtTime(60, now);
    lfoGain.gain.exponentialRampToValueAtTime(1, now + 0.45);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.52);
    lfo.stop(now + 0.52);
  }

  /** A cartoon "chomp" when a bad guy grabs a snack. */
  public playChomp() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    [0, 0.13].forEach((delay) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now + delay);
      osc.frequency.exponentialRampToValueAtTime(70, now + delay + 0.1);
      gain.gain.setValueAtTime(0.16, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.11);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.13);
    });
  }
}

export const sound = new SoundManager();
