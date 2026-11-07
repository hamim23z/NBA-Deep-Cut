import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Final } from './components/Final';
import { PromptScreen } from './components/PromptScreen';
import { Reveal } from './components/Reveal';
import { currentPrompt, diveReducer, isOver, isRevealed, startDive, totalPoints } from './dive2';
import type { Index } from './matching';
import { applyMode, type Mode } from './modes';
import { marksFrom, useWorldStore } from './world/worldStore';
import type { Prompt, PromptResult } from './types';

interface Props {
  /** The 7 prompts of the dive, in file order. */
  prompts: readonly Prompt[];
  index: Index;
  diveNumber: number;
  mode: Mode;
  bestBefore: number;
  outsideNames?: readonly string[];
  /** Called once, when the last prompt has been answered and the results screen appears. */
  onFinish: (results: PromptResult[]) => void;
  onHome: () => void;
  onArchive: () => void;
  onHowTo: () => void;
  onOtherMode: (mode: Mode) => void;
  streak?: { value: number };
  /** Resume a dive after a reload: the answers already given, and how much of the prompt on screen has gone. */
  resume?: { results: PromptResult[]; elapsedMs: number };
  /** Called after every answer and whenever a new prompt appears, so progress can be saved. startedAt is null on a result screen. */
  onProgress?: (results: PromptResult[], startedAt: number | null) => void;
  clock?: () => number;
}

export function Dive({ prompts, index, diveNumber, mode, bestBefore, outsideNames, onFinish, onHome, onArchive, onHowTo, onOtherMode, streak, resume, onProgress, clock = Date.now }: Props) {
  const [state, dispatch] = useReducer(diveReducer, undefined, () => {
    const fresh = startDive([...prompts]);
    return resume ? { ...fresh, results: resume.results, index: resume.results.length } : fresh;
  });
  const startedAt = useRef<number | null>(null);
  const resumedElapsed = useRef(resume?.elapsedMs ?? 0);
  const resumeIndex = useRef(resume ? resume.results.length : -1);
  const finalRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const finished = useRef(false);
  const world = useWorldStore();
  const [skippedAt, setSkippedAt] = useState(-1);

  const prompt = currentPrompt(state);
  const over = isOver(state);
  const revealed = isRevealed(state);

  // Save after every answer, and note when each prompt appeared (a reload cannot give extra time).
  useEffect(() => {
    if (over) return;
    if (!revealed && startedAt.current === null) startedAt.current = clock() - (state.index === resumeIndex.current ? resumedElapsed.current : 0);
    if (revealed) startedAt.current = null;
    onProgress?.(state.results, revealed ? null : startedAt.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per answer or new prompt
  }, [state.index, state.results.length, over]);
  const result = state.results[state.index];
  const points = useMemo(() => totalPoints(state.results), [state.results]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (over) finalRef.current?.focus();
  }, [state.index, revealed, over]);

  useEffect(() => {
    if (over) return;
    world.set({ mode, phase: revealed ? 'result' : 'prompt', promptNumber: Math.min(state.index + 1, state.prompts.length), total: state.prompts.length, points, diveNumber, marks: marksFrom(state.results), ...(revealed ? {} : { skipped: false }) });
  }, [world, mode, over, revealed, state.index, state.results, state.prompts.length, points, diveNumber]);

  useEffect(() => {
    if (over && !finished.current) {
      finished.current = true;
      onFinish(state.results);
    }
  }, [over, state.results, onFinish]);

  if (over || !prompt) {
    const best = Math.max(bestBefore, points);
    return <Final prompts={state.prompts} results={state.results} diveNumber={diveNumber} mode={mode} best={best} headingRef={finalRef} onHome={onHome} onArchive={onArchive} onHowTo={onHowTo} onOtherMode={onOtherMode} streak={streak} />;
  }
  const skipped = skippedAt === state.index;
  if (revealed && result) {
    return (
      <Reveal
        key={prompt.id}
        prompt={prompt}
        result={result}
        mode={mode}
        isLast={state.index === state.prompts.length - 1}
        headingRef={resultRef}
        onNext={() => dispatch({ type: 'next' })}
        skipped={skipped}
        onSkip={() => {
          setSkippedAt(state.index);
          world.set({ skipped: true });
        }}
      />
    );
  }
  return (
    <PromptScreen
      key={prompt.id}
      prompt={prompt}
      mode={mode}
      index={index}
      outsideNames={outsideNames}
      elapsedMs={state.index === resumeIndex.current ? resumedElapsed.current : 0}
      onResult={(r: PromptResult) => dispatch({ type: 'submit', result: applyMode(r, mode) })}
    />
  );
}
