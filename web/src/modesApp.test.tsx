import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { historyKey, LEGACY_KEYS } from './config';
import { divePrompts } from './schedule';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { loadHistory, type StorageLike } from './storage';
import { PROMPTS_PATH, UNIVERSE_PATH, mockPrompts, readJson } from './testUtils';
import { TIER_POINTS } from './tiers';
import type { Prompt } from './types';

const LAUNCH = new Date('2026-11-03T17:00:00Z');
const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const dive = (): Prompt[] => divePrompts(mockPrompts(), 1);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    return new Response(JSON.stringify(u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : u.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : readJson(PROMPTS_PATH)), { status: 200 });
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
type User = ReturnType<typeof setup>;
const show = (storage: StorageLike | null, hash?: string) => render(<App now={() => LAUNCH} search="" hash={hash} storage={storage} />);
const radio = (name: string): HTMLElement => within(screen.getByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name: new RegExp(name) });

async function answerWith(user: User, name: string) {
  await user.type(screen.getByRole('combobox'), name);
  await user.keyboard('{Enter}');
  await screen.findByRole('heading', { level: 3, name: /points/ });
}
const firstAnswerOf = (i: number) => dive()[i]!.answers.find((a) => a.tier === 1) ?? dive()[i]!.answers[0]!;
async function playDive(user: User) {
  for (let i = 0; i < 7; i++) {
    await answerWith(user, firstAnswerOf(i).name);
    await user.click(screen.getByRole('button', { name: i === 6 ? 'SEE RESULTS ▶' : /^(SINK|CLIMB) ▶$/ }));
  }
}

describe('choosing a mode', () => {
  it('starts in rare mode, with the rare card selected', async () => {
    show(memory());
    await screen.findByRole('button', { name: 'PLAY RARE SHOT' });
    expect(radio('RARE')).toHaveAttribute('aria-checked', 'true');
    expect(radio('COMMON')).toHaveAttribute('aria-checked', 'false');
  });

  it('remembers the last mode used, and shows it in the URL hash', async () => {
    const user = setup();
    const store = memory();
    const first = show(store);
    await user.click(await screen.findByRole('radio', { name: /COMMON/ }));
    expect(screen.getByRole('button', { name: 'PLAY COMMON SHOT' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#common');
    expect(store.getItem('nylon:mode')).toBe('common');
    first.unmount();
    window.history.replaceState(null, '', '/');
    show(store);
    expect(await screen.findByRole('button', { name: 'PLAY COMMON SHOT' })).toBeInTheDocument();
  });

  it('respects the URL hash, which wins over the saved mode', async () => {
    const store = memory();
    store.setItem('nylon:mode', 'common');
    show(store, '#rare');
    expect(await screen.findByRole('button', { name: 'PLAY RARE SHOT' })).toBeInTheDocument();
  });

  it('follows #common in the address when nothing else says', async () => {
    show(memory(), '#common');
    expect(await screen.findByRole('button', { name: 'PLAY COMMON SHOT' })).toBeInTheDocument();
    expect(document.querySelector('.app')).toHaveAttribute('data-mode', 'common');
  });

  it('shows the mode in the HUD during a dive', async () => {
    const user = setup();
    show(memory(), '#common');
    await user.click(await screen.findByRole('button', { name: 'PLAY COMMON SHOT' }));
    await screen.findByRole('combobox');
    expect(screen.getByTestId('hud-mode')).toHaveTextContent('COMMON · CLIMB TO THE MOON');
    expect(screen.getByTestId('hud-altitude')).toHaveTextContent('0');
  });
});

describe('scoring by mode', () => {
  it.each([['rare', 'SINK'], ['common', 'CLIMB']] as const)('scores the same answer for the mode: %s', async (mode, verb) => {
    const user = setup();
    show(memory(), `#${mode}`);
    await user.click(await screen.findByRole('button', { name: new RegExp(`^PLAY ${mode.toUpperCase()} SHOT$`) }));
    await screen.findByRole('combobox');
    const answer = firstAnswerOf(0);
    await answerWith(user, answer.name);
    await act(async () => void vi.advanceTimersByTime(2000));
    const expected = mode === 'rare' ? TIER_POINTS[answer.tier] : TIER_POINTS[(7 - answer.tier) as 1];
    expect(document.querySelector('.result-card__points')?.textContent).toContain(`+${expected} PTS`);
    expect(screen.getByRole('button', { name: `${verb} ▶` })).toBeInTheDocument();
    expect(screen.getByTestId('world-live').textContent).toMatch(new RegExp(`, ${expected} points, ${expected} total$`));
    expect(document.querySelector('.result-card__points')?.textContent).toContain(`${mode === 'rare' ? 'sink' : 'rise'} ${(expected * 10).toLocaleString('en-US')} ft`);
  });

  it('keeps a finished dive and the score in the history of its own mode', async () => {
    const user = setup();
    const store = memory();
    show(store, '#common');
    await user.click(await screen.findByRole('button', { name: 'PLAY COMMON SHOT' }));
    await screen.findByRole('combobox');
    await playDive(user);
    await screen.findByRole('heading', { name: 'Dive complete' });
    expect(Object.keys(loadHistory(store, historyKey('common')))).toEqual(['1']);
    expect(loadHistory(store, historyKey('rare'))).toEqual({});
    const results = loadHistory(store, historyKey('common'))[1]!.results;
    for (const r of results) expect(r.points).toBe(r.tier === null ? 0 : TIER_POINTS[(7 - r.tier) as 1]);
    expect(screen.getByLabelText('Your result').textContent).toMatch(/^NYLON COMMON #1: \d+\n/);
  });
});

describe('streaks, results and the other mode', () => {
  it('counts a day for the streak when either mode was finished', async () => {
    const user = setup();
    show(memory(), '#common');
    await user.click(await screen.findByRole('button', { name: 'PLAY COMMON SHOT' }));
    await screen.findByRole('combobox');
    await playDive(user);
    await user.click(await screen.findByRole('button', { name: 'Home' }));
    expect(await screen.findByTestId('streak-current')).toHaveTextContent('1 day');
    await user.click(screen.getByRole('radio', { name: /RARE/ }));
    expect(screen.getByTestId('streak-current')).toHaveTextContent('1 day');
    expect(screen.getByRole('button', { name: 'PLAY RARE SHOT' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /COMMON/ }));
    expect(screen.getByRole('button', { name: 'VIEW COMMON RESULTS' })).toBeInTheDocument();
  });

  it('offers "Play the other mode" on the results: it starts the same dive in the other mode, and the best score is per mode', async () => {
    const user = setup();
    const store = memory();
    show(store, '#rare');
    await user.click(await screen.findByRole('button', { name: 'PLAY RARE SHOT' }));
    await screen.findByRole('combobox');
    await playDive(user);
    await screen.findByRole('heading', { name: 'Dive complete' });
    expect(screen.getByTestId('final-best').textContent).toContain('NEW BEST');
    await user.click(screen.getByRole('button', { name: 'PLAY THE OTHER MODE (COMMON)' }));
    await screen.findByRole('combobox');
    expect(screen.getByTestId('hud-mode')).toHaveTextContent('COMMON');
    expect(window.location.hash).toBe('#common');
    expect(screen.getByRole('group', { name: 'Prompt 1 of 7' })).toBeInTheDocument();
    await playDive(user);
    expect(await screen.findByText(/DIVE #1 · COMMON/)).toBeInTheDocument();
    expect(Object.keys(loadHistory(store, historyKey('rare')))).toEqual(['1']);
    expect(Object.keys(loadHistory(store, historyKey('common')))).toEqual(['1']);
    await user.click(screen.getByRole('button', { name: 'PLAY THE OTHER MODE (RARE)' }));
    expect(await screen.findByText(/DIVE #1 · RARE/)).toBeInTheDocument();
  });

  it('puts a switch for the mode on the archive too', async () => {
    const user = setup();
    show(memory());
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Mode' })).getByRole('radio', { name: /COMMON/ }));
    expect(screen.getByText(/in COMMON mode/)).toBeInTheDocument();
  });
});

describe('the old Deep Cut data', () => {
  it('is copied to the nylon keys and counted: the streak and the archive survive the rename', async () => {
    const store = memory();
    const history = { 1: { results: dive().map((p) => ({ promptId: p.id, status: 'valid', input: 'x', matched: null, tier: 3, points: 35, countsAsWrong: false })), daily: true } };
    store.setItem(LEGACY_KEYS.history, JSON.stringify(history));
    store.setItem(LEGACY_KEYS.sound, 'on');
    show(store);
    await screen.findByRole('heading', { name: 'Dive complete' });
    expect(screen.getByTestId('final-streak')).toHaveTextContent('1 day');
    expect(store.getItem(historyKey('rare'))).toBe(JSON.stringify(history));
    expect(store.getItem(LEGACY_KEYS.history)).toBe(JSON.stringify(history));
    expect(store.getItem('nylon:sound')).toBe('on');
    expect(await screen.findByRole('button', { name: /Sound on/ })).toBeInTheDocument();
  });
});
