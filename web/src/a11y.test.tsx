// Accessibility checks that do not need a browser. The browser pass (axe, keyboard only, reduced motion) is in the PR.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Archive } from './components/Archive';
import { Final } from './components/Final';
import { Reveal } from './components/Reveal';
import type { History } from './storage';
import type { Prompt, PromptResult, Tier } from './types';

const res = (i: number, tier: Tier | null): PromptResult => ({ promptId: `p-${i}`, status: tier === null ? 'invalid' : 'valid', input: 'x', matched: null, tier, points: tier === null ? 0 : [10, 20, 35, 55, 75, 100][tier - 1]!, countsAsWrong: true });
const seven = (tiers: Array<Tier | null>): PromptResult[] => tiers.map((t, i) => res(i, t));
const prompts: Prompt[] = Array.from({ length: 7 }, (_, i) => ({ id: `p-${i}`, answerType: 'player', text: 'Since 2001-02 (through 2025-26), name a player.', answers: [{ id: 'pl-1', name: 'A', tier: 1, points: 10 }], difficulty: 'easy' }));

describe('tiers are never told by color alone', () => {
  it('has a number or a mark in every results square', () => {
    render(<Final prompts={prompts} results={seven([1, 2, 3, 4, 5, 6, null])} diveNumber={1} mode="rare" best={0} headingRef={null} onHome={() => undefined} onArchive={() => undefined} onHowTo={() => undefined} onOtherMode={() => undefined} />);
    const squares = within(screen.getByRole('list', { name: 'Your seven answers' })).getAllByRole('listitem');
    expect(squares.map((s) => s.querySelector('.square__tier')?.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '×']);
    for (const s of squares) expect(s.getAttribute('aria-label')).toMatch(/^Prompt \d: (tier \d, \d+ points|not a valid answer, 0 points)/);
  });

  it('has a number in every square of the archive strip', () => {
    const history: History = { 1: { results: seven([6, 5, 4, 3, 2, 1, null]), daily: true } };
    render(<Archive today={1} mode="rare" onMode={() => undefined} history={history} saving onPlay={() => undefined} onResults={() => undefined} onBack={() => undefined} />);
    const strip = screen.getByRole('list', { name: 'Dive 1 answers' });
    expect(within(strip).getAllByRole('listitem').map((s) => s.textContent)).toEqual(['6', '5', '4', '3', '2', '1', '×']);
  });

  it('names the tier in words on the reveal (the level, its pick and "Tier N: P points")', () => {
    render(<Reveal prompt={prompts[0]!} mode="rare" result={res(0, 4)} isLast={false} headingRef={null} onNext={() => undefined} skipped onSkip={() => undefined} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Tier 4: 55 points');
    expect(screen.getByText('ROTATION PICK')).toBeInTheDocument(); // the level and its pick, in words
  });
});

describe('structure', () => {
  it('has an h2 before the result heading on the reveal, so the heading levels never skip', () => {
    render(<Reveal prompt={prompts[0]!} mode="rare" result={res(0, 1)} isLast={false} headingRef={null} onNext={() => undefined} skipped onSkip={() => undefined} />);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });

  it('labels the total on the results and the archive with a role that allows a name', () => {
    render(<Final prompts={prompts} results={seven([1, 1, 1, 1, 1, 1, 1])} diveNumber={1} mode="rare" best={0} headingRef={null} onHome={() => undefined} onArchive={() => undefined} onHowTo={() => undefined} onOtherMode={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Total 70 out of 700' })).toBeInTheDocument();
  });
});

describe('the page', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('shows a visible focus ring', () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid/);
  });

  it('stops animating under prefers-reduced-motion, apart from a plain fade', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(css).toMatch(/\.shotclock--danger \.shotclock__digits\s*{\s*animation:\s*none !important/);
  });

  it('never lets the slide-in make the page scroll sideways', () => {
    expect(css).toMatch(/\.app\s*{\s*overflow-x:\s*clip/);
  });

  it('declares the language, a title, a description and a theme color in index.html', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9a-f]{6}"/);
    expect(html).toMatch(/<noscript>/);
  });
});
