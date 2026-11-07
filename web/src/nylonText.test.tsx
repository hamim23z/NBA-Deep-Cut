import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PromptText, displayText, splitEra } from './components/PromptText';
import { capitalizeFirst } from './modes';
import { MOCK_OUTSIDE_RANGE_NAMES } from './outsideRange';
import { divePrompts } from './schedule';
import { PROMPTS_PATH, UNIVERSE_PATH, mockPrompts, readJson } from './testUtils';
import { TIER_COLORS, TIER_INK } from './world/palette';

describe('the question text', () => {
  const text = 'Since 2001-02 (through 2025-26), name a player who scored 40 or more points.';

  it('shows its first letter in capitals, and leaves the words and the data alone', () => {
    const { container } = render(<PromptText text={text} />);
    expect(container.textContent).toBe('Since 2001-02 (through 2025-26), Name a player who scored 40 or more points.');
    expect(container.textContent?.toLowerCase()).toBe(text.toLowerCase());
    expect(text).toContain('), name a player'); // the string itself is untouched
    expect(splitEra(text)?.task).toBe('name a player who scored 40 or more points.'); // and so is what the matcher and the data see
  });

  it('capitalises a text that has no era, and a text that already has a capital stays as it is', () => {
    expect(displayText('name a team that won.')).toBe('Name a team that won.');
    expect(displayText('Name a team that won.')).toBe('Name a team that won.');
    expect(capitalizeFirst('')).toBe('');
  });

  describe('in the game', () => {
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

    it('shows the question with a capital in the card while the prompt data keeps its own words', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      render(<App now={() => new Date('2026-11-03T17:00:00Z')} search="" storage={null} />);
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await screen.findByRole('button', { name: 'PLAY RARE SHOT' }));
      await screen.findByRole('combobox');
      const raw = divePrompts(mockPrompts(), 1)[0]!.text;
      const shown = screen.getByRole('heading', { level: 2 }).textContent ?? '';
      expect(shown).toBe(displayText(raw));
      expect(shown).not.toBe(raw);
      expect(divePrompts(mockPrompts(), 1)[0]!.text).toBe(raw); // reading the data again gives the same words
    });
  });
});

describe('contrast (WCAG: 4.5 to 1 for text)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
  const token = (name: string): string => new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(css)![1]!;
  const lum = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  it.each([['cream', 'ink'], ['cream', 'panel'], ['muted', 'ink'], ['muted', 'panel'], ['orange', 'ink'], ['amber', 'ink'], ['ink', 'orange'], ['ink', 'amber'], ['red', 'ink']])('%s on %s', (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('puts readable text on every tier colour, and the lightest grey text on the near-black boxes', () => {
    for (const t of [1, 2, 3, 4, 5, 6] as const) expect(ratio(TIER_INK[t], TIER_COLORS[t]), `tier ${t}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#A8A8A8', '#0A0A0A')).toBeGreaterThanOrEqual(4.5); // the level name of tier 1 and a miss, drawn in grey
  });

  it('has the tier colours of the brief and the black and orange palette', () => {
    for (const [name, value] of Object.entries({ ink: '#0a0a0a', orange: '#ff6a13', amber: '#ffb347', red: '#ff3b1f', cream: '#f4ead6', t1: '#6e6e6e', t2: '#a8a8a8', t3: '#ededed', t4: '#ffb020', t5: '#ff6a13', t6: '#ff3b1f' })) {
      expect(token(name), name).toBe(value);
    }
  });

  it('is flat: no rounded corners, blur, glow or drop shadows on the interface or the world', () => {
    for (const file of ['src/styles.css', 'src/world/world.css']) {
      const code = readFileSync(resolve(process.cwd(), file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of code.matchAll(/border-radius:\s*([^;]+);/g)) expect(m[1]!.trim(), `${file} border-radius`).toBe('0');
      expect(code, file).not.toMatch(/blur\(|backdrop-filter|drop-shadow|radial-gradient|conic-gradient/);
      for (const m of code.matchAll(/box-shadow:([^;]+);/g)) {
        for (const shadow of m[1]!.split(/,(?![^(]*\))/)) {
          const lengths = shadow.replace(/var\([^)]*\)|calc\([^)]*\)/g, '1').match(/-?[\d.]+(?:px|rem)?/g) ?? [];
          if (lengths.length >= 3) expect(Number.parseFloat(lengths[2]!), `${file}: ${shadow}`).toBe(0); // a hard offset: no blur radius
        }
      }
      for (const m of code.matchAll(/(?<!repeating-)linear-gradient\(/g)) expect(m.index, `${file}: a smooth gradient`).toBeNull();
    }
  });

  it('draws the world pixelated and loads no image', () => {
    const css2 = readFileSync(resolve(process.cwd(), 'src/world/world.css'), 'utf8');
    expect(css2).toMatch(/image-rendering:\s*pixelated/);
    const tsx = readFileSync(resolve(process.cwd(), 'src/world/World.tsx'), 'utf8');
    expect(tsx).not.toMatch(/\.png|\.jpg|<img|new Image\(/);
  });
});
