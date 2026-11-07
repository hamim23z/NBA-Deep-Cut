import { MODE_LABEL, MODE_CHIP, altitudeFt, formatFeet, travelMs } from '../modes';
import { useReducedMotion } from '../motion';
import { useSound } from '../sound';
import { RollingNumber } from './RollingNumber';
import { TIER_COLORS, TIER_INK } from '../world/palette';
import { useWorldState } from '../world/worldStore';
import type { Tier } from '../types';

export function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <button type="button" className="sound-toggle" aria-pressed={enabled} onClick={toggle}>
      <span className="sound-toggle__icon" aria-hidden="true" /> Sound {enabled ? 'on' : 'off'}
    </button>
  );
}

export function Hud({ onHome }: { onHome: () => void }) {
  const state = useWorldState();
  const reduced = useReducedMotion();
  const playing = state.phase !== 'idle';
  const arriving = state.phase === 'result';
  const last = state.marks[state.marks.length - 1];
  const earned = arriving && last ? last.points : 0;
  const delay = reduced || state.skipped ? 0 : travelMs(earned);
  const shown = Math.min(state.promptNumber, state.total);
  return (
    <header className={`hud${playing ? ' hud--playing' : ''}`}>
      <div className="hud__left">
        <button type="button" className="chip-brand" onClick={onHome} aria-label="NYLON, home">NYLON</button>
        {playing && (
          <div className="box hud__alt" role="group" aria-label="Altitude">
            <span className="box__label">ALTITUDE (FT)</span>
            <span className="box__value" data-testid="hud-altitude">
              <RollingNumber value={altitudeFt(state.mode, state.points)} from={altitudeFt(state.mode, state.points - earned)} delayMs={0} durationMs={delay} instant={delay === 0} format={formatFeet} />
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
              <RollingNumber value={state.points} from={state.points - earned} durationMs={delay} instant={delay === 0} />
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
