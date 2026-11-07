import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { Home } from './components/Home';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { PROMPTS_PATH, UNIVERSE_PATH, readJson } from './testUtils';

describe('the home screen', () => {
  const props = { number: 12, mode: 'rare' as const, onMode: vi.fn(), played: false, streaks: { current: 3, best: 5 }, saving: true, onPlay: vi.fn(), onResults: vi.fn(), onArchive: vi.fn(), onHowTo: vi.fn() };

  it('has the NYLON title as the page heading, a tagline, a big play button, archive, how to play, and both streaks', () => {
    render(<Home {...props} />);
    expect(screen.getByRole('heading', { level: 1, name: 'NYLON' })).toBeInTheDocument();
    expect(screen.getByText('CLIMB TO THE MOON. OR SINK FROM IT.')).toBeInTheDocument();
    expect(screen.getByText('THE DAILY BASKETBALL SHOT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PLAY RARE SHOT' })).toHaveClass('primary--big');
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeInTheDocument();
    expect(screen.getByTestId('streak-current')).toHaveTextContent('3 days');
    expect(screen.getByTestId('streak-best')).toHaveTextContent('5 days');
    expect(screen.getByText('#12')).toBeInTheDocument();
  });

  it('has two mode cards, the chosen one selected, and a button that names the mode', async () => {
    const onMode = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Home {...props} mode="common" onMode={onMode} />);
    const group = screen.getByRole('radiogroup', { name: 'Mode' });
    const [rare, common] = within(group).getAllByRole('radio');
    expect(rare).toHaveAttribute('aria-checked', 'false');
    expect(common).toHaveAttribute('aria-checked', 'true');
    expect(common).toHaveClass('mode-card--on');
    expect(screen.getByText('Start on the moon. The rarer your answer, the deeper you sink.')).toBeInTheDocument();
    expect(screen.getByText('Start at the rim. The more famous your answer, the higher you climb.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PLAY COMMON SHOT' })).toBeInTheDocument();
    await userEvent.setup().click(rare!);
    expect(onMode).toHaveBeenCalledWith('rare');
  });

  it('offers View results instead of Play when today is already played in this mode', () => {
    render(<Home {...props} played />);
    expect(screen.getByRole('button', { name: 'VIEW RARE RESULTS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^PLAY/ })).not.toBeInTheDocument();
  });

  it('uses text only: no images, no logos', () => {
    const { container } = render(<Home {...props} />);
    expect(container.querySelectorAll('img, image, picture')).toHaveLength(0);
  });
});

describe('every screen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      return new Response(JSON.stringify(u.endsWith('universe.json') ? readJson(UNIVERSE_PATH) : u.endsWith('outside_range.json') ? MOCK_OUTSIDE_RANGE_NAMES : readJson(PROMPTS_PATH)), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('says it is an unofficial fan game, on the home screen and elsewhere', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<App now={() => new Date('2026-11-04T17:00:00Z')} search="" storage={null} />);
    const home = await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ });
    expect(home).toBeInTheDocument();
    expect(screen.getByText('Unofficial fan game. Not affiliated with the NBA.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(within(document.querySelector('main')!).getByText('Unofficial fan game. Not affiliated with the NBA.')).toBeInTheDocument();
  });

  it('has exactly one h1: the title on home, a hidden one on the other screens', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<App now={() => new Date('2026-11-04T17:00:00Z')} search="" storage={null} />);
    await screen.findByRole('button', { name: /^PLAY (RARE|COMMON) SHOT$/ });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('NYLON');
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
