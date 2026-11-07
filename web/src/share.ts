import { MODE_LABEL, type Mode } from './modes';
import type { PromptResult, Tier } from './types';
import { SITE_URL } from './config';
import { totalPoints } from './dive2';

/** One square per tier, from the common answers (black and white buttons for the greys, then white and yellow) to the deepest cuts (orange, then red); a miss is black. */
export const TIER_SQUARES: Record<Tier, string> = { 1: '🔲', 2: '🔳', 3: '⬜', 4: '🟨', 5: '🟧', 6: '🟥' };
export const MISS_SQUARE = '⬛';

export function squareFor(result: PromptResult): string {
  return result.tier === null ? MISS_SQUARE : TIER_SQUARES[result.tier];
}

export function shareLine(diveNumber: number, results: readonly PromptResult[], mode: Mode = 'rare', url: string = SITE_URL): string {
  return `NYLON ${MODE_LABEL[mode]} #${diveNumber}: ${totalPoints(results)}\n${results.map(squareFor).join('')}\n${url}`;
}

/** Copy text to the clipboard. Returns false when the browser does not allow it, so the page can show the text instead. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or not a secure context: fall through
  }
  return false;
}
