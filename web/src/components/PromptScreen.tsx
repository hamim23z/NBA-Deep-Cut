import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAnnounce } from '../announcer';
import { resolveEntry, resolveText, timeoutResult } from '../answer';
import { MODE_HINT, type Mode } from '../modes';
import type { Index } from '../matching';
import { NARROW_MAX } from '../world/scene';
import { useViewport } from '../world/useMetrics';
import { useWorldStore } from '../world/worldStore';
import { SECONDS_PER_PROMPT } from '../tiers';
import type { Entry, Prompt, PromptResult } from '../types';
import { useCountdown } from '../useCountdown';
import { AnswerInput } from './AnswerInput';
import { PromptText } from './PromptText';

interface Props {
  prompt: Prompt;
  mode: Mode;
  index: Index;
  outsideNames?: readonly string[];
  /** How much of the 25 seconds has already gone (a reload in the middle of the prompt). */
  elapsedMs?: number;
  onResult: (result: PromptResult) => void;
}

const WARNINGS = [10, 5];

export function PromptScreen({ prompt, mode, index, outsideNames, elapsedMs = 0, onResult }: Props) {
  const announce = useAnnounce();
  const world = useWorldStore();
  const viewport = useViewport();
  const section = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const compactAt = useRef(0);
  const narrow = viewport.w < NARROW_MAX;
  const typed = useRef('');
  const done = useRef(false);

  const finish = useCallback(
    (result: PromptResult) => {
      if (done.current) return;
      done.current = true;
      onResult(result);
    },
    [onResult],
  );

  const remainingMs = useCountdown(SECONDS_PER_PROMPT, () => finish(timeoutResult(prompt, typed.current)), elapsedMs);
  const seconds = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (WARNINGS.includes(seconds) && seconds < SECONDS_PER_PROMPT) announce(`${seconds} seconds left`);
  }, [seconds, announce]);

  const submitText = (
    text: string,
    setHint: (hint: string) => void,
    showChoices: (entries: Entry[]) => void,
  ): void => {
    if (text.trim() === '') {
      setHint('Type a name, or pick one from the list.');
      return;
    }
    const resolution = resolveText(prompt, index, text, outsideNames);
    if (resolution.kind === 'ambiguous') {
      const names = resolution.entries.map((e) => e.name);
      setHint(`That could be ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}. Pick one from the list.`);
      showChoices(resolution.entries);
      return;
    }
    finish(resolution.result);
  };

  useLayoutEffect(() => {
    if (!narrow) return;
    const measure = (): void => {
      const root = section.current;
      const app = root?.closest('.app');
      const card = root?.querySelector('.prompt');
      const row = root?.querySelector('.answer');
      if (!app || !card || !row) return;
      const base = app.getBoundingClientRect().top;
      const top = card.getBoundingClientRect().bottom - base;
      const bottom = row.getBoundingClientRect().top - base;
      world.set({ band: { top: Math.round(top), bottom: Math.round(bottom) } });
      if (!compact && bottom - top < 120) {
        compactAt.current = viewport.h;
        setCompact(true);
      } else if (compact && viewport.h >= compactAt.current + 60) setCompact(false);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const card = section.current?.querySelector('.prompt');
    if (observer && card) observer.observe(card);
    return () => {
      observer?.disconnect();
      world.set({ band: null });
    };
  }, [narrow, compact, viewport.h, prompt.id, world]);

  const urgency = seconds <= 5 ? 'danger' : seconds <= 10 ? 'warning' : 'calm';
  const promptId = `prompt-text-${prompt.id}`;
  return (
    <section ref={section} className={`card prompt-card${compact ? ' prompt-card--compact' : ''}`} aria-labelledby={promptId}>
      <div className={`shotclock shotclock--${urgency}`}>
        <p className="shotclock__digits timer__count" role="timer" aria-live="off">
          <span className={`timer__seconds timer__seconds--${urgency}`}>{seconds}</span>
          <span className="visually-hidden"> seconds left</span>
        </p>
        <div className="shotclock__track" aria-hidden="true">
          <div className="shotclock__fill" style={{ transform: `scaleX(${remainingMs / (SECONDS_PER_PROMPT * 1000)})` }} />
        </div>
      </div>
      <h2 id={promptId} className={`prompt${prompt.text.length > 150 ? ' prompt--xlong' : prompt.text.length > 110 ? ' prompt--long' : ''}`}>
        <PromptText text={prompt.text} />
      </h2>
      <AnswerInput
        index={index}
        labelledBy={promptId}
        onTextChange={(t) => {
          typed.current = t;
        }}
        onSubmitText={submitText}
        onPick={(entry, text) => finish(resolveEntry(prompt, entry, text))}
      />
      <p className="prompt-card__hint">{MODE_HINT[mode]}</p>
    </section>
  );
}
