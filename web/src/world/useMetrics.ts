import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneMetrics, type Metrics } from './scene';

export interface Viewport {
  w: number;
  h: number;
  top: number;
  keyboard: boolean;
}

const read = (tallest: number): Viewport => {
  if (typeof window === 'undefined') return { w: 1440, h: 860, top: 0, keyboard: false };
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const top = vv ? vv.offsetTop : 0;
  return { w: window.innerWidth, h: Math.round(h), top: Math.round(top), keyboard: h < tallest * 0.82 };
};

export function useViewport(): Viewport {
  const memo = useRef({ width: typeof window === 'undefined' ? 0 : window.innerWidth, tallest: typeof window === 'undefined' ? 0 : window.innerHeight });
  const [size, setSize] = useState<Viewport>(() => read(memo.current.tallest));
  useEffect(() => {
    const update = (): void => {
      if (window.innerWidth !== memo.current.width) memo.current = { width: window.innerWidth, tallest: 0 };
      memo.current.tallest = Math.max(memo.current.tallest, window.innerHeight);
      const next = read(memo.current.tallest);
      setSize((s) => (s.w === next.w && s.h === next.h && s.top === next.top && s.keyboard === next.keyboard ? s : next));
    };
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return size;
}

export const useMetrics = (): Metrics => {
  const { w, h } = useViewport();
  return useMemo(() => sceneMetrics(w, h), [w, h]);
};
