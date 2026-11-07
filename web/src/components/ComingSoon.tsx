import { longDate } from '../schedule';

interface Props {
  launchDate: string;
  /** Only with ?preview=1: lets a tester play dive #1 without it being saved. */
  onPlayTest?: () => void;
  onHowTo: () => void;
}

export function ComingSoon({ launchDate, onPlayTest, onHowTo }: Props) {
  return (
    <section className="card soon" aria-labelledby="soon-heading">
      <h2 id="soon-heading">Coming soon</h2>
      <p>
        NYLON starts on <strong>{longDate(launchDate)}</strong>. A new dive of seven basketball prompts every day.
      </p>
      <div className="actions">
        <button type="button" className="secondary" onClick={onHowTo}>
          How to play
        </button>
        {onPlayTest && (
          <button type="button" className="primary" onClick={onPlayTest}>
            Play-test
          </button>
        )}
      </div>
      {onPlayTest && <p className="caveat">Preview mode: a test play is not saved and does not count for streaks.</p>}
    </section>
  );
}
