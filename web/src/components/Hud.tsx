import { LEVELS, MODE_LABEL, MODE_CHIP, formatFeet } from '../modes';
import { useReducedMotion } from '../motion';
import { useSound } from '../sound';
import { RollingNumber } from './RollingNumber';
import { TIER_COLORS, TIER_INK, moveMs } from '../world/palette';
import { ballLevel, previousLevel, useWorldState } from '../world/worldStore';
import type { Tier } from '../types';

/** Off by default; remembers its setting. Nothing plays before the visitor's first interaction. */
export function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <button type="button" className="sound-toggle" aria-pressed={enabled} onClick={toggle}>
      <span className="sound-toggle__icon" aria-hidden="true" /> Sound {enabled ? 'on' : 'off'}
    </button>
  );
}

/**
 * The bar across the top. It always has the NYLON chip and the sound switch; during a dive it adds the altitude, the seven prompt
 * pips and the score, all read from the world store (the one source of truth), so they match what the ball shows.
 */
export function Hud({ onHome }: { onHome: () => void }) {
  const state = useWorldState();
  const reduced = useReducedMotion();
  const playing = state.phase !== 'idle';
  const level = ballLevel(state.mode, state.marks);
  const before = previousLevel(state.mode, state.marks);
  const arriving = state.phase === 'result';
  const delay = reduced || state.skipped || !arriving ? 0 : moveMs(before, level);
  const shown = Math.min(state.promptNumber, state.total);
  return (
    <header className={`hud${playing ? ' hud--playing' : ''}`}>
      <div className="hud__left">
        <button type="button" className="chip-brand" onClick={onHome} aria-label="NYLON, home">NYLON</button>
        {playing && (
          <div className="box hud__alt" role="group" aria-label="Altitude">
            <span className="box__label">ALTITUDE (FT)</span>
            <span className="box__value" data-testid="hud-altitude">
              <RollingNumber value={LEVELS[level]?.ft ?? 0} from={LEVELS[arriving ? before : level]?.ft} delayMs={delay} durationMs={delay === 0 ? 0 : 450} instant={delay === 0} format={formatFeet} />
            </span>
          </div>
        )}
      </div>
      {playing && (
        <div className="hud__pips" role="group" aria-label={`Prompt ${shown} of ${state.total}`}>
          <ol className="pips">
            {Array.from({ length: state.total }, (_, i) => {
              const mark = state.marks[i];
              const tier = mark ? mark.tier : undefined;
              const style = tier ? { background: TIER_COLORS[tier as Tier], color: TIER_INK[tier as Tier] } : undefined;
              return (
                <li key={i} className={`pip${mark ? ' pip--done' : ''}${!mark && i + 1 === state.promptNumber ? ' pip--now' : ''}${mark && tier === null ? ' pip--miss' : ''}`} style={style}>
                  {mark ? (tier ?? '×') : ''}
                </li>
              );
            })}
          </ol>
          <span className="pips__label" aria-hidden="true">PROMPT {shown} OF {state.total}</span>
          <span className="visually-hidden">Prompt {shown} of {state.total}</span>
        </div>
      )}
      <div className="hud__right">
        {playing && (
          <div className="box hud__score" role="group" aria-label="Score">
            <span className="box__label">SCORE</span>
            <span className="box__value" data-testid="scoreboard-points">
              <RollingNumber value={state.points} delayMs={delay === 0 ? 0 : delay + 150} instant={delay === 0} />
            </span>
          </div>
        )}
        <SoundToggle />
      </div>
      {playing && <p className="hud__mode" data-testid="hud-mode">{MODE_CHIP[state.mode]}</p>}
      <span className="visually-hidden">Mode: {MODE_LABEL[state.mode]}</span>
    </header>
  );
}
