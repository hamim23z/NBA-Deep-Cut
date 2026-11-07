import { useEffect, useState, type Ref } from 'react';
import { useAnnounce } from '../announcer';
import { totalPoints } from '../dive2';
import { LEVELS, MODE_LABEL, MODES, formatFeet, type Mode } from '../modes';
import { rankFor } from '../ranks';
import { copyText, shareLine } from '../share';
import { MAX_DIVE_POINTS, TIERS } from '../tiers';
import type { Prompt, PromptResult, Tier } from '../types';
import { TIER_COLORS, TIER_INK } from '../world/palette';
import { ballLevel, marksFrom, useWorldStore } from '../world/worldStore';

interface Props {
  prompts: readonly Prompt[];
  results: readonly PromptResult[];
  diveNumber: number;
  mode: Mode;
  /** The best total in this mode on this device, this dive included. */
  best: number;
  headingRef: Ref<HTMLHeadingElement>;
  onHome: () => void;
  onArchive: () => void;
  onHowTo: () => void;
  /** Play (or look at) this dive in the other mode. */
  onOtherMode: (mode: Mode) => void;
  streak?: { value: number };
}

function describe(r: PromptResult): string {
  if (r.status === 'valid') return `tier ${r.tier}, ${r.points} points`;
  if (r.status === 'timeout') return 'time ran out, 0 points';
  if (r.status === 'outside_range') return 'outside the data range, 0 points';
  return 'not a valid answer, 0 points';
}

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;

export function Final({ prompts, results, diveNumber, mode, best, headingRef, onHome, onArchive, onOtherMode, streak }: Props) {
  const announce = useAnnounce();
  const world = useWorldStore();
  const [copyFailed, setCopyFailed] = useState(false);
  const total = totalPoints(results);
  const rank = rankFor(total);
  const level = LEVELS[ballLevel(mode, marksFrom(results))] ?? LEVELS[0]!;
  const other: Mode = MODES.find((m) => m !== mode) ?? 'rare';
  const line = shareLine(diveNumber, results, mode);
  const counts = TIERS.map((t) => results.filter((r) => r.status === 'valid' && r.tier === t).length);
  const misses = results.filter((r) => r.tier === null).length;

  // The world shows the ball on its final level.
  useEffect(() => {
    world.set({ phase: 'results', mode, marks: marksFrom(results), points: total, diveNumber, skipped: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per results screen
  }, [diveNumber, mode]);

  const share = async (): Promise<void> => {
    const ok = await copyText(line);
    setCopyFailed(!ok);
    announce(ok ? 'Copied to the clipboard.' : 'Could not copy. Select the text and copy it yourself.');
  };

  return (
    <section className="card final" aria-labelledby="final-heading">
      <h2 id="final-heading" tabIndex={-1} ref={headingRef}>
        Dive complete
      </h2>
      <p className="final__number">DIVE #{diveNumber} · {MODE_LABEL[mode]}</p>
      <ol className="squares" aria-label="Your seven answers">
        {results.map((r, i) => (
          <li
            key={r.promptId}
            className="square"
            style={{ background: r.tier === null ? '#3A3A3A' : TIER_COLORS[r.tier as Tier], color: r.tier === null ? '#F4EAD6' : TIER_INK[r.tier as Tier] }}
            aria-label={`Prompt ${i + 1}: ${describe(r)}`}
          >
            <span className="square__tier" aria-hidden="true">{r.tier ?? '×'}</span>
          </li>
        ))}
      </ol>
      <p className="final__score" role="group" aria-label={`Total ${total} out of ${MAX_DIVE_POINTS}`}>
        <span aria-hidden="true">{total}</span>
        <span className="final__max" aria-hidden="true"> / {MAX_DIVE_POINTS}</span>
      </p>
      <p className="final__rank">{rank}</p>
      <dl className="stats">
        <div><dt>Final altitude</dt><dd data-testid="final-altitude">{formatFeet(level.ft)} ft · {level.name}</dd></div>
        <div><dt>Best {MODE_LABEL[mode]} score</dt><dd data-testid="final-best">{best}{best === total ? ' · NEW BEST' : ''}</dd></div>
        {streak && <div><dt>Streak</dt><dd data-testid="final-streak">{days(streak.value)}</dd></div>}
      </dl>

      <h3>Tier breakdown</h3>
      <ul className="breakdown">
        {TIERS.map((t, i) => (
          <li key={t}>
            <span className="chip" style={{ background: TIER_COLORS[t], color: TIER_INK[t] }} aria-hidden="true">{t}</span>
            <span className="breakdown__name">{LEVELS[i]?.name}</span>
            <span className="breakdown__bar" aria-hidden="true">{Array.from({ length: counts[i] ?? 0 }, (_, k) => <i key={k} style={{ background: TIER_COLORS[t] }} />)}</span>
            <span className="breakdown__count">{counts[i]}<span className="visually-hidden"> answers on {LEVELS[i]?.name}</span></span>
          </li>
        ))}
        <li>
          <span className="chip chip--miss" aria-hidden="true">×</span>
          <span className="breakdown__name">AIRBALL</span>
          <span className="breakdown__bar" aria-hidden="true">{Array.from({ length: misses }, (_, k) => <i key={k} style={{ background: '#6E6E6E' }} />)}</span>
          <span className="breakdown__count">{misses}<span className="visually-hidden"> airballs</span></span>
        </li>
      </ul>

      <h3>Share</h3>
      {copyFailed ? (
        <textarea className="share-text" readOnly rows={3} value={line} aria-label="Your result, ready to copy" onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <pre className="share-preview" aria-label="Your result">{line}</pre>
      )}
      <button type="button" className="primary" onClick={() => void share()}>
        COPY RESULT
      </button>
      {copyFailed && <p className="caveat">Your browser did not allow copying. Select the text above and copy it.</p>}

      <h3>Your answers</h3>
      <ol className="recap">
        {results.map((r, i) => (
          <li key={r.promptId} className="recap__item">
            <span className="chip" style={{ background: r.tier === null ? '#3A3A3A' : TIER_COLORS[r.tier as Tier], color: r.tier === null ? '#F4EAD6' : TIER_INK[r.tier as Tier] }} aria-hidden="true">{r.tier ?? '×'}</span>
            <span className="recap__text">
              <strong>{r.matched?.name ?? (r.input.trim() === '' ? 'No answer' : r.input)}</strong>
              <span className="recap__prompt">{prompts[i]?.text}</span>
              <span className="recap__how">{describe(r)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="actions">
        <button type="button" className="primary" onClick={() => onOtherMode(other)}>
          PLAY THE OTHER MODE ({MODE_LABEL[other]})
        </button>
        <button type="button" className="secondary" onClick={onArchive}>
          Archive
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          Home
        </button>
      </div>
    </section>
  );
}

