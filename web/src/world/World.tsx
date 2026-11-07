import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { LEVELS, MODE_CHIP, pointsFor } from '../modes';
import { useMetrics } from './useMetrics';
import { useReducedMotion } from '../motion';
import { ballLevel, previousLevel, reachedEnd, useWorldState } from './worldStore';
import { BALL_X, GRID, MOON, RIM_Y, renderClouds, renderCrowdShimmer, renderScene, renderStars, toScreen, type Layer } from './scene';
import { TIER_COLORS, TIER_INK, moveMs, tierOfLevel } from './palette';
import './world.css';

const BALL_CELLS = 9;
/** The ball as 9 x 9 cells: orange with a dark outline and seams. */
export function ballPixels(color = '#FF6A13', ink = '#1A0902'): Array<{ x: number; y: number; fill: string }> {
  const out: Array<{ x: number; y: number; fill: string }> = [];
  for (let y = 0; y < BALL_CELLS; y++) {
    for (let x = 0; x < BALL_CELLS; x++) {
      const d = Math.hypot(x - 4, y - 4);
      if (d > 4.5) continue;
      const seam = x === 4 || y === 4 || (Math.abs(x - 4) === 2 && Math.abs(y - 4) === 2);
      out.push({ x, y, fill: d > 3.6 || seam ? ink : color });
    }
  }
  return out;
}

export function PixelBall({ size, color, className }: { size: number; color?: string; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${BALL_CELLS} ${BALL_CELLS}`} shapeRendering="crispEdges">
      {ballPixels(color).map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={p.fill} />
      ))}
    </svg>
  );
}

/** A canvas that shows a layer once. Nothing happens where there is no canvas (tests). */
function LayerCanvas({ layer, className, scale }: { layer: Layer; className: string; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ImageData === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(layer.data as unknown as Uint8ClampedArray<ArrayBuffer>, layer.w, layer.h), 0, 0);
  }, [layer]);
  return <canvas ref={ref} className={className} width={layer.w} height={layer.h} style={{ width: layer.w * scale, height: layer.h * scale }} />;
}

/** The pixel-art moon world, full screen, behind everything. Decoration only: the screens in front carry every word and number. */
export default function World() {
  const state = useWorldState();
  const reduced = useReducedMotion();
  const m = useMetrics();
  const scene = useMemo(() => renderScene(), []);
  const clouds = useMemo(() => renderClouds(), []);
  const stars = useMemo(() => [renderStars(3), renderStars(11), renderStars(19)], []);
  const crowd = useMemo(() => [renderCrowdShimmer(5), renderCrowdShimmer(9)], []);

  const level = ballLevel(state.mode, state.marks);
  const before = previousLevel(state.mode, state.marks);
  const last = state.marks[state.marks.length - 1];
  const justAnswered = state.phase === 'result' && last !== undefined;
  const moved = justAnswered && last?.tier !== null && level !== before;
  const missed = justAnswered && last?.tier === null;
  const celebrate = justAnswered && reachedEnd(state.mode, state.marks) && !reduced;
  const ms = reduced || state.skipped ? 0 : moveMs(before, level);
  const rising = level < before;
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!moved || ms === 0) return;
    setMoving(true);
    const id = setTimeout(() => setMoving(false), ms);
    return () => clearTimeout(id);
  }, [moved, ms, state.shotKey]);

  const size = BALL_CELLS * m.scale;
  const ball = toScreen(m, BALL_X, LEVELS[level]?.y ?? 24);
  const lineY = (i: number): number => toScreen(m, 0, LEVELS[i]?.y ?? 0).y;
  const cls = ['world', reduced ? 'is-reduced' : '', state.skipped ? 'is-skipped' : '', m.narrow ? 'is-narrow' : ''].filter(Boolean).join(' ');
  const sceneStyle: CSSProperties = { left: m.ox, top: m.oy, width: GRID.w * m.scale, height: GRID.h * m.scale };
  const cellVars = { '--cell': `${m.scale}px` } as CSSProperties;

  const hoop = level === 0 ? { x: MOON.x, y: MOON.y + MOON.r + 2 } : { x: BALL_X, y: RIM_Y + 4 };
  const hoopAt = toScreen(m, hoop.x, hoop.y);

  const live = justAnswered && last
    ? last.tier === null ? `AIRBALL, 0 points, ${state.points} total` : `${LEVELS[last.tier - 1]?.name ?? ''}, ${pointsFor(state.mode, last.tier - 1)} points, ${state.points} total`
    : '';

  // ghost balls on the ruler for earlier answers (not the one on screen now)
  const ghosts = state.marks.flatMap((mark, i) => (mark.tier ? [{ i, tier: mark.tier }] : []));
  const seen = new Map<number, number>();
  const rulerX = m.narrow ? 22 : 26;

  const confetti: ReactElement[] = celebrate
    ? Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const reach = (46 + ((i * 29) % 70)) * (m.scale / 4);
        return <span key={i} className={`world__bit world__bit--${i % 3}`} style={{ '--dx': `${Math.cos(angle) * reach}px`, '--dy': `${Math.sin(angle) * reach - 20}px`, '--delay': `${ms}ms` } as CSSProperties} />;
      })
    : [];

  return (
    <>
      <div className={cls} aria-hidden="true" data-testid="world" data-phase={state.phase} data-mode={state.mode} data-level={LEVELS[level]?.name} data-scale={m.scale.toFixed(2)} style={cellVars}>
        <div className="world__scene" style={sceneStyle}>
          <LayerCanvas layer={scene} className="world__layer world__base" scale={m.scale} />
          {stars.map((s, i) => <LayerCanvas key={i} layer={s} className={`world__layer world__stars world__stars--${i}`} scale={m.scale} />)}
          <div className="world__clouds" style={{ width: GRID.w * 2 * m.scale, height: GRID.h * m.scale, ['--loop' as string]: `${-GRID.w * m.scale}px` }}>
            <LayerCanvas layer={clouds} className="world__layer" scale={m.scale} />
          </div>
          {crowd.map((s, i) => <LayerCanvas key={i} layer={s} className={`world__layer world__crowd world__crowd--${i}`} scale={m.scale} />)}
        </div>
        <i className="world__sat world__sat--a" style={{ top: toScreen(m, 0, 40).y, width: 4 * m.scale, height: 2 * m.scale }} />
        <i className="world__sat world__sat--b" style={{ top: toScreen(m, 0, 76).y, width: 3 * m.scale, height: 2 * m.scale }} />

        <svg className="world__lines" width="100%" height="100%" shapeRendering="crispEdges">
          {LEVELS.map((l, i) => <line key={l.name} className="world__line" x1="0" x2="100%" y1={lineY(i)} y2={lineY(i)} />)}
          <line className="world__guide" x1={toScreen(m, BALL_X, 0).x} x2={toScreen(m, BALL_X, 0).x} y1={m.oy} y2={toScreen(m, 0, 203).y} />
        </svg>

        {!m.narrow && (
          <div className="world__gauge" style={{ top: lineY(0) - 30, height: lineY(5) - lineY(0) + 60 }}>
            {LEVELS.map((l, i) => (
              <div key={l.name} className="world__row" style={{ top: lineY(i) - (lineY(0) - 30) - 15 }} data-level={l.name}>
                <span className="world__chip" style={{ background: TIER_COLORS[tierOfLevel(i)], color: TIER_INK[tierOfLevel(i)] }}>{i + 1}</span>
                <span className="world__name">{l.name}</span>
                <span className="world__pts">{pointsFor(state.mode, i)} PTS</span>
              </div>
            ))}
          </div>
        )}
        {!m.narrow && <p className="world__mode">{MODE_CHIP[state.mode]}</p>}

        <div className="world__ruler" style={{ right: rulerX }}>
          <i className="world__rule" style={{ top: lineY(0) - 10, height: lineY(5) - lineY(0) + 20 }} />
          {LEVELS.map((l, i) => <i key={l.name} className="world__tick" style={{ top: lineY(i) }} />)}
          {ghosts.map(({ i, tier }) => {
            const slot = seen.get(tier) ?? 0;
            seen.set(tier, slot + 1);
            return (
              <span key={i} className="world__ghost" style={{ top: lineY(tier - 1), right: 22 + slot * 26 }}>
                <PixelBall size={14} color={TIER_COLORS[tier]} />
                <b style={{ color: tier === 1 ? '#A8A8A8' : TIER_COLORS[tier] }}>{tier}</b>
              </span>
            );
          })}
          <span className="world__you" style={{ transform: `translateY(${lineY(level)}px)`, transitionDuration: `${ms}ms` }}>
            <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges"><path d="M7 0V7L0 3.5Z" fill="#FF6A13" /></svg>
            <b>YOU</b>
          </span>
        </div>

        <div className={`world__ball${moving ? ` is-moving is-${rising ? 'rising' : 'falling'}` : ''}${missed ? ' is-shaking' : ''}`} key={missed ? `miss-${state.shotKey}` : 'ball'} style={{ left: ball.x - size / 2, width: size, height: size, transform: `translateY(${ball.y - size / 2}px)`, transitionDuration: `${ms}ms` }}>
          <span className="world__streaks" aria-hidden="true"><i /><i /><i /></span>
          <PixelBall size={size} />
        </div>

        {celebrate && (
          <div key={`fx-${state.shotKey}`} className="world__fx" style={{ left: hoopAt.x, top: hoopAt.y, ['--delay' as string]: `${ms}ms` }}>
            <i className="world__flash" style={{ width: 22 * m.scale, height: 4 * m.scale }} />
            <i className="world__ripple" style={{ width: 16 * m.scale, height: 8 * m.scale, top: 2 * m.scale }} />
            {confetti}
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite" data-testid="world-live">{live}</p>
    </>
  );
}
