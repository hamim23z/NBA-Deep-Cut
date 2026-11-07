import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULT_MODE, type Mode } from '../modes';
import type { PromptResult, Tier } from '../types';

export interface WorldMark {
  id: string;
  tier: Tier | null;
  points: number;
}

export const marksFrom = (results: readonly PromptResult[]): WorldMark[] => results.map((r) => ({ id: r.promptId, tier: r.status === 'valid' ? r.tier : null, points: r.points }));

export interface WorldState {
  mode: Mode;
  phase: 'idle' | 'prompt' | 'result' | 'results';
  promptNumber: number;
  total: number;
  points: number;
  diveNumber: number | null;
  marks: WorldMark[];
  shotKey: number;
  skipped: boolean;
}

export const INITIAL_WORLD: WorldState = { mode: DEFAULT_MODE, phase: 'idle', promptNumber: 0, total: 7, points: 0, diveNumber: null, marks: [], shotKey: 0, skipped: false };

export interface WorldStore {
  get(): WorldState;
  set(patch: Partial<WorldState>): void;
  subscribe(listener: () => void): () => void;
}

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
