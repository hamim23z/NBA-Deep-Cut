import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnimationsPage from './AnimationsPage';
import { FLAVOR, TIER_CLASS, ballY, formatFeet } from './modes';
import App from './App';
import { divePrompts } from './schedule';
import type { StorageLike } from './storage';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { PROMPTS_PATH, UNIVERSE_PATH, mockPrompts, readJson } from './testUtils';
import type { Prompt } from './types';

const LAUNCH = new Date('2026-11-03T17:00:00Z');
const dive = (): Prompt[] => divePrompts(mockPrompts(), 1);

const memory = (): StorageLike => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
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

async function begin(user: User, storage: StorageLike | null = memory()) {
  const r = render(<App now={() => LAUNCH} search="" storage={storage} />);
  await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
  await screen.findByRole('combobox');
  return r;
}
const answer = async (user: User, text: string) => {
  await user.type(screen.getByRole('combobox'), text);
  await user.keyboard('{Enter}');
};
const announcerText = () => screen.getByTestId('world-live').textContent ?? '';

describe('the HUD', () => {
  it('shows the altitude, the prompt pips, the score and the mode while a dive is on', async () => {
    const user = setup();
    await begin(user);
    expect(screen.getByRole('group', { name: 'Altitude' })).toBeInTheDocument();
    expect(screen.getByTestId('hud-altitude')).toHaveTextContent('7,000');
    expect(screen.getByRole('group', { name: 'Prompt 1 of 7' })).toBeInTheDocument();
    expect(screen.getByText('PROMPT 1 OF 7')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Score' })).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard-points')).toHaveTextContent('0');
    expect(screen.getByTestId('hud-mode')).toHaveTextContent('RARE · START ON THE MOON, SINK');
    expect(document.querySelectorAll('.pip')).toHaveLength(7);
  });

  it('ticks the score and the altitude to their new values as the ball arrives', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    await act(async () => void vi.advanceTimersByTime(2500));
    expect(screen.getByTestId('scoreboard-points')).toHaveTextContent(String(first.points));
    expect(screen.getByTestId('hud-altitude')).toHaveTextContent(formatFeet(7000 - first.points * 10));
  });

  it('colours a pip with the tier of the answer and puts its number in it', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    expect(document.querySelectorAll('.pip')[0]).toHaveTextContent(String(first.tier));
  });
});

const worldEl = (): Promise<HTMLElement> => screen.findByTestId('world');
const letArm = () => act(async () => void vi.advanceTimersByTime(250));

describe('the result card after an answer', () => {
  it('moves the ball by the points and shows the tier class, the answer, the points and a line about it', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const stage = await worldEl();
    await vi.waitFor(() => expect(stage).toHaveAttribute('data-phase', 'result'));
    expect(Number(stage.getAttribute('data-ball-y'))).toBeCloseTo(ballY('rare', first.points), 1);
    const card = document.querySelector('.result-card')!;
    expect(within(card as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent(TIER_CLASS[first.tier - 1]!);
    expect(card.querySelector('.result-card__pick')?.textContent).toBe('PICK');
    expect((card.querySelector('.result-card__answer') as HTMLInputElement).value).toBe(`"${first.name}"`);
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(card.querySelector('.result-card__points')?.textContent).toContain(`+${first.points} PTS · sink ${first.points * 10} ft`);
    expect(card.querySelector('.result-card__flavor')?.textContent).toBe(FLAVOR.rare[first.tier - 1]);
    expect(stage).toHaveAttribute('aria-hidden', 'true');
  });

  it('starts the next prompt exactly where the ball stopped', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const stage = await worldEl();
    const stopped = stage.getAttribute('data-ball-y');
    await user.click(screen.getByRole('button', { name: /^(SINK|CLIMB) ▶$/ }));
    await screen.findByRole('combobox');
    expect(stage.getAttribute('data-ball-y')).toBe(stopped);
    await answer(user, 'qwerty zxcv');
    await screen.findByRole('heading', { level: 3, name: /0 points/ });
    expect(stage.getAttribute('data-ball-y')).toBe(stopped);
  });

  it('says the result in a polite live line: the tier class, the points and the total', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    expect(announcerText()).toBe(`${TIER_CLASS[first.tier - 1]} pick, ${first.points} points, ${first.points} total`);
    expect(screen.getByTestId('world-live')).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps focus in an input: the answer stays focused and Enter goes on to the next prompt', async () => {
    const user = setup();
    await begin(user);
    await answer(user, dive()[0]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const kept = screen.getByLabelText('Your answer');
    expect(kept).toHaveFocus();
    await letArm();
    await user.keyboard('{Enter}');
    const input = await screen.findByRole('combobox');
    expect(input).toHaveFocus();
    expect(screen.getByText('PROMPT 2 OF 7')).toBeInTheDocument();
  });

  it('does not count the Enter that submitted the answer as "next"', async () => {
    const user = setup();
    await begin(user);
    await answer(user, dive()[0]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^(SINK|CLIMB) ▶$/ }));
    expect(await screen.findByRole('combobox')).toHaveFocus();
  });

  it('is an airball for a wrong answer: the ball does not move, the card says AIRBALL and +0', async () => {
    const user = setup();
    await begin(user);
    await answer(user, 'qwerty zxcv');
    await screen.findByRole('heading', { level: 3, name: /0 points/ });
    const stage = await worldEl();
    expect(stage).toHaveAttribute('data-total', '0');
    expect(Number(stage.getAttribute('data-ball-y'))).toBe(ballY('rare', 0));
    const card = document.querySelector('.result-card') as HTMLElement;
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('AIRBALL');
    expect(card.querySelector('.result-card__points')?.textContent).toContain('+0 PTS');
    expect(card).toHaveAttribute('data-tier', 'miss');
    expect(announcerText()).toBe('AIRBALL, 0 points, 0 total');
    expect(document.querySelector('.world__ball')).toHaveClass('is-shaking');
  });

  it('an outside-the-range name is a gentle airball, with a shake of the message', async () => {
    const user = setup();
    await begin(user);
    await answer(user, 'Orson Quillfeather');
    const heading = await screen.findByRole('heading', { level: 3, name: /Outside the data range/ });
    expect(heading).toHaveClass('shake');
    expect(screen.getByText(/does not count against you/i)).toBeInTheDocument();
  });

  it('skips the ball\'s move on a tap', async () => {
    const user = setup();
    await begin(user);
    await answer(user, dive()[0]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const card = document.querySelector('.result-card')!;
    await user.pointer({ target: card.querySelector('.result-card__pick')!, keys: '[MouseLeft]' });
    expect(card).toHaveClass('is-skipped');
    expect(await worldEl()).toHaveClass('is-skipped');
  });

  it('puts the points on the HUD at once when the move is skipped', async () => {
    const user = setup();
    await begin(user);
    const first = dive()[0]!.answers[0]!;
    await answer(user, first.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    await user.pointer({ target: document.querySelector('.result-card__pick')!, keys: '[MouseLeft]' });
    await act(async () => void vi.advanceTimersByTime(50));
    expect(screen.getByTestId('scoreboard-points')).toHaveTextContent(String(first.points));
  });
});

describe('the input', () => {
  it('shakes when a name needs disambiguation, and the message stays gentle', async () => {
    const user = setup();
    await begin(user);
    await answer(user, 'Dex Marrow');
    expect(screen.getByText(/could be Dex Marrow/)).toBeInTheDocument();
    expect(document.querySelector('.answer__row')).toHaveClass('shake');
    expect(screen.getByRole('combobox')).toHaveFocus(); // the shake never takes focus away
  });
});

describe('reduced motion', () => {
  it('moves the ball at once: no streaks, no celebration, and the card is still there', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined })));
    const user = setup();
    await begin(user);
    await answer(user, dive()[0]!.answers[0]!.name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    const card = document.querySelector('.result-card')!;
    expect(card).toHaveClass('is-reduced');
    const stage = await worldEl();
    await vi.waitFor(() => expect(stage).toHaveClass('is-reduced'));
    expect(stage.querySelector('.world__fx')).toBeNull();
    expect(document.querySelector('.world__ball')).not.toHaveClass('is-moving');
    expect((document.querySelector('.world__ball') as HTMLElement).style.transitionDuration).toBe('0ms');
    expect(announcerText()).toMatch(/points/);
  });
});

async function playWith(user: User, pick: (p: Prompt) => string): Promise<number> {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const p = dive()[i]!;
    const name = pick(p);
    total += p.answers.find((a) => a.name === name)?.points ?? 0;
    await answer(user, name);
    await screen.findByRole('heading', { level: 3, name: /points/ });
    await user.click(screen.getByRole('button', { name: i === 6 ? 'SEE RESULTS ▶' : /^(SINK|CLIMB) ▶$/ }));
  }
  return total;
}

describe('the results screen', () => {
  it('shows seven squares coloured by tier, each with its number, then the total', async () => {
    const user = setup();
    await begin(user);
    const total = await playWith(user, (p) => p.answers[0]!.name);
    const squares = within(screen.getByRole('list', { name: 'Your seven answers' })).getAllByRole('listitem');
    expect(squares).toHaveLength(7);
    for (const s of squares) expect(s.querySelector('.square__tier')?.textContent).toMatch(/^([1-6]|×)$/);
    expect(screen.getByRole('group', { name: `Total ${total} out of 700` })).toBeInTheDocument();
  });

  it('has the final altitude, the best score in the mode, a tier breakdown, the streak and a share line', async () => {
    const user = setup();
    await begin(user);
    const total = await playWith(user, (p) => p.answers[0]!.name);
    expect(screen.getByTestId('final-altitude').textContent).toMatch(/ ft · (MOON|ORBIT|CLOUDS|ROOF|RAFTERS|RIM)$/);
    expect(screen.getByTestId('final-best')).toHaveTextContent(`${total} · NEW BEST`);
    expect(screen.getByTestId('final-streak')).toHaveTextContent('1 day');
    expect(screen.getByRole('heading', { level: 3, name: 'Tier breakdown' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your result').textContent).toMatch(new RegExp(`^NYLON RARE #1: ${total}\\n`));
    expect(screen.getByRole('button', { name: 'PLAY THE OTHER MODE (COMMON)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('puts the ball on its final level in the world', async () => {
    const user = setup();
    await begin(user);
    await playWith(user, (p) => p.answers[0]!.name);
    expect(await worldEl()).toHaveAttribute('data-phase', 'results');
  });

  it('has no confetti or replay button: the only celebration is the end level', async () => {
    const user = setup();
    await begin(user);
    await playWith(user, (p) => p.answers[0]!.name);
    expect(document.querySelector('.confetti')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replay the shots' })).not.toBeInTheDocument();
  });
});

describe('the sound toggle', () => {
  it('is in the header, off by default, and turning it on is remembered', async () => {
    const user = setup();
    const store = memory();
    const first = render(<App now={() => LAUNCH} search="" storage={store} />);
    const toggle = await screen.findByRole('button', { name: /Sound off/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /Sound on/ })).toHaveAttribute('aria-pressed', 'true');
    expect(store.getItem('nylon:sound')).toBe('on');
    first.unmount();
    render(<App now={() => LAUNCH} search="" storage={store} />);
    expect(await screen.findByRole('button', { name: /Sound on/ })).toBeInTheDocument();
  });

  it('works with no storage', async () => {
    const user = setup();
    render(<App now={() => LAUNCH} search="" storage={null} />);
    await user.click(await screen.findByRole('button', { name: /Sound off/ }));
    expect(screen.getByRole('button', { name: /Sound on/ })).toBeInTheDocument();
  });
});

describe('the animation review page', () => {
  it('shows the ball moving for every tier, one button for each, a mode switch and a reduced-motion version', async () => {
    const user = setup();
    render(<AnimationsPage />);
    const stage = await screen.findByTestId('world');
    for (const name of ['airball', 'franchise', 'all-star', 'starter', 'rotation', 'bench', 'deep cut']) expect(screen.getByTestId(`demo-${name}`)).toBeInTheDocument();
    await user.click(screen.getByTestId('mode-common'));
    await user.click(screen.getByTestId('demo-franchise'));
    await vi.waitFor(() => expect(stage).toHaveAttribute('data-total', '100'));
    expect(stage).toHaveAttribute('data-mode', 'common');
    await user.click(screen.getByRole('checkbox', { name: /reduced-motion/i }));
    await vi.waitFor(() => expect(stage).toHaveClass('is-reduced'));
  });
});
