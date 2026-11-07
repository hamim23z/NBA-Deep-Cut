import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { diveNumberOn } from './schedule';
import { PROMPTS_PATH, UNIVERSE_PATH, readJson } from './testUtils';

// The other tests run on a fixed calendar (setupTests mocks the launch date); these use the real constants.
const real = await vi.importActual<typeof import('./config')>('./config');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : u.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : readJson(PROMPTS_PATH);
    return new Response(JSON.stringify(body), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = (iso: string, search = '') => render(<App now={() => new Date(iso)} search={search} launchDate={real.LAUNCH_DATE} storage={null} />);

describe('the real launch gate', () => {
  it('launches on 29 October 2026, New York time, and the site address is the live one', () => {
    expect(real.LAUNCH_DATE).toBe('2026-10-29');
    expect(real.TIME_ZONE).toBe('America/New_York');
    expect(real.SITE_URL).toBe('https://nba-deep-cut.vercel.app');
  });

  it('numbers the days from the launch date: 29 October is dive #1, 30 October is #2', () => {
    expect(diveNumberOn('2026-10-29', real.LAUNCH_DATE)).toBe(1);
    expect(diveNumberOn('2026-10-30', real.LAUNCH_DATE)).toBe(2);
    expect(diveNumberOn('2026-10-28', real.LAUNCH_DATE)).toBe(0);
  });

  it('shows the coming-soon screen up to the last second before midnight in New York on 28 October', async () => {
    show('2026-10-29T03:59:59Z');
    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(screen.getByText('29 October 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play/ })).not.toBeInTheDocument();
  });

  it('is playable from midnight New York time on launch day: dive #1', async () => {
    show('2026-10-29T04:00:00Z');
    expect(await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ })).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('is dive #2 the next New York day, and still #1 at 11:59 pm on launch day', async () => {
    const { unmount } = show('2026-10-30T03:59:59Z');
    expect(await screen.findByText('#1')).toBeInTheDocument();
    unmount();
    show('2026-10-30T04:00:00Z');
    expect(await screen.findByText('#2')).toBeInTheDocument();
  });

  it('?preview=1 shows a Play-test before the launch', async () => {
    const { unmount } = show('2026-10-20T12:00:00Z');
    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play-test' })).not.toBeInTheDocument();
    unmount();
    show('2026-10-20T12:00:00Z', '?preview=1');
    expect(await screen.findByRole('button', { name: 'Play-test' })).toBeInTheDocument();
  });
});
