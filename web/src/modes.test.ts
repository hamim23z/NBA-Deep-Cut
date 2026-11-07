import { describe, expect, it } from 'vitest';
import { FLAVOR, MODES, MOON_Y, RIM_Y, THRESHOLDS, TIER_CLASS, ZONE_NAMES, altitudeFt, applyMode, ballY, capitalizeFirst, feetFor, formatFeet, isMode, pointsFor, reachedEnd, travelMs, zoneIndex, zoneName } from './modes';
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

describe('ballY', () => {
  it.each([[0, 190], [100, 190 - (100 / 700) * 166], [350, 107], [700, 24]])('common mode, total %i', (total, y) => expect(ballY('common', total)).toBeCloseTo(y, 6));
  it.each([[0, 24], [100, 24 + (100 / 700) * 166], [350, 107], [700, 190]])('rare mode, total %i', (total, y) => expect(ballY('rare', total)).toBeCloseTo(y, 6));
  it('clamps to the track', () => {
    expect(ballY('common', 900)).toBe(MOON_Y);
    expect(ballY('rare', 900)).toBe(RIM_Y);
    expect(ballY('common', -5)).toBe(RIM_Y);
    expect(ballY('rare', -5)).toBe(MOON_Y);
  });
  it('only ever moves up in common and down in rare as the total grows', () => {
    for (let t = 0; t < 700; t += 5) {
      expect(ballY('common', t + 5)).toBeLessThanOrEqual(ballY('common', t));
      expect(ballY('rare', t + 5)).toBeGreaterThanOrEqual(ballY('rare', t));
    }
  });
  it.each(MODES)('lands exactly at ballY(total) after a sequence like [100, 0, 55] and never moves backwards (%s)', (mode) => {
    let total = 0;
    let y = ballY(mode, total);
    for (const points of [100, 0, 55]) {
      total += points;
      const next = ballY(mode, total);
      if (points === 0) expect(next).toBe(y);
      else expect(mode === 'common' ? next < y : next > y).toBe(true);
      y = next;
    }
    expect(y).toBe(ballY(mode, 155));
  });
});

describe('zones and altitude', () => {
  it('has the thresholds and the zone names in order for each mode', () => {
    expect(THRESHOLDS).toEqual([0, 100, 200, 300, 450, 600]);
    expect(ZONE_NAMES.common).toEqual(['RIM', 'RAFTERS', 'ROOF', 'CLOUDS', 'ORBIT', 'MOON']);
    expect(ZONE_NAMES.rare).toEqual(['MOON', 'ORBIT', 'CLOUDS', 'ROOF', 'RAFTERS', 'RIM']);
  });
  it.each([[0, 0], [99, 0], [100, 1], [299, 2], [300, 3], [449, 3], [450, 4], [599, 4], [600, 5], [700, 5]])('total %i is zone %i', (total, index) => {
    expect(zoneIndex(total)).toBe(index);
    expect(zoneName('common', total)).toBe(ZONE_NAMES.common[index]);
    expect(zoneName('rare', total)).toBe(ZONE_NAMES.rare[index]);
  });
  it('reads altitude at 10 ft a point: up from 0 in common, down from 7,000 in rare', () => {
    expect(altitudeFt('common', 0)).toBe(0);
    expect(altitudeFt('common', 185)).toBe(1850);
    expect(altitudeFt('common', 700)).toBe(7000);
    expect(altitudeFt('rare', 0)).toBe(7000);
    expect(altitudeFt('rare', 185)).toBe(5150);
    expect(altitudeFt('rare', 700)).toBe(0);
    expect(feetFor(75)).toBe(750);
  });
  it('is at the end of the track at 700', () => {
    expect(reachedEnd(699)).toBe(false);
    expect(reachedEnd(700)).toBe(true);
  });
  it('travels longer for more points, up to 1,200 ms, and not at all for none', () => {
    expect(travelMs(0)).toBe(0);
    expect(travelMs(10)).toBe(570);
    expect(travelMs(100)).toBe(1200);
    expect(travelMs(500)).toBe(1200);
  });
  it('names the tier classes and has a flavour line for every tier in both modes', () => {
    expect(TIER_CLASS).toEqual(['FRANCHISE', 'ALL-STAR', 'STARTER', 'ROTATION', 'BENCH', 'DEEP CUT']);
    for (const mode of MODES) expect(FLAVOR[mode]).toHaveLength(6);
    expect(FLAVOR.common[0]).toBe('Everybody knows this name. Big climb.');
    expect(FLAVOR.rare[5]).toBe('Almost nobody said this. Huge sink.');
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
