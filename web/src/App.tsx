import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnnouncerProvider } from './announcer';
import { SoundProvider } from './sound';
import { Dive } from './Dive';
import { Archive } from './components/Archive';
import { ComingSoon } from './components/ComingSoon';
import { Final } from './components/Final';
import { ErrorScreen } from './components/ErrorScreen';
import { Home } from './components/Home';
import { Hud } from './components/Hud';
import { LoadingScreen } from './components/LoadingScreen';
import { HowToPlay } from './components/HowToPlay';
import { LAUNCH_DATE, historyKey, modeKey, progressKey } from './config';
import { timeoutResult } from './answer';
import { totalPoints } from './dive2';
import { DEFAULT_MODE, isMode, type Mode } from './modes';
import { SECONDS_PER_PROMPT } from './tiers';
import { clearDataCache, loadData, type GameData } from './loadData';
import { buildIndex } from './matching';
import { dateInZone, diveCount, diveNumberOn, divePrompts, isDateString } from './schedule';
import { BALL_X } from './world/scene';
import { useMetrics } from './world/useMetrics';
import { WorldProvider, useWorldStore } from './world/worldStore';
import { browserStorage, loadHistory, loadProgress, migrateLegacy, saveHistory, saveProgress, type History, type Progress, type StorageLike } from './storage';
import { bestScore, computeStreaks, mergeDaily } from './streaks';
import type { Prompt, PromptResult } from './types';

type Load = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & GameData);

const World = lazy(() => import('./world/World'));

type Kind = 'daily' | 'archive' | 'test';
type View =
  | { name: 'home' }
  | { name: 'howto' }
  | { name: 'archive' }
  | { name: 'results'; number: number; play: Mode }
  | { name: 'dive'; number: number; kind: Kind; play: Mode; resume?: { results: PromptResult[]; elapsedMs: number } };

interface Props {
  /** The clock; tests pass a fixed one. */
  now?: () => Date;
  /** Where finished dives are kept. Defaults to localStorage (or nothing, if the browser refuses it). */
  storage?: StorageLike | null;
  /** The URL's query string; ?preview=1 enables the pre-launch play-test, ?preview=1&today=YYYY-MM-DD pretends it is that day. */
  search?: string;
  hash?: string;
  launchDate?: string;
  /** Outside-range names, overriding outside_range.json (tests). */
  outsideNames?: readonly string[];
}

export default function App(props: Props) {
  return (
    <WorldProvider>
      <Game {...props} />
    </WorldProvider>
  );
}

export function modeFromHash(hash: string): Mode | null {
  const word = hash.replace(/^#/, '').toLowerCase();
  return isMode(word) ? word : null;
}

function readSavedMode(store: StorageLike | null, preview: boolean): Mode | null {
  try {
    const saved = store?.getItem(modeKey(preview));
    return isMode(saved) ? saved : null;
  } catch {
    return null;
  }
}

function Game({ now = () => new Date(), storage, search, hash, launchDate = LAUNCH_DATE, outsideNames }: Props) {
  const world = useWorldStore();
  const metrics = useMetrics();
  const params = useMemo(() => new URLSearchParams(search ?? (typeof window === 'undefined' ? '' : window.location.search)), [search]);
  const preview = params.get('preview') === '1';
  const store = useMemo(() => (storage === undefined ? browserStorage() : storage), [storage]);
  const progKey = progressKey(preview);

  const migrated = useRef(false);
  if (!migrated.current) {
    migrated.current = true;
    migrateLegacy(store, preview);
  }

  const [mode, setModeState] = useState<Mode>(() => modeFromHash(hash ?? (typeof window === 'undefined' ? '' : window.location.hash)) ?? readSavedMode(store, preview) ?? DEFAULT_MODE);
  const modeRef = useRef(mode);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0); // bumped by the retry button
  const [histories, setHistories] = useState<Record<Mode, History>>(() => ({ rare: loadHistory(store, historyKey('rare', preview)), common: loadHistory(store, historyKey('common', preview)) }));
  const historiesRef = useRef(histories);
  const storedProgress = useRef<Progress | null>(loadProgress(store, progKey));
  const [saving, setSaving] = useState<boolean>(store !== null);
  const [view, setView] = useState<View | null>(null);
  const history = histories[mode];

  const chooseMode = useCallback(
    (next: Mode): void => {
      modeRef.current = next;
      setModeState(next);
      world.set({ mode: next });
      try {
        store?.setItem(modeKey(preview), next);
      } catch {
      }
      try {
        if (typeof window !== 'undefined' && window.location.hash !== `#${next}`) window.history.replaceState(null, '', `#${next}`);
      } catch {
      }
    },
    [store, world, preview],
  );

  useEffect(() => {
    const onHash = (): void => {
      const next = modeFromHash(window.location.hash);
      if (next && next !== modeRef.current && view?.name !== 'dive') chooseMode(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [chooseMode, view?.name]);

  useEffect(() => {
    world.set({ mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, to show the first mode
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData(import.meta.env.BASE_URL)
      .then((data) => {
        if (!cancelled) setLoad({ status: 'ready', ...data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const index = useMemo(() => (load.status === 'ready' ? buildIndex(load.universe) : null), [load]);
  const isMock = load.status === 'ready' && load.prompts.every((p) => p.id.startsWith('mock-'));

  // Which day it is (in the game's time zone). ?preview=1&today=... lets a tester pretend.
  const override = params.get('today');
  const todayDate = preview && override && isDateString(override) ? override : dateInZone(now());
  const today = diveNumberOn(todayDate, launchDate);
  const launched = today >= 1;
  const streaks = useMemo(() => computeStreaks(mergeDaily(histories.rare, histories.common), today), [histories, today]);
  const total = load.status === 'ready' ? diveCount(load.prompts) : 0;

  // The latest saved progress, kept in memory too so that leaving a dive and coming back resumes it instead of restarting it.
  const progressRef = useRef<Progress | null>(storedProgress.current);

  /** What to resume for a saved dive: its answers and elapsed time, or null if it is stale (another day, other prompts, finished). */
  const resumeFor = (saved: Progress, prompts: readonly Prompt[]): { results: PromptResult[]; elapsedMs: number } | null => {
    const sameDive = prompts.length === 7 && prompts.every((p, i) => p.id === saved.promptIds[i]);
    // a daily dive from an earlier day is discarded, and so is one whose prompts have changed or that is already finished
    const current = saved.mode === 'archive' ? saved.number <= today : saved.number === today && launched;
    if (!sameDive || !current || historiesRef.current[saved.gameMode ?? 'rare'][saved.number]) return null;
    let results = saved.results;
    let elapsed = saved.startedAt === null ? 0 : Math.max(0, now().getTime() - saved.startedAt);
    // time ran out while the page was closed or the dive was left: that prompt is a timeout
    if (results.length < 7 && elapsed >= SECONDS_PER_PROMPT * 1000) {
      results = [...results, timeoutResult(prompts[results.length] as Prompt, '')];
      elapsed = 0;
    }
    return { results, elapsedMs: elapsed };
  };

  const finish = useCallback(
    (number: number, kind: Kind, play: Mode, results: PromptResult[]): void => {
      if (kind === 'test' || historiesRef.current[play][number]) return;
      const next = { ...historiesRef.current, [play]: { ...historiesRef.current[play], [number]: { results, daily: kind === 'daily' } } };
      historiesRef.current = next;
      setHistories(next);
      setSaving(saveHistory(store, historyKey(play, preview), next[play]));
      progressRef.current = null;
      saveProgress(store, progKey, null);
    },
    [store, preview, progKey],
  );

  // On load: finish or resume a dive that was left half-played, else open on today's results if it is finished, else home.
  const opened = useRef(false);
  useEffect(() => {
    if (load.status !== 'ready' || opened.current) return;
    opened.current = true;
    const saved = storedProgress.current;
    storedProgress.current = null;
    if (saved) {
      const play = saved.gameMode ?? 'rare';
      const resume = resumeFor(saved, divePrompts(load.prompts, saved.number));
      if (resume && resume.results.length === 7) {
        chooseMode(play);
        finish(saved.number, saved.mode, play, resume.results);
        setView({ name: 'results', number: saved.number, play });
        return;
      }
      if (resume) {
        chooseMode(play);
        setView({ name: 'dive', number: saved.number, kind: saved.mode, play, resume });
        return;
      }
      progressRef.current = null;
      saveProgress(store, progKey, null);
    }
    setView(launched && history[today] ? { name: 'results', number: today, play: mode } : { name: 'home' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the data has loaded
  }, [load.status]);

  const retry = (): void => {
    clearDataCache();
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (!view || view.name === 'dive' || view.name === 'results') return;
    world.set({ phase: 'idle', mode, diveNumber: launched ? today : null, points: 0, promptNumber: 0, marks: [], skipped: false });
  }, [view, mode, launched, today, world]);

  const go = (next: View): void => setView(next);
  const startDive = (number: number, play: Mode = mode): void => {
    const kind: Kind = number === today ? 'daily' : 'archive';
    const saved = progressRef.current;
    const resume = saved && saved.number === number && (saved.gameMode ?? 'rare') === play && load.status === 'ready' ? resumeFor(saved, divePrompts(load.prompts, number)) : null;
    go({ name: 'dive', number, kind, play, resume: resume && resume.results.length < 7 ? resume : undefined });
  };
  const otherMode = (number: number, next: Mode): void => {
    chooseMode(next);
    if (historiesRef.current[next][number]) go({ name: 'results', number, play: next });
    else startDive(number, next);
  };
  const names = outsideNames ?? (load.status === 'ready' ? load.outsideNames : []);

  const nav = { onHome: () => go({ name: 'home' }), onArchive: () => go({ name: 'archive' }), onHowTo: () => go({ name: 'howto' }) };

  const heroHome = view?.name === 'home' && launched;
  const cardLeft = Math.round(metrics.ox + BALL_X * metrics.scale + 9 * metrics.scale * 0.5 + 36);
  const appStyle = { '--card-left': `${cardLeft}px` } as CSSProperties;
  return (
    <AnnouncerProvider>
      <SoundProvider storage={store}>
        <div className={`app${metrics.narrow ? ' app--narrow' : ''}`} data-mode={mode} data-layout={metrics.narrow ? 'stacked' : 'split'} data-screen={view?.name ?? 'loading'} style={appStyle}>
          <Suspense fallback={<div className="world-fallback" aria-hidden="true" />}>
            <World />
          </Suspense>
          <Hud onHome={nav.onHome} />
          <main className="stage">
            {!heroHome && <h1 className="visually-hidden">NYLON</h1>}
            {(load.status === 'loading' || (load.status === 'ready' && !view)) && <LoadingScreen />}
            {load.status === 'error' && <ErrorScreen message={load.message} onRetry={retry} />}
            {load.status === 'ready' && index && view && total < 1 && <ErrorScreen message="prompts.json has no complete dive of 7 prompts." onRetry={retry} />}
            {load.status === 'ready' && index && view && total >= 1 && (
              <>
                {view.name === 'home' && !launched && (
                  <ComingSoon launchDate={launchDate} onHowTo={nav.onHowTo} onPlayTest={preview ? () => go({ name: 'dive', number: 1, kind: 'test', play: mode }) : undefined} />
                )}
                {view.name === 'home' && launched && (
                  <Home
                    number={today}
                    mode={mode}
                    onMode={chooseMode}
                    played={Boolean(history[today])}
                    streaks={streaks}
                    saving={saving}
                    onPlay={() => startDive(today)}
                    onResults={() => go({ name: 'results', number: today, play: mode })}
                    onArchive={nav.onArchive}
                    onHowTo={nav.onHowTo}
                  />
                )}
                {view.name === 'howto' && <HowToPlay onPlay={launched ? () => startDive(today) : nav.onHome} onBack={nav.onHome} />}
                {view.name === 'archive' && launched && (
                  <Archive today={today} mode={mode} onMode={chooseMode} history={history} saving={saving} onPlay={(n) => startDive(n)} onResults={(number) => go({ name: 'results', number, play: mode })} onBack={nav.onHome} />
                )}
                {view.name === 'archive' && !launched && <ComingSoon launchDate={launchDate} onHowTo={nav.onHowTo} />}
                {view.name === 'results' && histories[view.play][view.number] && (
                  <Final
                    key={`results-${view.number}-${view.play}`}
                    prompts={divePrompts(load.prompts, view.number)}
                    results={histories[view.play][view.number]?.results ?? []}
                    diveNumber={view.number}
                    mode={view.play}
                    best={bestScore(histories[view.play], totalPoints)}
                    headingRef={focusOnMount}
                    streak={view.number === today ? { value: streaks.current } : undefined}
                    onOtherMode={(m) => otherMode(view.number, m)}
                    {...nav}
                  />
                )}
                {view.name === 'dive' && (
                  <Dive
                    key={`${view.number}-${view.kind}-${view.play}`}
                    prompts={divePrompts(load.prompts, view.number)}
                    index={index}
                    diveNumber={view.number}
                    mode={view.play}
                    bestBefore={bestScore(histories[view.play], totalPoints)}
                    outsideNames={names}
                    streak={view.kind === 'daily' ? { value: streaks.current } : undefined}
                    resume={view.resume}
                    clock={() => now().getTime()}
                    onProgress={(results, startedAt) => {
                      if (view.kind === 'test') return;
                      const promptIds = divePrompts(load.prompts, view.number).map((p) => p.id);
                      const progress: Progress = { number: view.number, mode: view.kind, gameMode: view.play, promptIds, results, startedAt };
                      progressRef.current = progress;
                      if (!saveProgress(store, progKey, progress) && store !== null) setSaving(false);
                    }}
                    onFinish={(results) => finish(view.number, view.kind, view.play, results)}
                    onOtherMode={(m) => otherMode(view.number, m)}
                    {...nav}
                  />
                )}
              </>
            )}
            {isMock && <p className="mock-note">Test data: the players, teams and prompts in this version are made up for the tests.</p>}
            <footer className="fineprint">Unofficial fan game. Not affiliated with the NBA.</footer>
          </main>
        </div>
      </SoundProvider>
    </AnnouncerProvider>
  );
}

/** A ref callback that moves focus to a heading when the results screen opens straight away. */
function focusOnMount(node: HTMLHeadingElement | null): void {
  node?.focus();
}

