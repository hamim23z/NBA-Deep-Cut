import type { History } from './storage';

export interface Streaks {
  /** Consecutive days, ending today if today's dive is finished, else yesterday (the day is not over yet). */
  current: number;
  best: number;
}

/**
 * Streaks from the dives played on their own day. A day with no dive breaks the run; archive plays and wrong answers
 * (including "outside the data range") do not matter, only that the day's dive was finished.
 */
export function computeStreaks(history: History, today: number): Streaks {
  const days = new Set(
    Object.entries(history)
      .filter(([, played]) => played.daily)
      .map(([number]) => Number(number)),
  );
  let best = 0;
  for (const day of days) {
    if (days.has(day - 1)) continue; // not the start of a run
    let length = 0;
    while (days.has(day + length)) length++;
    best = Math.max(best, length);
  }
  let current = 0;
  for (let day = days.has(today) ? today : today - 1; days.has(day); day--) current++;
  return { current, best };
}

/** The dives finished on their own day in either mode: a day counts for the streak if either mode was completed. */
export function mergeDaily(...histories: History[]): History {
  const out: History = {};
  for (const h of histories) {
    for (const [number, played] of Object.entries(h)) {
      const n = Number(number);
      const had = out[n];
      out[n] = had ? { results: had.results, daily: had.daily || played.daily } : played;
    }
  }
  return out;
}

/** The best total among the finished dives (0 when there are none). */
export function bestScore(history: History, sum: (results: History[number]['results']) => number): number {
  return Object.values(history).reduce((best, played) => Math.max(best, sum(played.results)), 0);
}
