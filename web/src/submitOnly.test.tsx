import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AnswerInput } from './components/AnswerInput';
import { buildIndex } from './matching';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { divePrompts } from './schedule';
import type { StorageLike } from './storage';
import { PROMPTS_PATH, UNIVERSE_PATH, mockPrompts, mockUniverse, readJson } from './testUtils';

const LAUNCH = new Date('2026-11-03T17:00:00Z');
const first = () => divePrompts(mockPrompts(), 1)[0]!.answers[0]!;
const started = { count: 0 };

class FakeAudio {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = () => Promise.resolve();
  createGain = () => ({ gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => ({ connect: () => undefined }) });
  createOscillator = () => ({ type: '', frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => ({ connect: () => undefined }), start: () => { started.count++; }, stop: () => undefined });
}

const storeWithSound = (): StorageLike => {
  const data = new Map<string, string>([['nylon:sound', 'on']]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

beforeEach(() => {
  started.count = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('AudioContext', FakeAudio);
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
const world = () => screen.getByTestId('world');
const resultCard = () => document.querySelector('.result-card');

async function openPrompt(user: ReturnType<typeof setup>) {
  render(<App now={() => LAUNCH} search="" storage={storeWithSound()} />);
  await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
  return screen.findByRole('combobox');
}

describe('in the game: only a submit answers', () => {
  it('fills the input when a suggestion is clicked, and plays nothing, answers nothing and moves nothing', async () => {
    const user = setup();
    const input = (await openPrompt(user)) as HTMLInputElement;
    const answer = first();
    await user.type(input, answer.name.slice(0, 4));
    const option = screen.getAllByRole('option')[0]!;
    const name = option.querySelector('.suggestion__name')!.textContent!;
    await user.hover(option);
    expect(started.count).toBe(0);
    await user.click(option);
    expect(input.value).toBe(name);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(resultCard()).toBeNull();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(started.count).toBe(0);
    expect(world()).toHaveAttribute('data-phase', 'prompt');
    expect(world()).toHaveAttribute('data-total', '0');
    expect(document.querySelector('.world__ball')).not.toHaveClass('is-moving');
    expect(document.querySelectorAll('.pip--done')).toHaveLength(0);
  });

  it('answers when ANSWER is clicked after a suggestion was picked, once', async () => {
    const user = setup();
    const input = (await openPrompt(user)) as HTMLInputElement;
    await user.type(input, first().name.slice(0, 4));
    await user.click(screen.getAllByRole('option')[0]!);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(await screen.findByRole('heading', { level: 3, name: /points|AIRBALL/ })).toBeInTheDocument();
    expect(resultCard()).not.toBeNull();
    expect(world()).toHaveAttribute('data-phase', 'result');
    expect(started.count).toBeGreaterThan(0);
  });

  it('fills only on Enter with a highlighted suggestion, and submits on the second Enter', async () => {
    const user = setup();
    const input = (await openPrompt(user)) as HTMLInputElement;
    await user.type(input, first().name.slice(0, 4));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input.value.length).toBeGreaterThan(0);
    expect(resultCard()).toBeNull();
    expect(started.count).toBe(0);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 3, name: /points|AIRBALL/ })).toBeInTheDocument();
  });

  it('typing and focusing play nothing', async () => {
    const user = setup();
    const input = await openPrompt(user);
    await user.click(input);
    await user.type(input, 'abc');
    await user.keyboard('{ArrowDown}{ArrowUp}{Escape}');
    expect(started.count).toBe(0);
    expect(resultCard()).toBeNull();
    expect(world()).toHaveAttribute('data-phase', 'prompt');
  });

  it('counts a double submit once', async () => {
    const user = setup();
    const input = await openPrompt(user);
    await user.type(input, first().name);
    await user.dblClick(screen.getByRole('button', { name: 'Answer' }));
    await screen.findByRole('heading', { level: 3, name: /points|AIRBALL/ });
    expect(document.querySelectorAll('.pip--done')).toHaveLength(1);
    expect(document.querySelectorAll('.result-card')).toHaveLength(1);
    const tones = started.count;
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(started.count).toBe(tones);
  });

  it('answers a timeout as an empty answer, once', async () => {
    const user = setup();
    await openPrompt(user);
    await act(async () => void vi.advanceTimersByTime(26000));
    expect(await screen.findByRole('heading', { level: 3, name: /0 points/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.pip--done')).toHaveLength(1);
  });
});

describe('the answer input alone', () => {
  const index = () => buildIndex(mockUniverse());
  const setupInput = () => {
    const onSubmitText = vi.fn();
    const onPick = vi.fn();
    render(<AnswerInput index={index()} onSubmitText={onSubmitText} onPick={onPick} labelledBy="x" />);
    return { onSubmitText, onPick, input: screen.getByRole('combobox') as HTMLInputElement };
  };

  it('does not call a handler when a suggestion is clicked, and calls the pick handler once on ANSWER', async () => {
    const user = userEvent.setup();
    const { onSubmitText, onPick, input } = setupInput();
    await user.type(input, first().name.slice(0, 4));
    await user.click(screen.getAllByRole('option')[0]!);
    expect(onPick).not.toHaveBeenCalled();
    expect(onSubmitText).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![1]).toBe(input.value);
    expect(onSubmitText).not.toHaveBeenCalled();
  });

  it('submits typed text with Enter when nothing is highlighted, and not before', async () => {
    const user = userEvent.setup();
    const { onSubmitText, onPick, input } = setupInput();
    await user.type(input, 'zzz');
    expect(onSubmitText).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSubmitText).toHaveBeenCalledTimes(1);
    expect(onSubmitText.mock.calls[0]![0]).toBe('zzz');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('forgets the picked name when the text is edited', async () => {
    const user = userEvent.setup();
    const { onSubmitText, onPick, input } = setupInput();
    await user.type(input, first().name.slice(0, 4));
    await user.click(screen.getAllByRole('option')[0]!);
    await user.type(input, 'x');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onSubmitText).toHaveBeenCalledTimes(1);
  });
});
