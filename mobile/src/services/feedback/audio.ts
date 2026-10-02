import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { CATEGORY_VOLUME, SOUNDS, type SoundCategory, type SoundId } from './sounds';

const MIN_GAP_MS = 35;

/**
 * A small pool of preloaded players over expo-audio. Sounds are best-effort:
 * any failure (no audio device, browser autoplay rules) is silently ignored.
 */
export class SoundBank {
  private players = new Map<SoundId, AudioPlayer[]>();
  private cursor = new Map<SoundId, number>();
  private lastPlayed = new Map<SoundId, number>();
  private enabled: Record<SoundCategory, boolean> = { ui: true, game: true, reward: true, music: false };
  private configured = false;
  /** Browsers refuse audio until the first user gesture. */
  private unlocked = Platform.OS !== 'web';

  constructor(
    private readonly create: typeof createAudioPlayer = createAudioPlayer,
    private readonly now: () => number = Date.now,
  ) {}

  setEnabled(categories: Partial<Record<SoundCategory, boolean>>) {
    this.enabled = { ...this.enabled, ...categories };
  }

  isEnabled(category: SoundCategory): boolean {
    return this.enabled[category];
  }

  /** Configures the audio session and creates players up front so the first play is instant. */
  preload() {
    this.configure();
    for (const id of Object.keys(SOUNDS) as SoundId[]) this.voices(id);
  }

  play(id: SoundId, options: { volume?: number } = {}) {
    const definition = SOUNDS[id];
    if (!this.enabled[definition.category] || !this.unlocked) return;
    // Several checkers landing in the same frame should sound like one.
    const now = this.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < MIN_GAP_MS) return;
    this.lastPlayed.set(id, now);
    try {
      this.configure();
      const voices = this.voices(id);
      const index = (this.cursor.get(id) ?? 0) % voices.length;
      this.cursor.set(id, index + 1);
      const player = voices[index];
      player.volume = Math.min(1, definition.volume * CATEGORY_VOLUME[definition.category] * (options.volume ?? 1));
      const started = player.seekTo(0);
      if (started && typeof started.then === 'function') {
        started.then(() => player.play()).catch(() => {});
      } else {
        player.play();
      }
    } catch {
      // Sound is a nicety; never let it break the game.
    }
  }

  private voices(id: SoundId): AudioPlayer[] {
    let list = this.players.get(id);
    if (!list) {
      const count = SOUNDS[id].voices ?? 1;
      list = Array.from({ length: count }, () => this.create(SOUNDS[id].source));
      this.players.set(id, list);
    }
    return list;
  }

  private configure() {
    if (this.configured) return;
    this.configured = true;
    // Ambient session: respects the iOS silent switch and never interrupts the
    // player's own music.
    setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
    if (!this.unlocked && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const unlock = () => {
        this.unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }
  }
}
