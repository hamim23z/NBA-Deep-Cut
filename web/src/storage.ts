import { LEGACY_KEYS, SOUND_KEY, historyKey, progressKey } from './config';
import type { Mode } from './modes';
import type { PromptResult } from './types';

/** The part of localStorage the game uses. A test can pass a plain object. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A finished dive on this device. */
export interface PlayedDive {
  results: PromptResult[];
  /** True when it was played on its own day (counts for the streak); false for an archive play. */
  daily: boolean;
}

/** Finished dives by dive number. */
export type History = Record<number, PlayedDive>;

/** localStorage, or null when the browser refuses it (private windows, blocked site data). Never throws. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__nylon_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const isResult = (r: unknown): r is PromptResult => {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return typeof o['promptId'] === 'string' && typeof o['status'] === 'string' && typeof o['points'] === 'number' && typeof o['input'] === 'string' && 'tier' in o;
};

/** Read the history. Anything unreadable or malformed is ignored, so a bad value never stops the game. */
export function loadHistory(storage: StorageLike | null, key: string): History {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== 'object' || data === null) return {};
    const out: History = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const number = Number(k);
      if (!Number.isInteger(number) || number < 1 || typeof v !== 'object' || v === null) continue;
      const { results, daily } = v as { results?: unknown; daily?: unknown };
      if (Array.isArray(results) && results.length === 7 && results.every(isResult) && typeof daily === 'boolean') out[number] = { results, daily };
    }
    return out;
  } catch {
    return {};
  }
}

/** Write the history. Returns false (and does nothing else) if the browser refuses; the game carries on without saving. */
export function saveHistory(storage: StorageLike | null, key: string, history: History): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

/** A dive that has been started and not finished: enough to resume it after a reload. */
export interface Progress {
  /** The dive number, whether it is today's dive (daily) or an archive play, and the prompts it was started with. */
  number: number;
  mode: 'daily' | 'archive';
  promptIds: string[];
  /** The answers given so far, in order. The next prompt is the one after them. */
  results: PromptResult[];
  gameMode?: Mode;
  /** When the prompt on screen was shown (ms since 1970), so a reload cannot give extra time. Null while a result is on screen. */
  startedAt: number | null;
}

/** Read the saved progress; anything unreadable or malformed is ignored. */
export function loadProgress(storage: StorageLike | null, key: string): Progress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Progress> | null;
    if (!p || typeof p !== 'object') return null;
    if (!Number.isInteger(p.number) || (p.number ?? 0) < 1 || (p.mode !== 'daily' && p.mode !== 'archive')) return null;
    if (!Array.isArray(p.promptIds) || p.promptIds.length !== 7 || !p.promptIds.every((id) => typeof id === 'string')) return null;
    if (!Array.isArray(p.results) || p.results.length > 7 || !p.results.every(isResult)) return null;
    if (p.startedAt !== null && typeof p.startedAt !== 'number') return null;
    return { number: p.number as number, mode: p.mode, promptIds: p.promptIds, results: p.results, gameMode: p.gameMode === 'common' ? 'common' : 'rare', startedAt: p.startedAt ?? null };
  } catch {
    return null;
  }
}

/** Save progress, or clear it with null. Returns false if the browser refuses; the game carries on without saving. */
export function saveProgress(storage: StorageLike | null, key: string, progress: Progress | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, progress ? JSON.stringify(progress) : '');
    return true;
  } catch {
    return false;
  }
}

export function migrateLegacy(storage: StorageLike | null, preview = false): void {
  if (!storage) return;
  const copy = (from: string, to: string, transform?: (raw: string) => string): void => {
    try {
      const old = storage.getItem(from);
      if (!old) return;
      if (storage.getItem(to)) return;
      storage.setItem(to, transform ? transform(old) : old);
    } catch {
    }
  };
  copy(preview ? LEGACY_KEYS.previewHistory : LEGACY_KEYS.history, historyKey('rare', preview));
  copy(preview ? LEGACY_KEYS.previewProgress : LEGACY_KEYS.progress, progressKey(preview), (raw) => {
    try {
      return JSON.stringify({ ...(JSON.parse(raw) as object), gameMode: 'rare' });
    } catch {
      return raw;
    }
  });
  if (!preview) copy(LEGACY_KEYS.sound, SOUND_KEY);
}
