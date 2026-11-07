import { useEffect, useMemo, useState } from 'react';
import { sceneMetrics, type Metrics } from './scene';

/** The window size, following resizes. */
export function useViewport(): { w: number; h: number } {
  const read = (): { w: number; h: number } => ({ w: typeof window === 'undefined' ? 1440 : window.innerWidth, h: typeof window === 'undefined' ? 860 : window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = (): void => setSize((s) => {
      const next = read();
      return s.w === next.w && s.h === next.h ? s : next;
    });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

export const useMetrics = (): Metrics => {
  const { w, h } = useViewport();
  return useMemo(() => sceneMetrics(w, h), [w, h]);
};

