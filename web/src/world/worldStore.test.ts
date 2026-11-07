import { describe, expect, it, vi } from 'vitest';
import { createWorldStore, INITIAL_WORLD, marksFrom } from './worldStore';

describe('marksFrom', () => {
  it('keeps the tier and the points of a valid answer and makes everything else a miss', () => {
    const base = { promptId: 'p', input: '', matched: null, countsAsWrong: true };
    const named = { ...base, input: 'x' };
    expect(marksFrom([{ ...named, status: 'valid', tier: 2, points: 20 }, { ...base, status: 'timeout', tier: null, points: 0 }])).toEqual([
      { id: 'p', tier: 2, points: 20, name: 'x' },
      { id: 'p', tier: null, points: 0, name: '' },
    ]);
  });
});

describe('the world store', () => {
  it('tells listeners about a change and not about a repeat', () => {
    const store = createWorldStore(INITIAL_WORLD);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set({ points: 20 });
    store.set({ points: 20 });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.set({ points: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get().points).toBe(30);
  });
});
