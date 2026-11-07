import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { MODES, MODE_LABEL, TIER_CLASS, altitudeFt, formatFeet, pointsFor, zoneName, type Mode } from './modes';
import { ReducedMotionOverride } from './motion';
import type { Tier } from './types';
import { WorldProvider, createWorldStore, INITIAL_WORLD } from './world/worldStore';

const World = lazy(() => import('./world/World'));
const OUTCOMES: Array<{ name: string; tier: Tier | null }> = [{ name: 'airball', tier: null }, ...TIER_CLASS.map((c, i) => ({ name: c.toLowerCase(), tier: (i + 1) as Tier }))];
const LOOP_MS = 2800;

export default function AnimationsPage() {
  const store = useMemo(() => createWorldStore({ ...INITIAL_WORLD, phase: 'prompt', promptNumber: 1, diveNumber: 12 }), []);
  const [mode, setMode] = useState<Mode>('rare');
  const [current, setCurrent] = useState('airball');
  const [auto, setAuto] = useState(true);
  const [reduced, setReduced] = useState(false);

  const play = (name: string, m: Mode): void => {
    const outcome = OUTCOMES.find((o) => o.name === name) ?? OUTCOMES[0]!;
    const before = store.get();
    const marks = before.marks.length >= 7 || before.mode !== m ? [] : before.marks;
    const gained = outcome.tier === null ? 0 : pointsFor(m, outcome.tier - 1);
    const total = Math.min(700, (marks.length === 0 ? 0 : before.points) + gained);
    setCurrent(name);
    store.set({ mode: m, phase: 'result', marks: [...marks, { id: `demo-${before.shotKey + 1}`, tier: outcome.tier, points: total - (marks.length === 0 ? 0 : before.points) }], points: total, shotKey: before.shotKey + 1, skipped: false, promptNumber: marks.length + 1 });
  };

  useEffect(() => {
    store.set({ mode, marks: [], points: 0, phase: 'prompt' });
    setCurrent('start');
  }, [mode]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setCurrent((c) => {
        const next = OUTCOMES[(OUTCOMES.findIndex((o) => o.name === c) + 1) % OUTCOMES.length]!.name;
        play(next, mode);
        return next;
      });
    }, LOOP_MS);
    return () => clearInterval(id);
  }, [auto, store, mode]);

  const total = useSyncExternalStore(store.subscribe, () => store.get().points);
  return (
    <div className="animations">
      <WorldProvider store={store}>
        <ReducedMotionOverride.Provider value={reduced ? true : null}>
          <Suspense fallback={null}>
            <World />
          </Suspense>
        </ReducedMotionOverride.Provider>
      </WorldProvider>
      <main className="animations__panel card">
        <h1 className="title">Ball moves on the moon world</h1>
        <p className="animations__now" data-testid="animation-now">
          Now: <strong>{MODE_LABEL[mode]} · {current}</strong> ({formatFeet(altitudeFt(mode, total))} ft, {zoneName(mode, total)})
        </p>
        <label className="animations__toggle">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Loop through every tier
        </label>
        <label className="animations__toggle">
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> Show the reduced-motion version
        </label>
        <div className="animations__buttons">
          {MODES.map((m) => (
            <button key={m} type="button" className="secondary" data-testid={`mode-${m}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
          {OUTCOMES.map((o) => (
            <button key={o.name} type="button" className="secondary" data-testid={`demo-${o.name}`} aria-pressed={current === o.name} onClick={() => { setAuto(false); play(o.name, mode); }}>
              {o.name}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
