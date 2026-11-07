import { TIER_POINTS } from './tiers';
import type { PromptResult } from './types';

export type Mode = 'rare' | 'common';
export const MODES: readonly Mode[] = ['rare', 'common'];
export const DEFAULT_MODE: Mode = 'rare';

export const isMode = (value: unknown): value is Mode => value === 'rare' || value === 'common';

const POINTS_BY_RANK: readonly number[] = [TIER_POINTS[1], TIER_POINTS[2], TIER_POINTS[3], TIER_POINTS[4], TIER_POINTS[5], TIER_POINTS[6]];

export function pointsFor(mode: Mode, tierIdx: number | null): number {
  if (tierIdx === null || !Number.isInteger(tierIdx) || tierIdx < 0 || tierIdx > 5) return 0;
  return mode === 'rare' ? (POINTS_BY_RANK[tierIdx] as number) : (POINTS_BY_RANK[5 - tierIdx] as number);
}

export function applyMode(result: PromptResult, mode: Mode): PromptResult {
  const points = result.status === 'valid' && result.tier !== null ? pointsFor(mode, result.tier - 1) : 0;
  return points === result.points ? result : { ...result, points };
}

export const MAX_TOTAL = 700;
export const MOON_Y = 24;
export const RIM_Y = 190;
export const FEET_PER_POINT = 10;
export const THRESHOLDS: readonly number[] = [0, 100, 200, 300, 450, 600];

export const ZONE_NAMES: Record<Mode, readonly string[]> = {
  common: ['RIM', 'RAFTERS', 'ROOF', 'CLOUDS', 'ORBIT', 'MOON'],
  rare: ['MOON', 'ORBIT', 'CLOUDS', 'ROOF', 'RAFTERS', 'RIM'],
};

const clampTotal = (total: number): number => Math.min(MAX_TOTAL, Math.max(0, total));

export function ballY(mode: Mode, total: number): number {
  const progress = clampTotal(total) / MAX_TOTAL;
  return mode === 'common' ? RIM_Y - progress * (RIM_Y - MOON_Y) : MOON_Y + progress * (RIM_Y - MOON_Y);
}

export function zoneIndex(total: number): number {
  let index = 0;
  THRESHOLDS.forEach((threshold, i) => {
    if (clampTotal(total) >= threshold) index = i;
  });
  return index;
}

export const zoneName = (mode: Mode, total: number): string => ZONE_NAMES[mode][zoneIndex(total)] as string;

export function altitudeFt(mode: Mode, total: number): number {
  const climbed = clampTotal(total) * FEET_PER_POINT;
  return mode === 'common' ? climbed : MAX_TOTAL * FEET_PER_POINT - climbed;
}

export const feetFor = (points: number): number => points * FEET_PER_POINT;

export const reachedEnd = (total: number): boolean => total >= MAX_TOTAL;

export const travelMs = (points: number): number => (points <= 0 ? 0 : Math.min(1200, Math.round(500 + 700 * (points / 100))));

export const TIER_CLASS: readonly string[] = ['FRANCHISE', 'ALL-STAR', 'STARTER', 'ROTATION', 'BENCH', 'DEEP CUT'];

export const MODE_LABEL: Record<Mode, string> = { rare: 'RARE', common: 'COMMON' };
export const MODE_VERB: Record<Mode, { next: string; move: string }> = { rare: { next: 'SINK', move: 'sink' }, common: { next: 'CLIMB', move: 'rise' } };
export const MODE_BLURB: Record<Mode, string> = {
  rare: 'Start on the moon. The rarer your answer, the deeper you sink.',
  common: 'Start at the rim. The more famous your answer, the higher you climb.',
};
export const MODE_CHIP: Record<Mode, string> = { rare: 'RARE · START ON THE MOON, SINK', common: 'COMMON · CLIMB TO THE MOON' };
export const MODE_HINT: Record<Mode, string> = { rare: 'Rare mode: the rarer the answer, the more it scores.', common: 'Common mode: the more famous the answer, the more it scores.' };

export const FLAVOR: Record<Mode, readonly string[]> = {
  common: [
    'Everybody knows this name. Big climb.',
    'Plenty of fans know this one. Nice climb.',
    'Solid pick. Steady climb.',
    'Familiar to some. Small climb.',
    'Few fans know this. Barely moved.',
    'Too obscure for this mode. Tiny climb.',
  ],
  rare: [
    'Way too famous. Barely sank.',
    'Everybody knows this one. Small sink.',
    'Solid, but common. Steady sink.',
    'Not many said this. Nice sink.',
    'Real deep cut. Big sink.',
    'Almost nobody said this. Huge sink.',
  ],
};

export const formatFeet = (ft: number): string => ft.toLocaleString('en-US');

export const capitalizeFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
