import { describe, expect, it, vi } from 'vitest';
import { ballLevel, createWorldStore, INITIAL_WORLD, marksFrom, previousLevel, reachedEnd } from './worldStore';

describe('the ball level', () => {
  it('starts on the moon in rare mode and on the rim in common mode', () => {
    expect(ballLevel('rare', [])).toBe(0);
    expect(ballLevel('common', [])).toBe(5);
  });
  it('goes to the level of the last answer that moved it, and a miss leaves it where it is', () => {
    const marks = [{ id: 'a', tier: 3 as const }, { id: 'b', tier: null }];
    expect(ballLevel('rare', marks)).toBe(2);
    expect(previousLevel('rare', marks)).toBe(2);
    expect(previousLevel('rare', [{ id: 'a', tier: 4 as const }, { id: 'b', tier: 2 as const }])).toBe(3);
  });
  it('reaches the end level on the rim in rare mode and on the moon in common mode', () => {
    expect(reachedEnd('rare', [{ id: 'a', tier: 6 }])).toBe(true);
    expect(reachedEnd('rare', [{ id: 'a', tier: 1 }])).toBe(false);
    expect(reachedEnd('common', [{ id: 'a', tier: 1 }])).toBe(true);
    expect(reachedEnd('common', [{ id: 'a', tier: 6 }])).toBe(false);
    expect(reachedEnd('rare', [{ id: 'a', tier: null }])).toBe(false);
    expect(reachedEnd('rare', [])).toBe(false);
  });
  it('turns results into marks: a valid answer keeps its tier, everything else is a miss', () => {
    const base = { promptId: 'p', input: '', matched: null, countsAsWrong: true };
    expect(marksFrom([{ ...base, status: 'valid', tier: 2, points: 20 }, { ...base, status: 'timeout', tier: null, points: 0 }])).toEqual([{ id: 'p', tier: 2 }, { id: 'p', tier: null }]);
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
