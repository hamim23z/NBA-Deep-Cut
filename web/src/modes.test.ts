import { describe, expect, it } from 'vitest';
import { FLAVOR, LEVELS, MODES, applyMode, capitalizeFirst, endLevel, formatFeet, isMode, levelFor, pointsFor, startLevel } from './modes';
import { TIER_POINTS } from './tiers';
import type { PromptResult } from './types';

const valid = (tier: 1 | 2 | 3 | 4 | 5 | 6, points = TIER_POINTS[tier]): PromptResult => ({ promptId: 'p', status: 'valid', input: 'x', matched: { id: 'a', name: 'A' }, tier, points, countsAsWrong: false });
const wrong = (status: PromptResult['status']): PromptResult => ({ promptId: 'p', status, input: '', matched: null, tier: null, points: 0, countsAsWrong: status !== 'outside_range' });

describe('pointsFor', () => {
  const RARE = [10, 20, 35, 55, 75, 100];
  it.each([0, 1, 2, 3, 4, 5])('rare mode, tier index %i: the rarer, the more', (i) => expect(pointsFor('rare', i)).toBe(RARE[i]));
  it.each([0, 1, 2, 3, 4, 5])('common mode, tier index %i: the more famous, the more', (i) => expect(pointsFor('common', i)).toBe(RARE[5 - i]));
  it('gives all twelve combinations, six values each way', () => {
    for (const mode of MODES) expect([0, 1, 2, 3, 4, 5].map((i) => pointsFor(mode, i)).sort((a, b) => a - b)).toEqual(RARE);
  });
  it('scores nothing for a wrong, empty or timed-out answer (no tier) in both modes', () => {
    for (const mode of MODES) {
      expect(pointsFor(mode, null)).toBe(0);
      expect(pointsFor(mode, -1)).toBe(0);
      expect(pointsFor(mode, 6)).toBe(0);
      for (const status of ['invalid', 'timeout', 'outside_range'] as const) expect(applyMode(wrong(status), mode).points).toBe(0);
    }
  });
  it('re-scores a valid result for the mode and leaves its tier alone', () => {
    expect(applyMode(valid(1, 10), 'common')).toMatchObject({ tier: 1, points: 100 });
    expect(applyMode(valid(6, 100), 'common')).toMatchObject({ tier: 6, points: 10 });
    expect(applyMode(valid(3, 35), 'rare')).toMatchObject({ tier: 3, points: 35 });
    const same = valid(2, 20);
    expect(applyMode(same, 'rare')).toBe(same);
  });
});

describe('the levels', () => {
  it('are on the grid rows the scene uses, with the altitudes and the pick names', () => {
    expect(LEVELS.map((l) => [l.name, l.y, l.ft, l.pick])).toEqual([
      ['MOON', 24, 3200, 'FRANCHISE'], ['ORBIT', 60, 2400, 'ALL-STAR'], ['CLOUDS', 94, 1800, 'STARTER'], ['ROOF', 128, 1100, 'ROTATION'], ['RAFTERS', 162, 500, 'BENCH'], ['RIM', 190, 60, 'DEEP CUT'],
    ]);
  });
  it('map a fame tier index to a level in both modes: the most famous is the moon, the rarest the rim', () => {
    for (const mode of MODES) {
      expect(levelFor(mode, 0).name).toBe('MOON');
      expect(levelFor(mode, 5).name).toBe('RIM');
      expect([0, 1, 2, 3, 4, 5].map((i) => levelFor(mode, i).y)).toEqual([24, 60, 94, 128, 162, 190]);
    }
  });
  it('pay what the brief says at each level: rare sinks 10 to 100, common climbs 10 (rim) to 100 (moon)', () => {
    expect(LEVELS.map((_, i) => pointsFor('rare', i))).toEqual([10, 20, 35, 55, 75, 100]);
    expect(LEVELS.map((_, i) => pointsFor('common', i))).toEqual([100, 75, 55, 35, 20, 10]);
  });
  it('start on the moon (rare) or the rim (common) and end at the other', () => {
    expect([startLevel('rare'), endLevel('rare')]).toEqual([0, 5]);
    expect([startLevel('common'), endLevel('common')]).toEqual([5, 0]);
  });
  it('have a flavour line for every level in both modes', () => {
    for (const mode of MODES) expect(FLAVOR[mode]).toHaveLength(6);
    expect(FLAVOR.common[5]).toBe('Rim-out. Too obscure for this mode.');
    expect(FLAVOR.rare[5]).toBe('Swish. Almost nobody said this.');
  });
  it('formats the altitude with a thousands separator', () => expect(formatFeet(3200)).toBe('3,200'));
});

describe('the mode and the text helpers', () => {
  it('knows its two modes', () => {
    expect(isMode('rare') && isMode('common')).toBe(true);
    expect(isMode('Rare')).toBe(false);
    expect(isMode(null)).toBe(false);
  });
  it('capitalises the first letter for display and never changes anything else', () => {
    const text = 'name a player who scored 40 points.';
    expect(capitalizeFirst(text)).toBe('Name a player who scored 40 points.');
    expect(text.startsWith('name')).toBe(true);
    expect(capitalizeFirst('')).toBe('');
    expect(capitalizeFirst('3-point')).toBe('3-point');
  });
});
