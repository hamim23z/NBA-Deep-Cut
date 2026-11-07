import { useEffect, useState, type CSSProperties, type Ref } from 'react';
import { FLAVOR, MODE_VERB, TIER_CLASS, feetFor, formatFeet, travelMs, type Mode } from '../modes';
import { RollingNumber } from './RollingNumber';
import { useReducedMotion } from '../motion';
import { shotForResult } from '../shots';
import { useSound } from '../sound';
import { displayText } from './PromptText';
import { TIER_RANGES } from '../tiers';
import type { Answer, Prompt, PromptResult, Tier } from '../types';
import { TIER_COLORS, TIER_INK } from '../world/palette';
import { useWorldStore } from '../world/worldStore';

interface Props {
  prompt: Prompt;
  result: PromptResult;
  mode: Mode;
  isLast: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onNext: () => void;
  skipped: boolean;
  onSkip: () => void;
}

export const ARM_MS = 120;

/** The three most famous valid answers: lowest tier first, then the order of the file. */
export const mostFamous = (answers: readonly Answer[], n = 3): Answer[] =>
  answers.map((a, i) => ({ a, i })).sort((x, y) => x.a.tier - y.a.tier || x.i - y.i).slice(0, n).map((x) => x.a);

/** The rarest valid answers: highest tier first, and the later ones in the file first within a tier. */
export const rarest = (answers: readonly Answer[], n = 3): Answer[] =>
  answers.map((a, i) => ({ a, i })).sort((x, y) => y.a.tier - x.a.tier || y.i - x.i).slice(0, n).map((x) => x.a);

/** The rarest answers that are not already in the most-famous list, so a short or one-tier list is not shown twice. */
export const rarestOthers = (answers: readonly Answer[], n = 3): Answer[] => {
  const shown = new Set(mostFamous(answers, n).map((a) => a.id));
  return rarest(answers, answers.length).filter((a) => !shown.has(a.id)).slice(0, n);
};

/** Every valid answer, best known first. Built only when the list is opened: a prompt can have hundreds. */
function AllAnswers({ answers }: { answers: readonly Answer[] }) {
  const [open, setOpen] = useState(false);
  const byTier = open ? [...answers].sort((a, b) => a.tier - b.tier) : [];
  return (
    <details className="all-answers" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>All {answers.length} valid answers</summary>
      {open && (
        <ol className="answers answers--all">
          {byTier.map((a) => (
            <li key={a.id} className="answers__item">
              <span className={`chip chip--t${a.tier}`} aria-hidden="true">{a.tier}</span>
              <span className="answers__name">{a.name}</span>
              <span className="answers__points">
                <span className="visually-hidden">tier {a.tier}, </span>
                {a.points}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

function headline(result: PromptResult): string {
  switch (result.status) {
    case 'valid':
      return `Tier ${result.tier}: ${result.points} points`;
    case 'timeout':
      return "Time's up: 0 points";
    case 'outside_range':
      return 'Outside the data range';
    case 'invalid':
      return 'Not a valid answer: 0 points';
  }
}

function explanation(prompt: Prompt, result: PromptResult): string {
  const n = prompt.answers.length;
  switch (result.status) {
    case 'valid':
      return `${result.matched?.name ?? result.input} is one of ${n} valid answers. ${result.tier ? TIER_RANGES[result.tier] : ''}: the more obscure the answer, the more it scores.`;
    case 'timeout':
      return result.input.trim() === '' ? 'You ran out of time before answering.' : `You ran out of time before answering. "${result.input}" was not submitted.`;
    case 'outside_range':
      return `"${result.input}" looks like a real player from before the data starts (2002), so it is outside the data range. It does not count against you.`;
    case 'invalid':
      return result.matched ? `${result.matched.name} is not a valid answer for this prompt.` : `We did not recognize "${result.input}".`;
  }
}

function AnswerList({ title, answers }: { title: string; answers: readonly Answer[] }) {
  return (
    <>
      <h4>{title}</h4>
      <ul className="answers">
        {answers.map((a) => (
          <li key={a.id} className="answers__item">
            <span className={`chip chip--t${a.tier}`} aria-hidden="true">{a.tier}</span>
            <span className="answers__name">{a.name}</span>
            <span className="answers__points">
              <span className="visually-hidden">tier {a.tier}, </span>
              {a.points}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Reveal({ prompt, result, mode, isLast, headingRef, onNext, skipped, onSkip }: Props) {
  const shot = shotForResult(result);
  const reduced = useReducedMotion();
  const { play } = useSound();
  const world = useWorldStore();
  const tier = result.status === 'valid' ? result.tier : null;
  const tierClass = tier ? TIER_CLASS[tier - 1] : undefined;
  const color = tier ? TIER_COLORS[tier as Tier] : '#6E6E6E';
  const verb = MODE_VERB[mode];

  useEffect(() => {
    world.set({ phase: 'result', shotKey: world.get().shotKey + 1, skipped: false });
    if (!reduced) play(shot.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result
  }, [result.promptId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        onNext();
      }
    };
    const arm = setTimeout(() => document.addEventListener('keydown', onKey), ARM_MS);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('keydown', onKey);
    };
  }, [onNext]);

  const classes = ['card', 'result-card', skipped ? 'is-skipped' : '', reduced ? 'is-reduced' : ''].filter(Boolean).join(' ');
  const style = { '--tier': color, '--tier-text': tier === 1 || !tier ? '#A8A8A8' : color, '--tier-ink': tier ? TIER_INK[tier as Tier] : '#F4EAD6' } as CSSProperties;
  const typed = result.matched?.name ?? result.input;
  return (
    <section className={classes} style={style} aria-labelledby="result-heading" onPointerDown={skipped ? undefined : onSkip} data-tier={tier ?? 'miss'}>
      <h2 className="visually-hidden">{displayText(prompt.text)}</h2>
      <h3 id="result-heading" className={`result-card__level${result.status === 'outside_range' ? ' shake shake--0' : ''}`} tabIndex={-1} ref={headingRef}>
        {tierClass ?? 'AIRBALL'}
        <span className="visually-hidden">: {headline(result)}</span>
      </h3>
      {tierClass && <p className="result-card__pick">PICK</p>}
      <input className="result-card__answer" readOnly aria-label="Your answer" value={typed.trim() === '' ? 'No answer' : `"${typed}"`} ref={(node) => node?.focus({ preventScroll: true })} />
      <p className="result-card__points">
        <strong>+<RollingNumber value={result.points} from={0} durationMs={travelMs(result.points)} instant={reduced || skipped || result.points === 0} /> PTS</strong>
        {result.points > 0 && <> · {verb.move} {formatFeet(feetFor(result.points))} ft</>}
      </p>
      {tier ? <p className="result-card__flavor">{FLAVOR[mode][tier - 1]}</p> : <p className="result-card__flavor">{explanation(prompt, result)}</p>}
      <button type="button" className="primary result-card__next" onClick={onNext}>
        {isLast ? 'SEE RESULTS' : verb.next} <span className="arrow">▶</span>
      </button>
      <details className="result-card__more">
        <summary>See the famous and the rare answers</summary>
        {tier && <p>{explanation(prompt, result)}</p>}
        <AnswerList title="The most famous valid answers" answers={mostFamous(prompt.answers)} />
        {rarestOthers(prompt.answers).length > 0 && <AnswerList title="The rarest valid answers" answers={rarestOthers(prompt.answers)} />}
        <AllAnswers answers={prompt.answers} />
        <p className="caveat">Obscurity is estimated from how famous an answer is across the whole data set, not from what other players typed.</p>
      </details>
    </section>
  );
}
