import { TIER_POINTS } from './tiers';
import type { PromptResult, Tier } from './types';

/** RARE: the rarer the answer, the more it scores, and the ball sinks from the moon. COMMON: the more famous, the more, and the ball climbs. */
export type Mode = 'rare' | 'common';
export const MODES: readonly Mode[] = ['rare', 'common'];
export const DEFAULT_MODE: Mode = 'rare';

export const isMode = (value: unknown): value is Mode => value === 'rare' || value === 'common';

const POINTS_BY_RANK: readonly number[] = [TIER_POINTS[1], TIER_POINTS[2], TIER_POINTS[3], TIER_POINTS[4], TIER_POINTS[5], TIER_POINTS[6]];

/**
 * Points for an answer of a fame tier index (0 = the most famous answers, 5 = the rarest). A wrong, empty or timed-out answer has no
 * tier (null) and scores 0 in both modes.
 */
export function pointsFor(mode: Mode, tierIdx: number | null): number {
  if (tierIdx === null || !Number.isInteger(tierIdx) || tierIdx < 0 || tierIdx > 5) return 0;
  return mode === 'rare' ? (POINTS_BY_RANK[tierIdx] as number) : (POINTS_BY_RANK[5 - tierIdx] as number);
}

/** A result with its points for a mode. The tier stays the answer's fame tier; only the points depend on the mode. */
export function applyMode(result: PromptResult, mode: Mode): PromptResult {
  const points = result.status === 'valid' && result.tier !== null ? pointsFor(mode, result.tier - 1) : 0;
  return points === result.points ? result : { ...result, points };
}

export interface Level {
  name: string;
  /** Row of the ball on the 360 x 215 grid. */
  y: number;
  /** The altitude readout, in feet. */
  ft: number;
  /** What kind of pick lands here: "ALL-STAR PICK". */
  pick: string;
}

/** From the top of the scene to the bottom: the moon, orbit, the clouds, the roof, the rafters and the rim. */
export const LEVELS: readonly Level[] = [
  { name: 'MOON', y: 24, ft: 3200, pick: 'FRANCHISE' },
  { name: 'ORBIT', y: 60, ft: 2400, pick: 'ALL-STAR' },
  { name: 'CLOUDS', y: 94, ft: 1800, pick: 'STARTER' },
  { name: 'ROOF', y: 128, ft: 1100, pick: 'ROTATION' },
  { name: 'RAFTERS', y: 162, ft: 500, pick: 'BENCH' },
  { name: 'RIM', y: 190, ft: 60, pick: 'DEEP CUT' },
];

/** The level a fame tier index lands on. The most famous answers are always on the moon; the mode decides what that is worth. */
export function levelFor(mode: Mode, tierIdx: number): Level {
  void mode;
  return LEVELS[Math.min(5, Math.max(0, tierIdx))] as Level;
}

export const levelIndexFor = (tier: Tier): number => tier - 1;

/** Where the ball starts, and where the run ends in a celebration. */
export const startLevel = (mode: Mode): number => (mode === 'rare' ? 0 : 5);
export const endLevel = (mode: Mode): number => (mode === 'rare' ? 5 : 0);

export const MODE_LABEL: Record<Mode, string> = { rare: 'RARE', common: 'COMMON' };
export const MODE_VERB: Record<Mode, { next: string; move: string }> = { rare: { next: 'SINK', move: 'sink' }, common: { next: 'CLIMB', move: 'rise' } };
export const MODE_BLURB: Record<Mode, string> = {
  rare: 'Start on the moon. The rarer your answer, the deeper you sink.',
  common: 'Start at the rim. The more famous your answer, the higher you climb.',
};
export const MODE_CHIP: Record<Mode, string> = { rare: 'RARE · START ON THE MOON, SINK', common: 'COMMON · CLIMB TO THE MOON' };
export const MODE_HINT: Record<Mode, string> = { rare: 'Rare mode: the rarer the answer, the more it scores.', common: 'Common mode: the more famous the answer, the more it scores.' };

/** One line about where an answer landed, by mode and level. */
export const FLAVOR: Record<Mode, readonly string[]> = {
  common: [
    'The moon. Everybody knows this name.',
    'Orbit. Plenty of fans know this name.',
    'Above the clouds. Solid pick.',
    'Cleared the roof. Not bad.',
    'Rafters. Barely off the floor.',
    'Rim-out. Too obscure for this mode.',
  ],
  rare: [
    'Still on the moon. Way too famous.',
    'Orbit. Everybody knows this one.',
    'Drifting through the clouds. Getting rarer.',
    "Through the roof. Now we're talking.",
    'Down in the rafters. Real deep cut.',
    'Swish. Almost nobody said this.',
  ],
};

export const formatFeet = (ft: number): string => ft.toLocaleString('en-US');

/** Display only: the first letter in capitals. The prompt data and the matcher never see the result. */
export const capitalizeFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
