import { sound } from './audio';

/**
 * Reads short game messages out loud (browser speech synthesis) for children who
 * can't read yet. Respects the game's mute button and a grown-ups on/off setting.
 */
const ENABLED_KEY = 'whiskers_read_aloud';
const PREFERRED_VOICES = [
  'Samantha',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Ana',
  'Karen',
  'Moira',
  'Tessa',
  'Daniel',
];

class Narrator {
  private enabled = true;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    try {
      this.enabled = localStorage.getItem(ENABLED_KEY) !== 'false';
    } catch {
      // keep default
    }
    if (this.isSupported()) {
      this.pickVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice());
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(ENABLED_KEY, String(on));
    } catch {
      // ignore
    }
    if (!on) this.stop();
  }

  public stop() {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }

  /**
   * Speak a message. `important` messages interrupt whatever is being said; others are
   * skipped if the narrator is already talking, so speech never piles up behind the game.
   */
  public say(text: string, important = false) {
    if (!this.enabled || sound.getIsMuted() || !this.isSupported()) return;
    const spoken = text
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍️]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!spoken) return;

    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      if (!important) return;
      synth.cancel();
    }
    const utter = new SpeechSynthesisUtterance(spoken);
    if (this.voice) utter.voice = this.voice;
    utter.lang = this.voice?.lang || 'en-US';
    utter.rate = 0.95;
    utter.pitch = 1.15;
    utter.volume = 1;
    synth.speak(utter);
  }

  private pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
    for (const name of PREFERRED_VOICES) {
      const match = english.find((v) => v.name.includes(name));
      if (match) {
        this.voice = match;
        return;
      }
    }
    this.voice =
      english.find((v) => v.lang === 'en-US' && v.localService) ||
      english.find((v) => v.lang === 'en-US') ||
      english[0] ||
      null;
  }
}

export const narrator = new Narrator();
