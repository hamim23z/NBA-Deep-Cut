import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULT_MODE, endLevel, startLevel, type Mode } from '../modes';
import type { PromptResult, Tier } from '../types';

/** One answered prompt, as the world draws it: its fame tier (a ball that moved) or null (a miss: the ball stays). */
export interface WorldMark {
  id: string;
  tier: Tier | null;
}

export const marksFrom = (results: readonly PromptResult[]): WorldMark[] => results.map((r) => ({ id: r.promptId, tier: r.status === 'valid' ? r.tier : null }));

/** What the world shows. The screens publish it; the world only draws it, and never carries information of its own. */
export interface WorldState {
  mode: Mode;
  /** idle: home, archive, how to play. prompt: a question is on. result: an answer was just scored. results: the dive is over. */
  phase: 'idle' | 'prompt' | 'result' | 'results';
  promptNumber: number;
  total: number;
  points: number;
  diveNumber: number | null;
  /** The answers so far, in prompt order. */
  marks: WorldMark[];
  /** Changes for every new result, so the world restarts its animation. */
  shotKey: number;
  /** The player skipped the animation: jump to its end. */
  skipped: boolean;
}

export const INITIAL_WORLD: WorldState = { mode: DEFAULT_MODE, phase: 'idle', promptNumber: 0, total: 7, points: 0, diveNumber: null, marks: [], shotKey: 0, skipped: false };

/** The level (0 = moon ... 5 = rim) the ball is on after these answers: the last answer that moved it, else the start. */
export function ballLevel(mode: Mode, marks: readonly WorldMark[]): number {
  for (let i = marks.length - 1; i >= 0; i--) {
    const tier = marks[i]?.tier;
    if (tier) return tier - 1;
  }
  return startLevel(mode);
}

/** Where the ball was before the last answer. */
export const previousLevel = (mode: Mode, marks: readonly WorldMark[]): number => ballLevel(mode, marks.slice(0, -1));

/** True when the last answer put the ball on the level the run is aiming for: the moon in common, the rim in rare. */
export const reachedEnd = (mode: Mode, marks: readonly WorldMark[]): boolean => {
  const last = marks[marks.length - 1];
  return Boolean(last?.tier) && (last?.tier as Tier) - 1 === endLevel(mode);
};

export interface WorldStore {
  get(): WorldState;
  set(patch: Partial<WorldState>): void;
  subscribe(listener: () => void): () => void;
}

/** A tiny store, so the world re-draws on its own without re-rendering the screens. */
export function createWorldStore(initial: WorldState = INITIAL_WORLD): WorldStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      const changed = (Object.keys(patch) as Array<keyof WorldState>).some((k) => state[k] !== next[k]);
      if (!changed) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const WorldContext = createContext<WorldStore>(createWorldStore());

export function WorldProvider({ store, children }: { store?: WorldStore; children: ReactNode }) {
  const value = useMemo(() => store ?? createWorldStore(), [store]);
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export const useWorldStore = (): WorldStore => useContext(WorldContext);

export function useWorldState(): WorldState {
  const store = useWorldStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
