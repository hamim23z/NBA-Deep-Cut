import { totalPoints } from '../dive2';
import { squareFor } from '../share';
import type { History } from '../storage';
import { MODES, MODE_LABEL, type Mode } from '../modes';
import { MAX_DIVE_POINTS } from '../tiers';
import type { PromptResult, Tier } from '../types';
import { TIER_COLORS, TIER_INK } from '../world/palette';

interface Props {
  /** The dive number of today: the archive lists #1 up to this one. */
  today: number;
  mode: Mode;
  onMode: (mode: Mode) => void;
  history: History;
  saving: boolean;
  onPlay: (number: number) => void;
  onResults: (number: number) => void;
  onBack: () => void;
}

const label = (r: PromptResult, i: number): string => (r.tier === null ? `prompt ${i + 1}: no points` : `prompt ${i + 1}: tier ${r.tier}`);

export function Archive({ today, mode, onMode, history, saving, onPlay, onResults, onBack }: Props) {
  const numbers = Array.from({ length: today }, (_, i) => today - i); // newest first
  return (
    <section className="archive" aria-labelledby="archive-heading">
      <h2 id="archive-heading">Archive</h2>
      <div className="modes modes--small" role="radiogroup" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`mode-card${mode === m ? ' mode-card--on' : ''}`} onClick={() => onMode(m)}>
            <span className="mode-card__name">{MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>
      <p>Every past dive, in {MODE_LABEL[mode]} mode. Playing one here counts for the archive only, not for your streak.</p>
      {!saving && <p className="caveat">This browser is not saving anything, so the archive will only remember this visit.</p>}
      <ol className="archive__list">
        {numbers.map((n) => {
          const played = history[n];
          return (
            <li key={n} className="archive__item">
              <span className="archive__name">Dive #{n}</span>
              {played ? (
                <>
                  <span className="archive__score" role="group" aria-label={`${totalPoints(played.results)} out of ${MAX_DIVE_POINTS}`}>
                    {totalPoints(played.results)}
                  </span>
                  <ol className="mini" aria-label={`Dive ${n} answers`}>
                    {played.results.map((r, i) => (
                      <li key={r.promptId} className="mini__square" style={{ background: r.tier === null ? '#3A3A3A' : TIER_COLORS[r.tier as Tier], color: r.tier === null ? '#F4EAD6' : TIER_INK[r.tier as Tier] }} aria-label={label(r, i)} title={squareFor(r)}>
                        <span aria-hidden="true">{r.tier ?? '×'}</span>
                      </li>
                    ))}
                  </ol>
                  <button type="button" className="secondary" onClick={() => onResults(n)} aria-label={`Results of dive ${n}`}>
                    Results
                  </button>
                </>
              ) : (
                <button type="button" className="primary" onClick={() => onPlay(n)} aria-label={`Play dive ${n}`}>
                  Play
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
