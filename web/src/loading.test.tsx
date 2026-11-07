import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clearDataCache, loadData } from './loadData';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { PROMPTS_PATH, UNIVERSE_PATH, readJson } from './testUtils';
import type { Prompt } from './types';

const NOW = new Date('2026-11-03T17:00:00Z');
const body = (url: string, prompts: unknown = readJson(PROMPTS_PATH)) =>
  url.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : url.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : prompts;
const ok = (url: string, prompts?: unknown) => new Response(JSON.stringify(body(url, prompts)), { status: 200 });

beforeEach(() => clearDataCache());
afterEach(() => vi.unstubAllGlobals());

describe('while the data loads', () => {
  it('shows a styled loading state, never a blank page', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      await gate;
      return ok(url);
    }));
    render(<App now={() => NOW} search="" storage={null} />);
    expect(screen.getByText(/loading the game/i).closest('[role="status"]')).not.toBeNull();
    expect(document.querySelector('.loading__ball')).not.toBeNull();
    release();
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.queryByText(/loading the game/i)).not.toBeInTheDocument();
  });
});

describe('when the data cannot be loaded', () => {
  it('shows a friendly error with a retry button, and retrying loads the game', async () => {
    let failing = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (failing ? new Response('nope', { status: 503 }) : ok(url))));
    const user = userEvent.setup();
    render(<App now={() => NOW} search="" storage={null} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.t load the game/i);
    expect(alert).toHaveTextContent(/could not load universe\.json \(503\)/i);
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    render(<App now={() => NOW} search="" storage={null} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no connection/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so when a file is not valid JSON, or fails validation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>not json</html>', { status: 200 })));
    const { unmount } = render(<App now={() => NOW} search="" storage={null} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/i);
    unmount();
    clearDataCache();
    const bad = (readJson(PROMPTS_PATH) as Prompt[]).map((p) => ({ ...p, difficulty: 'impossible' }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ok(url, bad)));
    render(<App now={() => NOW} search="" storage={null} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/difficulty/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('a file with fewer than 7 prompts is an error, not an empty game', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ok(url, (readJson(PROMPTS_PATH) as Prompt[]).slice(0, 5))));
    render(<App now={() => NOW} search="" storage={null} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no complete dive/i);
  });

  it('a missing outside_range.json is not an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('outside_range.json') ? new Response('', { status: 404 }) : ok(url))));
    render(<App now={() => NOW} search="" storage={null} />);
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
  });
});

describe('the data is loaded once and kept in memory', () => {
  it('fetches each file once however many times it is asked for', async () => {
    const fetchMock = vi.fn(async (url: string) => ok(url));
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([loadData('/'), loadData('/')]);
    await loadData('/');
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(3); // universe, prompts, outside_range
  });

  it('does not cache a failure', async () => {
    let failing = true;
    const fetchMock = vi.fn(async (url: string) => (failing ? new Response('x', { status: 500 }) : ok(url)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadData('/')).rejects.toThrow(/500/);
    failing = false;
    await expect(loadData('/')).resolves.toBeDefined();
  });

  it('does not fetch again when the app is shown a second time', async () => {
    const fetchMock = vi.fn(async (url: string) => ok(url));
    vi.stubGlobal('fetch', fetchMock);
    const first = render(<App now={() => NOW} search="" storage={null} />);
    await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ });
    first.unmount();
    render(<App now={() => NOW} search="" storage={null} />);
    await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('a crash while rendering', () => {
  it('shows the error screen instead of a blank page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Boom(): never {
      throw new Error('boom');
    }
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(/boom/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders its children when nothing goes wrong', () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
