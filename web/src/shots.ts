import { TIER_POINTS } from './tiers';
import type { PromptResult, Tier } from './types';

/** The seven shots, one per outcome: a miss, then one for each tier. */
export type ShotName = 'airball' | 'clank' | 'rattle' | 'bank' | 'swish' | 'deep-swish' | 'dunk';

export const SHOT_NAMES: readonly ShotName[] = ['airball', 'clank', 'rattle', 'bank', 'swish', 'deep-swish', 'dunk'];

/** The shot animation lasts about this long (the CSS uses the same number). A tap or Enter skips it. */
export const SHOT_MS = 1200;

/** Fun names for the six tiers, from the most famous answer (tier 1) to the deepest cut (tier 6). */
export const TIER_NAMES: Record<Tier, string> = {
  1: 'Garbage time',
  2: 'Bench mob',
  3: 'Starting five',
  4: 'All-Star',
  5: 'Buzzer beater',
  6: 'Poster dunk',
};

export const MISS_NAME = 'Airball';

export interface ShotInfo {
  name: ShotName;
  /** null for a miss. */
  tier: Tier | null;
  /** The label shown with the points: the tier name, or "Airball". */
  label: string;
  points: number;
}

const BY_TIER: Record<Tier, ShotName> = { 1: 'clank', 2: 'rattle', 3: 'bank', 4: 'swish', 5: 'deep-swish', 6: 'dunk' };

/** Which animation and which tier name a points value gets: 0 is an airball, 10 a clank, up to 100 a slam dunk. */
export function shotForPoints(points: number): ShotInfo {
  if (points === 0) return { name: 'airball', tier: null, label: MISS_NAME, points: 0 };
  const tier = (Object.keys(TIER_POINTS) as unknown as Tier[]).map(Number).find((t) => TIER_POINTS[t as Tier] === points) as Tier | undefined;
  if (tier === undefined) throw new Error(`no shot for ${points} points`);
  return { name: BY_TIER[tier], tier, label: TIER_NAMES[tier], points };
}

/** The shot for a result: a valid answer by its points, anything else (wrong, timed out, outside the data range) an airball. */
export function shotForResult(result: PromptResult): ShotInfo {
  return result.status === 'valid' && result.tier !== null ? shotForPoints(result.points) : shotForPoints(0);
}
