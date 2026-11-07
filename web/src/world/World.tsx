import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { MODE_CHIP, THRESHOLDS, TIER_CLASS, ZONE_NAMES, ballY, reachedEnd, travelMs } from '../modes';
import { useViewport } from './useMetrics';
import { useReducedMotion } from '../motion';
import { useWorldState } from './worldStore';
import { BALL_X, GRID, MOON, RIM_Y as ARENA_RIM_Y, renderClouds, renderCrowdShimmer, renderScene, renderStars, cameraY, sceneMetrics, type Layer } from './scene';
import { TIER_COLORS } from './palette';
import './world.css';

const BALL_CELLS = 9;
const ARCS = new Set(['2,2', '1,3', '1,5', '2,6', '6,2', '7,3', '7,5', '6,6']);
export function ballPixels(color = '#FF6A13', ink = '#1A0902'): Array<{ x: number; y: number; fill: string }> {
  const out: Array<{ x: number; y: number; fill: string }> = [];
  for (let y = 0; y < BALL_CELLS; y++) {
    for (let x = 0; x < BALL_CELLS; x++) {
      const d = Math.hypot(x - 4, y - 4);
      if (d > 4.5) continue;
      const seam = x === 4 || y === 4 || ARCS.has(`${x},${y}`);
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

export default function World() {
  const state = useWorldState();
  const reduced = useReducedMotion();
  const vp = useViewport();
  const m = useMemo(() => sceneMetrics(vp.w, vp.h), [vp.w, vp.h]);
  const scene = useMemo(() => renderScene(), []);
  const clouds = useMemo(() => renderClouds(), []);
  const stars = useMemo(() => [renderStars(3), renderStars(11), renderStars(19)], []);
  const crowd = useMemo(() => [renderCrowdShimmer(5), renderCrowdShimmer(9)], []);

  const total = state.points;
  const last = state.marks[state.marks.length - 1];
  const justAnswered = state.phase === 'result' && last !== undefined;
  const earned = justAnswered ? last.points : 0;
  const missed = justAnswered && earned === 0;
  const celebrate = justAnswered && earned > 0 && reachedEnd(total) && !reduced;
  const ms = reduced || state.skipped ? 0 : travelMs(earned);
  const before = total - earned;
  const rising = ballY(state.mode, total) < ballY(state.mode, before);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (earned === 0 || ms === 0) return;
    setMoving(true);
    const id = setTimeout(() => setMoving(false), ms);
    return () => clearTimeout(id);
  }, [earned, ms, state.shotKey]);

  const size = Math.max(BALL_CELLS * m.scale, m.narrow ? 30 : 0);
  const wy = (points: number): number => ballY(state.mode, points) * m.scale;
  const midY = state.band ? (state.band.top + state.band.bottom) / 2 : vp.h * (vp.keyboard ? 0.55 : 0.34);
  const cam = m.narrow ? cameraY(m, ballY(state.mode, total), midY, vp.h) : m.oy;
  const sy = (points: number): number => wy(points) + cam;
  const ball = { x: m.ox + BALL_X * m.scale, y: wy(total) + cam };
  const camMs = ms > 0 ? ms : 250;
  const cls = ['world', reduced ? 'is-reduced' : '', state.skipped ? 'is-skipped' : '', m.narrow ? 'is-narrow' : ''].filter(Boolean).join(' ');
  const sceneStyle: CSSProperties = { left: m.ox, top: 0, width: GRID.w * m.scale, height: GRID.h * m.scale };

  const hoop = state.mode === 'common' ? { x: MOON.x, y: MOON.y + MOON.r + 2 } : { x: BALL_X, y: ARENA_RIM_Y + 4 };
  const hoopAt = { x: m.ox + hoop.x * m.scale, y: hoop.y * m.scale };

  const live = justAnswered && last
    ? last.tier === null ? `AIRBALL, 0 points, ${total} total` : `${TIER_CLASS[last.tier - 1]} pick, ${last.points} points, ${total} total`
    : '';

  let running = 0;
  const path = state.marks.flatMap((mark) => {
    running += mark.points;
    return mark.tier ? [{ tier: mark.tier, at: running }] : [];
  });
  const stacked = new Map<number, number>();

  const confetti: ReactElement[] = celebrate
    ? Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const reach = (46 + ((i * 29) % 70)) * (m.scale / 4);
        return <span key={i} className={`world__bit world__bit--${i % 3}`} style={{ '--dx': `${Math.cos(angle) * reach}px`, '--dy': `${Math.sin(angle) * reach - 20}px`, '--delay': `${ms}ms` } as CSSProperties} />;
      })
    : [];

  const zoneTop = sy(THRESHOLDS[state.mode === 'common' ? 5 : 0] as number) - 30;
  const zoneBottom = sy(THRESHOLDS[state.mode === 'common' ? 0 : 5] as number) + 30;

  const worldH = GRID.h * m.scale;
  const tag = m.narrow && justAnswered && last ? `${last.name.trim() === '' ? 'No answer' : last.name}  +${last.points}` : null;

  return (
    <>
      <div className={cls} aria-hidden="true" data-testid="world" data-phase={state.phase} data-mode={state.mode} data-total={total} data-ball-y={ballY(state.mode, total).toFixed(2)} data-scale={m.scale.toFixed(2)} style={{ '--cell': `${m.scale}px` } as CSSProperties}>
        <div className="world__cam" style={{ transform: `translateY(${cam}px)`, transitionDuration: `${m.narrow ? camMs : 0}ms` }}>
          <div className="world__scene" style={sceneStyle}>
            <LayerCanvas layer={scene} className="world__layer world__base" scale={m.scale} />
            {stars.map((s, i) => <LayerCanvas key={i} layer={s} className={`world__layer world__stars world__stars--${i}`} scale={m.scale} />)}
            <div className="world__clouds" style={{ width: GRID.w * 2 * m.scale, height: GRID.h * m.scale, ['--loop' as string]: `${-GRID.w * m.scale}px` }}>
              <LayerCanvas layer={clouds} className="world__layer" scale={m.scale} />
            </div>
            {crowd.map((s, i) => <LayerCanvas key={i} layer={s} className={`world__layer world__crowd world__crowd--${i}`} scale={m.scale} />)}
          </div>
          <i className="world__sat world__sat--a" style={{ top: 40 * m.scale, width: 4 * m.scale, height: 2 * m.scale }} />
          <i className="world__sat world__sat--b" style={{ top: 76 * m.scale, width: 3 * m.scale, height: 2 * m.scale }} />

          <svg className="world__lines" width="100%" height={worldH} shapeRendering="crispEdges">
            {THRESHOLDS.map((t) => <line key={t} className="world__line" x1="0" x2="100%" y1={wy(t)} y2={wy(t)} />)}
            <line className="world__guide" x1={ball.x} x2={ball.x} y1={0} y2={203 * m.scale} />
          </svg>

          <div className="world__ruler" style={{ right: m.narrow ? 6 : 26, height: worldH }}>
            <i className="world__rule" style={{ top: Math.min(wy(0), wy(700)) - 10, height: Math.abs(wy(700) - wy(0)) + 20 }} />
            {THRESHOLDS.map((t, i) => (
              <span key={t}>
                <i className="world__tick" style={{ top: wy(t) }} />
                <i className="world__zone" style={{ top: wy(t) }}>{ZONE_NAMES[state.mode][i]}</i>
              </span>
            ))}
            {path.map(({ tier, at }, i) => {
              const slot = stacked.get(at) ?? 0;
              stacked.set(at, slot + 1);
              return (
                <span key={i} className="world__ghost" style={{ top: wy(at) + slot * 16 }}>
                  <PixelBall size={14} color={TIER_COLORS[tier]} />
                  <b style={{ color: tier === 1 ? '#A8A8A8' : TIER_COLORS[tier] }}>{tier}</b>
                </span>
              );
            })}
            <span className="world__you" style={{ transform: `translateY(${wy(total)}px)`, transitionDuration: `${ms}ms` }}>
              <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges"><path d="M7 0V7L0 3.5Z" fill="#FF6A13" /></svg>
              <b>YOU</b>
            </span>
          </div>

          {celebrate && (
            <div key={`fx-${state.shotKey}`} className="world__fx" style={{ left: hoopAt.x, top: hoopAt.y, ['--delay' as string]: `${ms}ms` }}>
              <i className="world__flash" style={{ width: 22 * m.scale, height: 4 * m.scale }} />
              <i className="world__ripple" style={{ width: 16 * m.scale, height: 8 * m.scale, top: 2 * m.scale }} />
              {confetti}
            </div>
          )}
        </div>

        {!m.narrow && (
          <div className="world__gauge" style={{ top: zoneTop, height: zoneBottom - zoneTop }}>
            {THRESHOLDS.map((t, i) => (
              <div key={t} className="world__row" style={{ top: sy(t) - zoneTop - 15 }} data-zone={ZONE_NAMES[state.mode][i]}>
                <span className="world__name">{ZONE_NAMES[state.mode][i]}</span>
                <span className="world__pts">{t}+ PTS</span>
              </div>
            ))}
          </div>
        )}
        {!m.narrow && <p className="world__mode">{MODE_CHIP[state.mode]}</p>}

        <div className={`world__ball${moving ? ` is-moving is-${rising ? 'rising' : 'falling'}` : ''}${missed ? ' is-shaking' : ''}`} key={missed ? `miss-${state.shotKey}` : 'ball'} style={{ left: ball.x - size / 2, width: size, height: size, transform: `translateY(${ball.y - size / 2}px)`, transitionDuration: `${ms}ms` }}>
          <span className="world__streaks" aria-hidden="true"><i /><i /><i /></span>
          <PixelBall size={size} />
        </div>
        {tag && (
          <p key={`tag-${state.shotKey}`} className="world__tag" style={{ left: ball.x + size / 2 + 6, top: ball.y - 14, animationDelay: `${Math.min(ms, 300)}ms` }}>{tag}</p>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite" data-testid="world-live">{live}</p>
    </>
  );
}
