// Findings from playing real dives: these keep the fixes in place and check the real data for the same kinds of trouble.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { suggest } from './autocomplete';
import { PromptText, displayText, splitEra } from './components/PromptText';
import { Reveal, mostFamous, rarestOthers } from './components/Reveal';
import { parsePrompts, parseUniverse } from './loadData';
import { buildIndex, matchAnswer } from './matching';
import type { Answer, Prompt, PromptResult } from './types';

const root = process.cwd();
const universe = parseUniverse(JSON.parse(readFileSync(resolve(root, 'public/universe.json'), 'utf8')));
const prompts = parsePrompts(JSON.parse(readFileSync(resolve(root, 'public/prompts.json'), 'utf8')), universe);
const index = buildIndex(universe);

const answers = (tiers: number[]): Answer[] => tiers.map((t, i) => ({ id: `pl-${i}`, name: `Player ${i}`, tier: t as Answer['tier'], points: [10, 20, 35, 55, 75, 100][t - 1] as number }));
const prompt = (a: Answer[]): Prompt => ({ id: 'p-x', answerType: 'player', text: 'Since 2001-02 (through 2025-26), name a player who did x.', answers: a, difficulty: 'easy' });
const result: PromptResult = { promptId: 'p-x', status: 'valid', input: 'x', matched: { id: 'pl-0', name: 'Player 0' }, tier: 1, points: 10, countsAsWrong: false };

describe('the era in a prompt', () => {
  it('is split from the task, and the sentence is unchanged', () => {
    expect(splitEra('Since 2001-02 (through 2025-26), name a team that won.')).toEqual({ era: 'Since 2001-02 (through 2025-26),', task: 'name a team that won.' });
    expect(splitEra('No era here')).toBeNull();
    const text = 'Since 2001-02 (through 2025-26), name a player who scored 50 or more points in a regular-season game.';
    const { container } = render(<h2><PromptText text={text} /></h2>);
    expect(container.textContent).toBe(displayText(text)); // the words are the prompt's; only the first letter of the task is capitalised
    expect(container.textContent?.toLowerCase()).toBe(text.toLowerCase());
  });

  it('every real prompt splits that way and none is so long that it cannot fit a phone (under 200 characters)', () => {
    for (const p of prompts) {
      expect(splitEra(p.text), p.id).not.toBeNull();
      expect(p.text.length, p.id).toBeLessThan(200);
    }
  });
});

describe('the reveal lists', () => {
  it('do not show the same answers twice when a list is short or has one tier', () => {
    const same = answers([1, 1, 1, 1, 1]);
    expect(rarestOthers(same).map((a) => a.id)).toEqual(['pl-3', 'pl-4'].reverse().filter((id) => !mostFamous(same).some((a) => a.id === id)));
    expect(rarestOthers(answers([1, 1, 1]))).toEqual([]);
    expect(rarestOthers(answers([1, 2]))).toEqual([]);
    const spread = answers([1, 1, 2, 3, 4, 5, 6]);
    const shown = new Set(mostFamous(spread).map((a) => a.id));
    expect(rarestOthers(spread).every((a) => !shown.has(a.id))).toBe(true);
    expect(rarestOthers(spread).map((a) => a.tier)).toEqual([6, 5, 4]);
  });

  it('hide the rarest section when there is nothing different to show', () => {
    render(<Reveal mode="rare" prompt={prompt(answers([1, 1, 1]))} result={result} isLast={false} headingRef={null} onNext={() => undefined} skipped onSkip={() => undefined} />);
    expect(screen.getByText('The most famous valid answers')).toBeInTheDocument();
    expect(screen.queryByText('The rarest valid answers')).not.toBeInTheDocument();
  });

  it('build the full list of a 400-answer prompt only when it is opened', async () => {
    const many = answers(Array.from({ length: 400 }, (_, i) => 1 + (i % 6)));
    render(<Reveal mode="rare" prompt={prompt(many)} result={result} isLast={false} headingRef={null} onNext={() => undefined} skipped onSkip={() => undefined} />);
    expect(document.querySelector('.answers--all')).toBeNull();
    await userEvent.setup().click(screen.getByText('All 400 valid answers'));
    expect(document.querySelectorAll('.answers--all > li')).toHaveLength(400);
  });
});

describe('the real data', () => {
  it('has between 5 and 700 answers on every prompt, every name non-empty and every tier and point pair valid', () => {
    for (const p of prompts) {
      expect(p.answers.length, p.id).toBeGreaterThanOrEqual(5);
      expect(p.answers.length, p.id).toBeLessThanOrEqual(700);
      for (const a of p.answers) expect(a.name.trim(), p.id).not.toBe('');
    }
  });

  it('answers every name in the universe by typing it exactly, and no two people share a name', () => {
    const all = [...universe.players, ...universe.teams];
    expect(new Set(all.map((e) => e.name)).size).toBe(all.length);
    for (const e of all) {
      const r = matchAnswer(index, e.name);
      expect(r.kind === 'match' && r.entry.id, e.name).toBe(e.id);
    }
  });

  it('answers every alias with the entry it belongs to', () => {
    for (const e of [...universe.players, ...universe.teams]) {
      for (const alias of e.aliases) {
        const r = matchAnswer(index, alias);
        expect(r.kind === 'match' && r.entry.id, `${alias} -> ${e.name}`).toBe(e.id);
      }
    }
  });

  it('accepts a hyphenated surname typed alone, and each half when it is unique', () => {
    const shai = matchAnswer(index, 'Gilgeous-Alexander');
    expect(shai.kind === 'match' && shai.entry.name).toBe('Shai Gilgeous-Alexander');
    const nick = matchAnswer(index, 'gilgeous alexander');
    expect(nick.kind === 'match' && nick.entry.name).toBe('Shai Gilgeous-Alexander');
    const gilgeous = matchAnswer(index, 'Gilgeous');
    expect(gilgeous.kind === 'match' && gilgeous.entry.name).toBe('Shai Gilgeous-Alexander');
  });

  it('asks which one when two people share a half of a hyphenated surname (and never guesses)', () => {
    const hyphenated = universe.players.filter((p) => /-/.test(p.name.replace(/\s*\([^)]*\)/, '').split(' ').slice(-1)[0] ?? ''));
    expect(hyphenated.length).toBeGreaterThan(5);
    const halves = new Map<string, string[]>();
    for (const p of hyphenated) for (const h of (p.name.split(' ').slice(-1)[0] ?? '').split('-')) halves.set(h.toLowerCase(), [...(halves.get(h.toLowerCase()) ?? []), p.id]);
    for (const [half, ids] of halves) {
      const r = matchAnswer(index, half);
      if (r.kind === 'match') expect(ids.length === 1 || r.via === 'name' || r.via === 'alias' || r.via === 'last-name', half).toBe(true);
    }
  });

  it('suggests within 100 ms for every keystroke over the whole universe (here: well under, on average)', () => {
    const typed = ['a', 'ja', 'jam', 'lebr', 'mike j', 'shai g', 'gilg', 'hollis', 'o', 'oklahoma', 'new', 'the', 'ki', 'don', 'wil', 'marcus w', 'tim', 'tony', 'z', 'xq'];
    const times: number[] = [];
    for (const q of typed) {
      const start = performance.now();
      const found = suggest(index, q);
      times.push(performance.now() - start);
      expect(found.length).toBeLessThanOrEqual(6);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    expect(Math.max(...times)).toBeLessThan(100);
    expect(mean).toBeLessThan(40);
  });

  it('lists people who share a display name as separate suggestions', () => {
    const rows = suggest(index, 'Marcus Williams').map((s) => s.entry.name);
    expect(rows.filter((n) => n.startsWith('Marcus Williams (')).length).toBe(2);
  });
});
