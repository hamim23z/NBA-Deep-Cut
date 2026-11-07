import { displayText } from './components/PromptText';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { divePrompts } from './schedule';
import { matchAnswer } from './matching';
import type { StorageLike } from './storage';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { PROMPTS_PATH, UNIVERSE_PATH, mockIndex, mockPrompts, mockUniverse, readJson } from './testUtils';
import { TIER_POINTS } from './tiers';
import type { Answer, Prompt } from './types';

// Launch day is 3 November 2026 in New York. These instants are around midday there.
const at = (date: string): Date => new Date(`${date}T17:00:00Z`);
const DAY = { launch: at('2026-11-03'), second: at('2026-11-04'), third: at('2026-11-05'), fifth: at('2026-11-07'), beforeLaunch: at('2026-10-29') };

const expectedDive = (): Prompt[] => divePrompts(mockPrompts(), 1);

/** Two dives of prompts: the mock file plus a renamed copy, so dive 2 differs from dive 1. */
function twoDives(): Prompt[] {
  const first = mockPrompts();
  return [...first, ...first.map((p) => ({ ...p, id: `${p.id}-b`, text: `${p.text} (copy)` }))];
}

function serveFiles(prompts: unknown = readJson(PROMPTS_PATH)) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : u.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : prompts;
    return new Response(JSON.stringify(body), { status: 200 });
  }));
}

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  serveFiles();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
type User = ReturnType<typeof setup>;
type AppProps = Partial<Parameters<typeof App>[0]>;

/** Render the app on a given day with a given store (a fresh in-memory one by default). */
function renderApp(day: Date = DAY.launch, props: AppProps = {}) {
  const storage = 'storage' in props ? props.storage : memory();
  return { storage, ...render(<App now={() => day} search="" {...props} storage={storage} />) };
}

async function start(user: User, day: Date = DAY.launch, props: AppProps = {}) {
  const r = renderApp(day, props);
  await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
  await screen.findByRole('combobox');
  return r;
}

const promptText = (): string => screen.getByRole('heading', { level: 2 }).textContent ?? '';
const typeAnswer = async (user: User, text: string) => {
  await user.type(screen.getByRole('combobox'), text);
  await user.keyboard('{Enter}');
};
const next = async (user: User, last = false) => user.click(await screen.findByRole('button', { name: last ? 'SEE RESULTS ▶' : /^(SINK|CLIMB) ▶$/ }));
const resultHeading = async () => (await screen.findByRole('heading', { level: 3, name: /points|data range/ })).textContent ?? '';

/** Answer all 7 prompts of the dive on screen with each prompt's first valid answer. Returns the total points. */
async function playWholeDive(user: User, dive: Prompt[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const answer = dive[i]!.answers[0]!;
    await typeAnswer(user, answer.name);
    total += answer.points;
    await resultHeading();
    await next(user, i === 6);
  }
  return total;
}

const validAnswers = (p: Prompt): Answer[] => p.answers;
const notValid = (p: Prompt): string => {
  const valid = new Set(p.answers.map((a) => a.id));
  const u = mockUniverse();
  return (p.answerType === 'player' ? u.players : u.teams).find((e) => !valid.has(e.id) && !e.name.includes('('))!.name;
};
/** A one-letter-short spelling of a long answer name that the matcher still resolves to the same entry. */
const typo = (a: Answer): string => {
  const index = mockIndex();
  for (let i = 1; i < a.name.length - 2; i++) {
    const text = a.name.slice(0, i) + a.name.slice(i + 1);
    const r = matchAnswer(index, text);
    if (r.kind === 'match' && r.entry.id === a.id && r.via === 'typo') return text;
  }
  throw new Error(`no typo found for ${a.name}`);
};

describe('loading and the screens around the game', () => {
  it('shows the home screen with Play, Archive and How to play, today\'s dive number, and no demo note about real data', async () => {
    const user = setup();
    renderApp();
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText(/demo data/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeInTheDocument();
  });

  it('labels the made-up fixture data clearly (only the fixtures are made up)', async () => {
    renderApp();
    await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ });
    expect(screen.getByText(/made up for the tests/i)).toBeInTheDocument();
  });

  it('explains the rules, the tier points, that rarity is an estimate, and the era', async () => {
    const user = setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'How to play' }));
    expect(screen.getByText(/7 prompts/)).toBeInTheDocument();
    expect(screen.getByText(/25 seconds/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Points by tier' });
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows.map((r) => r[1])).toEqual(['10', '20', '35', '55', '75', '100']);
    expect(rows.map((r) => r[2])).toEqual(['100', '75', '55', '35', '20', '10']);
    expect(screen.getByText(/estimate of how famous/i)).toBeInTheDocument();
    expect(screen.getByText(/approximation/i)).toBeInTheDocument();
    expect(screen.getByText(/2001-02 season onward/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });

  it('says so when the data cannot be loaded or does not follow the schema', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('refuses prompts whose answers are not in the universe', async () => {
    const prompts = readJson(PROMPTS_PATH) as Prompt[];
    prompts[0]!.answers[0]!.id = 'mock-pl-999';
    serveFiles(prompts);
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not in the universe/);
  });

  it('works without outside_range.json: the file only drives a gentle message', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith('outside_range.json')) return new Response('nope', { status: 404 });
      return new Response(JSON.stringify(u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : readJson(PROMPTS_PATH)), { status: 200 });
    }));
    renderApp();
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });
});

describe('a prompt', () => {
  it('shows the prompt, a 25 second countdown and a text input', async () => {
    const user = setup();
    await start(user);
    expect(promptText()).toBe(displayText(expectedDive()[0]!.text));
    expect(await screen.findByText(/Prompt 1 of 7/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('25');
    expect(screen.getByRole('combobox')).toHaveFocus();
    await act(async () => void vi.advanceTimersByTime(5000));
    expect(screen.getByRole('timer')).toHaveTextContent('20');
  });

  it('announces 10 and 5 seconds left, but not every second', async () => {
    const user = setup();
    await start(user);
    await act(async () => void vi.advanceTimersByTime(15_100));
    expect(screen.getByTestId('announcer')).toHaveTextContent('10 seconds left');
    await act(async () => void vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('announcer')).toHaveTextContent('5 seconds left');
  });

  it('runs out of time after 25 seconds: 0 points, and the answer is not scored', async () => {
    const user = setup();
    await start(user);
    await user.type(screen.getByRole('combobox'), 'Aldric Ash');
    await act(async () => void vi.advanceTimersByTime(25_200));
    expect(await resultHeading()).toBe("AIRBALL: Time's up: 0 points");
    expect(screen.getByText(/ran out of time/i)).toBeInTheDocument();
  });

  it('suggests from the whole universe, never only the valid answers', async () => {
    const user = setup();
    await start(user);
    const prompt = expectedDive()[0]!;
    const valid = new Set(validAnswers(prompt).map((a) => a.name));
    await user.type(screen.getByRole('combobox'), 'a');
    const options = screen.getAllByRole('option').map((o) => o.querySelector('.suggestion__name')?.textContent ?? '');
    expect(options.length).toBe(6);
    expect(options.some((n) => !valid.has(n))).toBe(true);
    // players and teams are both offered, whatever the prompt asks for
    await user.clear(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'har');
    const kinds = screen.getAllByRole('option').map((o) => o.querySelector('.suggestion__meta')?.textContent ?? '');
    expect(kinds.some((k) => k.includes('Team'))).toBe(true);
    expect(kinds.some((k) => k.includes('Player'))).toBe(true);
  });

  it('supports the keyboard: arrows move through suggestions, Enter picks, Escape closes', async () => {
    const user = setup();
    await start(user);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ald');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}');
    const active = screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true');
    expect(active).toBeDefined();
    expect(input).toHaveAttribute('aria-activedescendant', active!.id);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('heading', { level: 3, name: /points/ })).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(await resultHeading()).toMatch(/points/);
  });

  it('asks which one when two people share the typed name, without using up the prompt', async () => {
    const user = setup();
    await start(user);
    await typeAnswer(user, 'Dex Marrow');
    expect(screen.getByText(/could be Dex Marrow \(2003-2009\) or Dex Marrow \(2015-2022\)/)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('heading', { level: 3, name: /points/ })).not.toBeInTheDocument(); // still answering
    await user.click(screen.getAllByRole('option')[0]!);
    expect(screen.queryByRole('heading', { level: 3, name: /points/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(await resultHeading()).toMatch(/points/);
  });

  it('asks for something to be typed before it accepts an empty answer', async () => {
    const user = setup();
    await start(user);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText(/Type a name/i, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument(); // the prompt is still running
  });
});

describe('the reveal', () => {
  it('shows the tier and points, and the most famous and the rarest valid answers', async () => {
    const user = setup();
    await start(user);
    const prompt = expectedDive()[0]!;
    const sorted = validAnswers(prompt).map((a, i) => ({ a, i }));
    const pick = validAnswers(prompt)[4]!;
    await typeAnswer(user, pick.name);
    expect(await resultHeading()).toContain(`Tier ${pick.tier}: ${pick.points} points`);
    const famous = [...sorted].sort((x, y) => x.a.tier - y.a.tier || x.i - y.i).slice(0, 3).map((x) => x.a.name);
    const rarest = [...sorted].sort((x, y) => y.a.tier - x.a.tier || y.i - x.i).slice(0, 3).map((x) => x.a.name);
    const lists = screen.getAllByRole('list').filter((l) => l.className === 'answers');
    expect(within(lists[0]!).getAllByRole('listitem').map((li) => li.querySelector('.answers__name')?.textContent)).toEqual(famous);
    expect(within(lists[1]!).getAllByRole('listitem').map((li) => li.querySelector('.answers__name')?.textContent)).toEqual(rarest);
    expect(screen.getByText(`All ${prompt.answers.length} valid answers`)).toBeInTheDocument();
    expect(screen.getByLabelText('Your answer')).toHaveFocus();
  });

  it('says an invalid answer is invalid, and names the person it recognized', async () => {
    const user = setup();
    await start(user);
    const prompt = expectedDive()[0]!;
    const other = notValid(prompt);
    await typeAnswer(user, other);
    expect(await resultHeading()).toBe('AIRBALL: Not a valid answer: 0 points');
    expect(screen.getByText(`${other} is not a valid answer for this prompt.`)).toBeInTheDocument();
  });

  it('says "outside the data range" gently, scoring 0', async () => {
    const user = setup();
    await start(user);
    await typeAnswer(user, 'Orson Quillfeather');
    expect(await resultHeading()).toBe('AIRBALL: Outside the data range');
    expect(screen.getByText(/does not count against you/i)).toBeInTheDocument();
    expect(screen.queryByText(/not a valid answer/i)).not.toBeInTheDocument();
  });
});

describe('a full dive', () => {
  it('plays 7 prompts end to end and shows the total, seven colored squares and a share line', async () => {
    const user = setup();
    await start(user);
    const dive = expectedDive();
    expect(dive).toHaveLength(7);
    let expected = 0;
    const tiers: Array<number | null> = [];
    const record = (a: Answer | null) => {
      expected += a?.points ?? 0;
      tiers.push(a?.tier ?? null);
    };

    for (let i = 0; i < 7; i++) {
      const p = dive[i]!;
      expect(promptText()).toBe(displayText(p.text));
      expect(screen.getByText(new RegExp(`Prompt ${i + 1} of 7`))).toBeInTheDocument();
      const answers = validAnswers(p);
      if (i === 0) {
        await typeAnswer(user, answers[0]!.name); // an exact name
        record(answers[0]!);
      } else if (i === 1) {
        const long = answers.find((a) => a.name.length >= 11 && !a.name.includes('('))!;
        await typeAnswer(user, typo(long)); // a typo
        record(long);
      } else if (i === 2) {
        await typeAnswer(user, notValid(p)); // a real name that is not an answer
        record(null);
      } else if (i === 3) {
        await typeAnswer(user, 'qwerty zxcv'); // gibberish
        record(null);
      } else if (i === 4) {
        await typeAnswer(user, 'Orson Quillfeather'); // outside the data range
        record(null);
      } else if (i === 5) {
        await act(async () => void vi.advanceTimersByTime(25_200)); // out of time
        record(null);
      } else {
        const deepest = [...answers].sort((a, b) => b.tier - a.tier)[0]!;
        await typeAnswer(user, deepest.name);
        record(deepest);
      }
      await resultHeading();
      await next(user, i === 6);
    }

    const total = screen.getByLabelText(/^Total \d+ out of 700$/);
    expect(total).toHaveAttribute('aria-label', `Total ${expected} out of 700`);
    const squares = within(screen.getByRole('list', { name: 'Your seven answers' })).getAllByRole('listitem');
    expect(squares).toHaveLength(7);
    squares.forEach((s, i) => {
      const t = tiers[i];
      expect(s.querySelector('.square__tier')?.textContent).toBe(t === null ? '×' : String(t));
      expect(s.getAttribute('aria-label')).toMatch(new RegExp(`^Prompt ${i + 1}: ${t === null ? '(not a valid|time ran out|outside)' : `tier ${t}, ${TIER_POINTS[t as 1]} points`}`));
    });
    expect(tiers.filter((t) => t === null)).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Dive complete' })).toHaveFocus();

    // share: the line uses the dive number, is shown, and copies to the clipboard
    const preview = screen.getByLabelText('Your result');
    expect(preview.textContent).toMatch(new RegExp(`^NYLON RARE #1: ${expected}\\n.{7,21}\\nhttps://`, 's'));
    await user.click(screen.getByRole('button', { name: 'COPY RESULT' }));
    expect(await navigator.clipboard.readText()).toBe(preview.textContent);
    expect(screen.getByTestId('announcer')).toHaveTextContent('Copied to the clipboard.');
  });

  it('shows the share text to copy by hand when the clipboard is refused, and goes home afterwards', async () => {
    const user = setup();
    await start(user);
    await playWholeDive(user, expectedDive());
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'COPY RESULT' }));
    const box = await screen.findByLabelText('Your result, ready to copy');
    expect((box as HTMLTextAreaElement).value).toMatch(/^NYLON RARE #1: \d+\n/);
    expect(screen.getByTestId('announcer')).toHaveTextContent(/Could not copy/);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('button', { name: /^VIEW (RARE|COMMON) RESULTS$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).not.toBeInTheDocument();
  });
});

describe('the daily rotation', () => {
  it('plays prompts 7N to 7N+6 for dive N+1 and starts again after the last dive', async () => {
    serveFiles(twoDives());
    const user = setup();
    await start(user, DAY.second);
    expect(promptText()).toBe(displayText(twoDives()[7]!.text));
    expect(await screen.findByText(/Prompt 1 of 7/)).toBeInTheDocument();
  });

  it('wraps to the first dive when the file has fewer dives than days', async () => {
    serveFiles(twoDives());
    const user = setup();
    await start(user, DAY.third); // dive #3 of a 2-dive file is dive #1 again
    expect(promptText()).toBe(displayText(twoDives()[0]!.text));
  });

  it('gives everyone the same dive on the same New York day, whatever the clock says in UTC', async () => {
    const user = setup();
    // 04:30 UTC on 4 November is still 3 November (11:30 pm) in New York: dive #1
    renderApp(new Date('2026-11-04T04:30:00Z'));
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(user).toBeDefined();
  });
});

describe('before the launch', () => {
  it('shows a coming soon screen with the launch date and no way to play', async () => {
    renderApp(DAY.beforeLaunch);
    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(screen.getByText('3 November 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play-test' })).not.toBeInTheDocument();
  });

  it('offers a Play-test only with ?preview=1, and a test play is not saved', async () => {
    const user = setup();
    const { storage } = renderApp(DAY.beforeLaunch, { search: '?preview=1' });
    await user.click(await screen.findByRole('button', { name: 'Play-test' }));
    await screen.findByRole('combobox');
    expect(promptText()).toBe(displayText(expectedDive()[0]!.text));
    await playWholeDive(user, expectedDive());
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect((storage as ReturnType<typeof memory>).data.size).toBe(0);
  });

  it('lets ?preview=1&today=... pretend it is a later day, with its own saved progress', async () => {
    const user = setup();
    const { storage } = renderApp(DAY.beforeLaunch, { search: '?preview=1&today=2026-11-04' });
    expect(await screen.findByText('#2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    await playWholeDive(user, divePrompts(mockPrompts(), 2));
    const keys = [...(storage as ReturnType<typeof memory>).data.keys()];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith('nylon:preview:'))).toBe(true);
  });

  it('ignores ?today=... without ?preview=1 and ignores a bad date', async () => {
    renderApp(DAY.beforeLaunch, { search: '?today=2026-11-04' });
    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
  });
});

describe('already played today', () => {
  it('opens straight on the results screen, with the share button, after a reload', async () => {
    const user = setup();
    const store = memory();
    const first = await start(user, DAY.launch, { storage: store });
    const total = await playWholeDive(user, expectedDive());
    first.unmount();

    renderApp(DAY.launch, { storage: store }); // a reload on the same device
    expect(await screen.findByRole('heading', { name: 'Dive complete' })).toBeInTheDocument();
    expect(screen.getByLabelText(`Total ${total} out of 700`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'COPY RESULT' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your result').textContent).toMatch(new RegExp(`^NYLON RARE #1: ${total}\\n`));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('does not open on results the next day, and the new day can be played', async () => {
    const user = setup();
    const store = memory();
    const first = await start(user, DAY.launch, { storage: store });
    await playWholeDive(user, expectedDive());
    first.unmount();
    renderApp(DAY.second, { storage: store });
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});

describe('streaks', () => {
  it('shows the current and best streak on the home screen and counts consecutive days', async () => {
    const user = setup();
    const store = memory();
    for (const day of [DAY.launch, DAY.second]) {
      const r = await start(user, day, { storage: store });
      await playWholeDive(user, divePrompts(mockPrompts(), 1));
      r.unmount();
    }
    renderApp(DAY.second, { storage: store });
    await user.click(await screen.findByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('streak-current')).toHaveTextContent('2 days');
    expect(screen.getByTestId('streak-best')).toHaveTextContent('2 days');
  });

  it('a day with no dive breaks the current streak but keeps the best', async () => {
    const user = setup();
    const store = memory();
    for (const day of [DAY.launch, DAY.second]) {
      const r = await start(user, day, { storage: store });
      await playWholeDive(user, divePrompts(mockPrompts(), 1));
      r.unmount();
    }
    renderApp(DAY.fifth, { storage: store }); // days 3 and 4 skipped
    expect(await screen.findByTestId('streak-current')).toHaveTextContent('0 days');
    expect(screen.getByTestId('streak-best')).toHaveTextContent('2 days');
  });

  it('wrong answers and outside-range answers do not break or lower it: only finishing the dive matters', async () => {
    const user = setup();
    const store = memory();
    let r = await start(user, DAY.launch, { storage: store });
    for (let i = 0; i < 7; i++) {
      await typeAnswer(user, i % 2 === 0 ? 'Orson Quillfeather' : 'qwerty zxcv');
      await resultHeading();
      await next(user, i === 6);
    }
    r.unmount();
    r = await start(user, DAY.second, { storage: store });
    await playWholeDive(user, divePrompts(mockPrompts(), 1));
    r.unmount();
    renderApp(DAY.second, { storage: store });
    await user.click(await screen.findByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('streak-current')).toHaveTextContent('2 days');
  });
});

describe('the archive', () => {
  it('lists dive 1 up to today, newest first, with Play for the ones not played', async () => {
    const user = setup();
    renderApp(DAY.third);
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const rows = within(screen.getByRole('heading', { name: 'Archive' }).closest('section')!).getAllByRole('listitem').filter((li) => li.className === 'archive__item');
    expect(rows.map((r) => within(r).getByText(/^Dive #/).textContent)).toEqual(['Dive #3', 'Dive #2', 'Dive #1']);
    expect(screen.getAllByRole('button', { name: /^Play dive/ })).toHaveLength(3);
  });

  it('shows the score and a colored strip for played dives and a Results button', async () => {
    const user = setup();
    const store = memory();
    const first = await start(user, DAY.launch, { storage: store });
    const total = await playWholeDive(user, expectedDive());
    first.unmount();
    renderApp(DAY.second, { storage: store });
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(screen.getByLabelText(`${total} out of 700`)).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: 'Dive 1 answers' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Play dive 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play dive 1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Results of dive 1' }));
    expect(await screen.findByRole('heading', { name: 'Dive complete' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your result').textContent).toMatch(/^NYLON RARE #1: /);
  });

  it('plays a past dive from the archive: counts for the archive but not for the streak, and the share line uses its number', async () => {
    const user = setup();
    const store = memory();
    renderApp(DAY.third, { storage: store });
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Play dive 2' }));
    await screen.findByRole('combobox');
    const total = await playWholeDive(user, divePrompts(mockPrompts(), 2));
    expect(screen.getByLabelText('Your result').textContent).toMatch(new RegExp(`^NYLON RARE #2: ${total}\\n`));
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getByLabelText(`${total} out of 700`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('streak-current')).toHaveTextContent('0 days');
    expect(screen.getByTestId('streak-best')).toHaveTextContent('0 days');
    expect(screen.getByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });

  it("playing today's dive from the archive counts as the daily play", async () => {
    const user = setup();
    renderApp(DAY.launch);
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Play dive 1' }));
    await screen.findByRole('combobox');
    await playWholeDive(user, expectedDive());
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('streak-current')).toHaveTextContent('1 day');
  });
});

describe('storage that does not work', () => {
  it('plays a whole dive with no storage at all and says nothing will be kept', async () => {
    const user = setup();
    renderApp(DAY.launch, { storage: null });
    expect(await screen.findByText(/not saving anything/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    await playWholeDive(user, expectedDive());
    expect(screen.getByRole('heading', { name: 'Dive complete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^VIEW (RARE|COMMON) RESULTS$/ })).toBeInTheDocument();
    expect(screen.getByTestId('streak-current')).toHaveTextContent('1 day');
  });

  it('survives a store that throws on every read and write', async () => {
    const user = setup();
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    renderApp(DAY.launch, { storage: broken });
    await user.click(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ }));
    await screen.findByRole('combobox');
    await playWholeDive(user, expectedDive());
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByText(/not saving anything/i)).toBeInTheDocument();
  });

  it('ignores corrupted saved data and starts fresh', async () => {
    const store = memory();
    store.data.set('nylon:history:rare', '{not json');
    renderApp(DAY.launch, { storage: store });
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });
});
