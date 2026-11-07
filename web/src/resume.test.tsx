import { displayText } from './components/PromptText';
import { ballY } from './modes';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { historyKey, progressKey } from './config';

const STORAGE_KEY = historyKey('rare');
const PROGRESS_KEY = progressKey();
import { divePrompts } from './schedule';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { loadHistory, loadProgress, saveProgress, type Progress, type StorageLike } from './storage';
import { PROMPTS_PATH, UNIVERSE_PATH, mockPrompts, readJson } from './testUtils';
import type { Prompt, PromptResult } from './types';

const DAY1 = '2026-11-03T17:00:00Z';
const DAY2 = '2026-11-04T17:00:00Z';
const dive = (): Prompt[] => divePrompts(mockPrompts(), 1);

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(DAY1));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : u.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : readJson(PROMPTS_PATH);
    return new Response(JSON.stringify(body), { status: 200 });
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
type User = ReturnType<typeof setup>;
const open = (store: StorageLike | null) => render(<App now={() => new Date()} search="" storage={store} />);
const promptText = (): string => screen.getByRole('heading', { level: 2 }).textContent ?? '';
const answerWith = async (user: User, name: string) => {
  await user.type(screen.getByRole('combobox'), name);
  await user.keyboard('{Enter}');
};
const nextButton = (last = false) => screen.findByRole('button', { name: last ? 'SEE RESULTS ▶' : /^(SINK|CLIMB) ▶$/ });

/** Start today's dive and answer the first n prompts with their best-known answer (staying on the result of the last one when stay). */
async function playFirst(user: User, store: StorageLike, n: number, stay = false) {
  const r = open(store);
  await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
  await screen.findByRole('combobox');
  let points = 0;
  for (let i = 0; i < n; i++) {
    const a = dive()[i]!.answers[0]!;
    points += a.points;
    await answerWith(user, a.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    if (!(stay && i === n - 1)) await user.click(await nextButton(i === 6));
  }
  return { ...r, points };
}

describe('reloading in the middle of a dive', () => {
  it('resumes at the next unanswered prompt, with the same prompts and the same score', async () => {
    const user = setup();
    const store = memory();
    const first = await playFirst(user, store, 3);
    first.unmount();

    open(store);
    await screen.findByRole('combobox');
    expect(promptText()).toBe(displayText(dive()[3]!.text));
    expect(await screen.findByText(/Prompt 4 of 7/)).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard-points')).toHaveTextContent(String(first.points));
    const world = await screen.findByTestId('world');
    expect(world).toHaveAttribute('data-total', String(first.points));
    expect(Number(world.getAttribute('data-ball-y'))).toBeCloseTo(ballY('rare', first.points), 1);
    expect(screen.getByRole('group', { name: 'Prompt 4 of 7' })).toBeInTheDocument();
  });

  it('plays the rest of the dive to the same total as an unbroken dive', async () => {
    const user = setup();
    const store = memory();
    const first = await playFirst(user, store, 2);
    first.unmount();
    open(store);
    await screen.findByRole('combobox');
    let total = first.points;
    for (let i = 2; i < 7; i++) {
      const a = dive()[i]!.answers[0]!;
      total += a.points;
      expect(promptText()).toBe(displayText(dive()[i]!.text));
      await answerWith(user, a.name);
      await screen.findByRole('heading', { level: 3, name: /points/ });
      await user.click(await nextButton(i === 6));
    }
    expect(screen.getByLabelText(`Total ${total} out of 700`)).toBeInTheDocument();
    expect(loadHistory(store, STORAGE_KEY)[1]?.results).toHaveLength(7);
    expect(store.data.get(PROGRESS_KEY)).toBe(''); // nothing left to resume
  });

  it('a reload on a result screen goes to the next prompt: the answered prompt is not replayed or changed', async () => {
    const user = setup();
    const store = memory();
    const first = await playFirst(user, store, 3, true); // sitting on the result of prompt 3
    first.unmount();
    const before = loadProgress(store, PROGRESS_KEY)!;
    expect(before.results).toHaveLength(3);
    open(store);
    await screen.findByRole('combobox');
    expect(promptText()).toBe(displayText(dive()[3]!.text));
    expect(loadProgress(store, PROGRESS_KEY)!.results).toEqual(before.results);
    expect(screen.getByTestId('scoreboard-points')).toHaveTextContent(String(first.points));
  });

  it('saves after every answer', async () => {
    const user = setup();
    const store = memory();
    await playFirst(user, store, 1, true);
    expect(loadProgress(store, PROGRESS_KEY)!.results).toHaveLength(1);
    await user.click(await nextButton());
    await screen.findByRole('combobox');
    await answerWith(user, dive()[1]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const saved = loadProgress(store, PROGRESS_KEY)!;
    expect(saved.results).toHaveLength(2);
    expect(saved.promptIds).toEqual(dive().map((p) => p.id));
    expect(saved.mode).toBe('daily');
    expect(saved.number).toBe(1);
  });

  it('after the seventh answer a reload opens the results and counts the dive', async () => {
    const user = setup();
    const store = memory();
    const first = await playFirst(user, store, 7, true);
    first.unmount();
    open(store);
    expect(await screen.findByRole('heading', { name: 'Dive complete' })).toBeInTheDocument();
    expect(screen.getByLabelText(`Total ${first.points} out of 700`)).toBeInTheDocument();
    expect(loadHistory(store, STORAGE_KEY)[1]?.daily).toBe(true);
  });

  it('leaving the dive for Home and pressing Play resumes it instead of restarting', async () => {
    const user = setup();
    const store = memory();
    await playFirst(user, store, 2);
    await user.click(screen.getByRole('button', { name: 'NYLON, home' }));
    await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    expect(await screen.findByText(/Prompt 3 of 7/)).toBeInTheDocument();
    expect(promptText()).toBe(displayText(dive()[2]!.text));
  });
});

describe('the clock keeps running while the page is closed', () => {
  async function leaveOnPrompt(user: User, store: StorageLike) {
    const first = await playFirst(user, store, 1);
    await screen.findByRole('combobox'); // prompt 2 is on screen, its clock started
    first.unmount();
  }

  it('resumes the prompt with the time that is left', async () => {
    const user = setup();
    const store = memory();
    await leaveOnPrompt(user, store);
    vi.setSystemTime(new Date(Date.now() + 10_000));
    open(store);
    await screen.findByRole('combobox');
    const seconds = Number(screen.getByRole('timer').textContent?.match(/\d+/)?.[0]);
    expect(seconds).toBeLessThanOrEqual(15);
    expect(seconds).toBeGreaterThanOrEqual(13);
  });

  it('counts a prompt whose 25 seconds ran out as a timeout, and moves on to the next', async () => {
    const user = setup();
    const store = memory();
    await leaveOnPrompt(user, store);
    vi.setSystemTime(new Date(Date.now() + 40_000));
    open(store);
    await screen.findByRole('combobox');
    expect(await screen.findByText(/Prompt 3 of 7/)).toBeInTheDocument();
    await vi.waitFor(() => expect(loadProgress(store, PROGRESS_KEY)?.results).toHaveLength(2));
    const saved = loadProgress(store, PROGRESS_KEY)!;
    expect(saved.results[1]!.status).toBe('timeout');
    expect(saved.results[1]!.points).toBe(0);
  });

  it('a reload does not give a fresh 25 seconds for the same prompt', async () => {
    const user = setup();
    const store = memory();
    await leaveOnPrompt(user, store);
    vi.setSystemTime(new Date(Date.now() + 20_000));
    open(store);
    await screen.findByRole('combobox');
    const seconds = Number(screen.getByRole('timer').textContent?.match(/\d+/)?.[0]);
    expect(seconds).toBeLessThan(25);
  });
});

describe('stale or damaged saved progress', () => {
  const progress = (over: Partial<Progress> = {}): Progress => ({
    number: 1, mode: 'daily', promptIds: dive().map((p) => p.id), startedAt: null,
    results: dive().slice(0, 2).map((p): PromptResult => ({ promptId: p.id, status: 'invalid', input: 'x', matched: null, tier: null, points: 0, countsAsWrong: true })),
    ...over,
  });

  it("discards a daily dive from a previous day and starts the new day's dive", async () => {
    const store = memory();
    saveProgress(store, PROGRESS_KEY, progress());
    vi.setSystemTime(new Date(DAY2));
    const user = setup();
    open(store);
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(store.data.get(PROGRESS_KEY)).toBe('');
    await user.click(screen.getByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    expect(await screen.findByText(/Prompt 1 of 7/)).toBeInTheDocument();
  });

  it('discards a saved dive whose prompts are no longer the same', async () => {
    const store = memory();
    saveProgress(store, PROGRESS_KEY, progress({ promptIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    open(store);
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(store.data.get(PROGRESS_KEY)).toBe('');
  });

  it('discards progress for a dive that is already finished', async () => {
    const store = memory();
    const user = setup();
    const first = await playFirst(user, store, 7);
    first.unmount();
    saveProgress(store, PROGRESS_KEY, progress());
    open(store);
    expect(await screen.findByRole('heading', { name: 'Dive complete' })).toBeInTheDocument();
    expect(store.data.get(PROGRESS_KEY)).toBe('');
  });

  it('ignores corrupted progress', async () => {
    const store = memory();
    store.data.set(PROGRESS_KEY, '{nope');
    open(store);
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });

  it('resumes an archive dive too', async () => {
    const store = memory();
    saveProgress(store, PROGRESS_KEY, progress({ number: 1, mode: 'archive' }));
    vi.setSystemTime(new Date(DAY2)); // dive 1 is a past dive now
    open(store);
    await screen.findByRole('combobox');
    expect(await screen.findByText(/Prompt 3 of 7/)).toBeInTheDocument();
  });

  it('plays on when the browser will not save progress', async () => {
    const user = setup();
    const broken: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    open(broken);
    await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    await answerWith(user, dive()[0]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    expect(screen.getByRole('button', { name: /^(SINK|CLIMB) ▶$/ })).toBeInTheDocument();
    expect(act).toBeDefined();
  });
});

describe('the progress storage', () => {
  const ok: Progress = { number: 4, mode: 'daily', promptIds: ['1', '2', '3', '4', '5', '6', '7'], results: [], startedAt: 5 };

  it('round-trips and clears', () => {
    const store = memory();
    expect(saveProgress(store, 'k', ok)).toBe(true);
    expect(loadProgress(store, 'k')).toEqual({ ...ok, gameMode: 'rare' });
    saveProgress(store, 'k', null);
    expect(loadProgress(store, 'k')).toBeNull();
  });

  it.each([
    ['not json', '{x'],
    ['an array', '[]'],
    ['a bad mode', JSON.stringify({ ...ok, mode: 'test' })],
    ['six prompt ids', JSON.stringify({ ...ok, promptIds: ['1', '2'] })],
    ['a bad number', JSON.stringify({ ...ok, number: 0 })],
    ['bad results', JSON.stringify({ ...ok, results: [{ promptId: 1 }] })],
    ['too many results', JSON.stringify({ ...ok, results: Array.from({ length: 8 }, () => ({ promptId: 'p', status: 'invalid', input: '', tier: null, points: 0 })) })],
  ])('ignores %s', (_, raw) => {
    const store = memory();
    store.data.set('k', raw);
    expect(loadProgress(store, 'k')).toBeNull();
  });

  it('never throws on a storage that fails, or on no storage', () => {
    const broken: StorageLike = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('y'); } };
    expect(loadProgress(broken, 'k')).toBeNull();
    expect(saveProgress(broken, 'k', ok)).toBe(false);
    expect(loadProgress(null, 'k')).toBeNull();
    expect(saveProgress(null, 'k', ok)).toBe(false);
  });
});
