import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Where it counts up from when the value changes (default: the value it showed before). */
  from?: number;
  /** Wait this long before starting to count. */
  delayMs?: number;
  durationMs?: number;
  /** Show the value at once. */
  instant?: boolean;
  format?: (n: number) => string;
}

/** A number that rolls up to its new value. It only rewrites its own text, a few times a second, so it costs no layout. */
export function RollingNumber({ value, from, delayMs = 0, durationMs = 500, instant = false, format }: Props) {
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(shown);
  current.current = shown;
  useEffect(() => {
    if (instant || current.current === value) {
      setShown(value);
      return;
    }
    const start = from ?? current.current;
    let frame = 0;
    let begun = 0;
    const timer = setTimeout(() => {
      begun = performance.now();
      const step = (now: number): void => {
        const t = Math.min(1, (now - begun) / durationMs);
        const eased = 1 - (1 - t) ** 3;
        setShown(Math.round(start + (value - start) * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, from, delayMs, durationMs, instant]);
  return <>{format ? format(shown) : shown}</>;
}
