import type { Tier } from '../types';

export const TIER_COLORS: Record<Tier, string> = { 1: '#6E6E6E', 2: '#A8A8A8', 3: '#EDEDED', 4: '#FFB020', 5: '#FF6A13', 6: '#FF3B1F' };
/** Text on a tier colour: white on the dark grey, ink on the rest (4.5 : 1 or better). */
export const TIER_INK: Record<Tier, string> = { 1: '#FFFFFF', 2: '#0A0A0A', 3: '#0A0A0A', 4: '#0A0A0A', 5: '#0A0A0A', 6: '#0A0A0A' };
export const tierOfLevel = (level: number): Tier => (level + 1) as Tier;

/** How long the ball takes between two levels: 700 ms for a step, up to 1000 ms for the whole way. */
export const moveMs = (from: number, to: number): number => (from === to ? 0 : 700 + Math.min(5, Math.abs(to - from) - 1) * 75);

