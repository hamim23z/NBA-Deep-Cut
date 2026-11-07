import { LEVELS, MODES, MODE_LABEL, pointsFor } from '../modes';
import { PROMPTS_PER_DIVE, SECONDS_PER_PROMPT, TIERS, TIER_RANGES } from '../tiers';
import { TIER_COLORS, TIER_INK } from '../world/palette';

interface Props {
  onPlay: () => void;
  onBack: () => void;
}

export function HowToPlay({ onPlay, onBack }: Props) {
  return (
    <section className="card howto" aria-labelledby="howto-heading">
      <h2 id="howto-heading">How to play</h2>
      <ol className="steps">
        <li>
          A dive is <strong>{PROMPTS_PER_DIVE} prompts</strong>, with <strong>{SECONDS_PER_PROMPT} seconds</strong> each. Everyone gets the same seven each day, in either mode.
        </li>
        <li>Type one answer, a player or a team, or pick it from the suggestions. The suggestions list everyone, so they never give an answer away.</li>
        <li>
          <strong>RARE:</strong> the rarer your answer, the more it scores, and the ball sinks from the moon to the rim. <strong>COMMON:</strong> the more famous your answer, the more it scores, and the ball climbs from the rim to the moon.
        </li>
        <li>
          A wrong answer, or running out of time, is an <strong>airball</strong>: 0 points, and the ball stays where it is.
        </li>
        <li>After each prompt you see where the ball landed, plus the most famous and the rarest valid answers.</li>
        <li>At the end, copy your score and seven coloured squares to share. A day counts for your streak if you finish either mode. Past dives are in the archive, and they do not count for the streak.</li>
      </ol>
      <table className="tiers">
        <caption>Levels and points</caption>
        <thead>
          <tr>
            <th scope="col">Tier</th>
            <th scope="col">How famous</th>
            {MODES.map((m) => (
              <th key={m} scope="col">{MODE_LABEL[m]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => (
            <tr key={t}>
              <th scope="row">
                <span className="chip" style={{ background: TIER_COLORS[t], color: TIER_INK[t] }} aria-hidden="true">{t}</span> {LEVELS[t - 1]?.name}
              </th>
              <td>{TIER_RANGES[t]}</td>
              {MODES.map((m) => (
                <td key={m}>{pointsFor(m, t - 1)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="caveat">
        How famous an answer is comes from an estimate of how famous the player is over their career. It is an approximation, not a count of what other players typed, so a few players will feel too high or too low.
      </p>
      <p className="caveat">
        Every prompt covers the 2001-02 season onward, and says so. A real player from before that gets an &ldquo;outside the data range&rdquo; message, not a miss.
      </p>
      <p className="caveat">There is one new dive each day. Your finished dives, streaks and archive are kept in this browser only.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={onPlay}>
          Play
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
