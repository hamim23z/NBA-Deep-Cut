import { SOUND_KEY } from './config';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShotName } from './shots';
import type { StorageLike } from './storage';
import { browserStorage } from './storage';

/** Tiny generated tones for the shots (Web Audio). No audio files. Off by default, and silent until the visitor has interacted. */
export { SOUND_KEY };

export function loadSoundSetting(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

export function saveSoundSetting(storage: StorageLike | null, on: boolean): void {
  try {
    storage?.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // storage refused: the setting just does not persist
  }
}

/** One tone: a frequency glide, when it starts (seconds from now), how long it lasts, its wave and loudness. */
export interface Tone {
  from: number;
  to: number;
  at: number;
  length: number;
  wave: OscillatorType;
  gain: number;
}

function rattleTones(): Tone[] {
  const taps: Tone[] = [0.45, 0.6, 0.72].map((at, i) => ({ from: 520 - i * 40, to: 420, at, length: 0.09, wave: 'triangle', gain: 0.3 }));
  return [...taps, { from: 400, to: 900, at: 0.85, length: 0.2, wave: 'sine', gain: 0.25 }];
}

/** The tones of each shot: a dull thud for a miss, a clank, taps on the rim, a swish and a boom for the dunk. */
export const SHOT_TONES: Record<ShotName, Tone[]> = {
  airball: [{ from: 140, to: 55, at: 0.7, length: 0.28, wave: 'sine', gain: 0.5 }],
  clank: [{ from: 880, to: 620, at: 0.55, length: 0.18, wave: 'square', gain: 0.18 }, { from: 180, to: 90, at: 0.8, length: 0.2, wave: 'sine', gain: 0.25 }],
  rattle: rattleTones(),
  bank: [{ from: 300, to: 240, at: 0.5, length: 0.1, wave: 'triangle', gain: 0.35 }, { from: 500, to: 900, at: 0.7, length: 0.25, wave: 'sine', gain: 0.25 }],
  swish: [{ from: 1400, to: 500, at: 0.6, length: 0.3, wave: 'sine', gain: 0.22 }, { from: 700, to: 1100, at: 0.62, length: 0.3, wave: 'triangle', gain: 0.12 }],
  'deep-swish': [{ from: 1800, to: 500, at: 0.65, length: 0.35, wave: 'sine', gain: 0.25 }, { from: 600, to: 1500, at: 0.7, length: 0.4, wave: 'triangle', gain: 0.16 }, { from: 880, to: 1320, at: 0.95, length: 0.25, wave: 'sine', gain: 0.12 }],
  dunk: [{ from: 90, to: 40, at: 0.62, length: 0.45, wave: 'sine', gain: 0.7 }, { from: 300, to: 120, at: 0.64, length: 0.2, wave: 'square', gain: 0.2 }, { from: 500, to: 1500, at: 0.9, length: 0.4, wave: 'triangle', gain: 0.18 }],
};

type AudioCtor = new () => AudioContext;

export interface SoundPlayer {
  /** Mark that the visitor has interacted with the page. Nothing plays before this. */
  arm(): void;
  play(shot: ShotName): void;
  readonly armed: boolean;
}

/** Makes the audio context only when a sound is first played, and never before arm() has been called. */
export function createSoundPlayer(getEnabled: () => boolean, ctor?: AudioCtor | null): SoundPlayer {
  let armed = false;
  let context: AudioContext | null = null;
  const Ctor = ctor === undefined ? (typeof window !== 'undefined' ? ((window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined) : undefined) : ctor ?? undefined;
  return {
    get armed() {
      return armed;
    },
    arm() {
      armed = true;
    },
    play(shot) {
      if (!armed || !getEnabled() || !Ctor) return;
      try {
        context ??= new Ctor();
        if (context.state === 'suspended') void context.resume();
        const start = context.currentTime;
        for (const tone of SHOT_TONES[shot]) {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = tone.wave;
          osc.frequency.setValueAtTime(tone.from, start + tone.at);
          osc.frequency.exponentialRampToValueAtTime(Math.max(tone.to, 1), start + tone.at + tone.length);
          gain.gain.setValueAtTime(0.0001, start + tone.at);
          gain.gain.exponentialRampToValueAtTime(tone.gain * 0.5, start + tone.at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.length);
          osc.connect(gain).connect(context.destination);
          osc.start(start + tone.at);
          osc.stop(start + tone.at + tone.length + 0.02);
        }
      } catch {
        // no audio available: stay silent
      }
    },
  };
}

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  play: (shot: ShotName) => void;
}

const SoundContext = createContext<SoundContextValue>({ enabled: false, toggle: () => undefined, play: () => undefined });
export const useSound = (): SoundContextValue => useContext(SoundContext);

export function SoundProvider({ children, storage, ctor }: { children: ReactNode; storage?: StorageLike | null; ctor?: AudioCtor | null }) {
  const store = useMemo(() => (storage === undefined ? browserStorage() : storage), [storage]);
  const [enabled, setEnabled] = useState(() => loadSoundSetting(store));
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const player = useMemo(() => createSoundPlayer(() => enabledRef.current, ctor), [ctor]);

  // Silent until the first tap, click or key press.
  useEffect(() => {
    const arm = (): void => {
      player.arm();
      for (const type of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(type, arm);
    };
    for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, arm, { passive: true });
    return () => {
      for (const type of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(type, arm);
    };
  }, [player]);

  const toggle = useCallback(() => {
    player.arm(); // the click that turns it on is an interaction
    setEnabled((on) => {
      saveSoundSetting(store, !on);
      return !on;
    });
  }, [player, store]);
  const value = useMemo(() => ({ enabled, toggle, play: (shot: ShotName) => player.play(shot) }), [enabled, toggle, player]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
