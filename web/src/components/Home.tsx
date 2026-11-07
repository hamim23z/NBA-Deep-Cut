import { MODES, MODE_BLURB, MODE_LABEL, type Mode } from '../modes';
import type { Streaks } from '../streaks';

interface Props {
  number: number;
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** Today's dive is already finished in this mode. */
  played: boolean;
  streaks: Streaks;
  /** False when the browser will not keep anything, so streaks and the archive cannot last. */
  saving: boolean;
  onPlay: () => void;
  onResults: () => void;
  onArchive: () => void;
  onHowTo: () => void;
}

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;

export function Home({ number, mode, onMode, played, streaks, saving, onPlay, onResults, onArchive, onHowTo }: Props) {
  return (
    <section className="home" aria-label="Home">
      <p className="home__caption">THE DAILY BASKETBALL SHOT</p>
      <h1 className="home__title">NYLON</h1>
      <p className="home__tagline">CLIMB TO THE MOON. OR SINK FROM IT.</p>
      <p className="home__rules">7 prompts. 25 seconds each. Pick your mode.</p>
      <div className="modes" role="radiogroup" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`mode-card${mode === m ? ' mode-card--on' : ''}`} onClick={() => onMode(m)}>
            <span className="mode-card__name">{MODE_LABEL[m]}</span>
            <span className="mode-card__blurb">{MODE_BLURB[m]}</span>
          </button>
        ))}
      </div>
      <p className="today">
        Today&rsquo;s dive: <strong>#{number}</strong>
      </p>
      <button type="button" className="primary primary--big" onClick={played ? onResults : onPlay}>
        {played ? `VIEW ${MODE_LABEL[mode]} RESULTS` : `PLAY ${MODE_LABEL[mode]} SHOT`}
      </button>
      <div className="actions__row">
        <button type="button" className="secondary" onClick={onArchive}>
          Archive
        </button>
        <button type="button" className="secondary" onClick={onHowTo}>
          How to play
        </button>
      </div>
      <dl className="streaks" aria-label="Streaks">
        <div>
          <dt>Streak</dt>
          <dd data-testid="streak-current">{days(streaks.current)}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd data-testid="streak-best">{days(streaks.best)}</dd>
        </div>
      </dl>
      {!saving && <p className="caveat">This browser is not saving anything, so your streaks and past dives will be gone when you close the page.</p>}
    </section>
  );
}
