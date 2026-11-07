import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_URL } from './config';
import { copyText, MISS_SQUARE, shareLine, squareFor, TIER_SQUARES } from './share';
import { TIER_POINTS } from './tiers';
import type { PromptResult, Tier } from './types';

const res = (tier: Tier | null): PromptResult => ({
  promptId: 'p', status: tier === null ? 'invalid' : 'valid', input: '', matched: null, tier, points: tier === null ? 0 : TIER_POINTS[tier], countsAsWrong: true,
});

describe('share line', () => {
  it('reads "NYLON RARE #12: 385" followed by seven colored squares', () => {
    // 100 + 100 + 75 + 55 + 35 + 20 + 0 = 385
    const results = [res(6), res(6), res(5), res(4), res(3), res(2), res(null)];
    const line = shareLine(12, results);
    expect(line).toBe(`NYLON RARE #12: 385\n${TIER_SQUARES[6]}${TIER_SQUARES[6]}${TIER_SQUARES[5]}${TIER_SQUARES[4]}${TIER_SQUARES[3]}${TIER_SQUARES[2]}${MISS_SQUARE}\n${SITE_URL}`);
    expect([...line.split('\n')[1]!].length).toBe(7);
    expect(line.split('\n')[2]).toBe(SITE_URL);
  });

  it('uses a different square for every tier and for a miss', () => {
    const squares = ([1, 2, 3, 4, 5, 6] as Tier[]).map((t) => squareFor(res(t)));
    expect(new Set([...squares, squareFor(res(null))]).size).toBe(7);
  });

  it('scores 0 and seven misses when nothing was right', () => {
    expect(shareLine(1, Array.from({ length: 7 }, () => res(null)))).toBe(`NYLON RARE #1: 0\n${MISS_SQUARE.repeat(7)}\n${SITE_URL}`);
  });
});

describe('the site address in the share line', () => {
  it('comes from the one config constant, which is a placeholder the owner must set', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(shareLine(3, [res(1), res(2), res(3), res(4), res(5), res(6), res(null)])).toContain(SITE_URL);
  });

  it('can be given another address', () => {
    expect(shareLine(3, [res(1)], 'rare', 'https://example.org')).toMatch(/\nhttps:\/\/example\.org$/);
  });
});

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copies through the clipboard when the browser allows it', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports failure when the clipboard is missing or refuses', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('denied'); } } });
    await expect(copyText('x')).resolves.toBe(false);
  });
});

describe('the share line names the game and the mode', () => {
  it('starts with NYLON, the mode, the dive number and the score', () => {
    const results = [res(1), res(2), res(3), res(4), res(5), res(6), res(null)];
    expect(shareLine(12, results, 'rare').split('\n')[0]).toMatch(/^NYLON RARE #12: \d+$/);
    expect(shareLine(12, results, 'common').split('\n')[0]).toMatch(/^NYLON COMMON #12: \d+$/);
  });
});
