import { useEffect, useState } from 'react';

/** Animates a number from 0 to `target` (used for XP rewards). */
export function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      const startedAt = Date.now();
      frame = setInterval(() => {
        const t = Math.min(1, (Date.now() - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t >= 1 && frame) clearInterval(frame);
      }, 16);
    }, delayMs);
    return () => {
      clearTimeout(start);
      if (frame) clearInterval(frame);
    };
  }, [target, durationMs, delayMs]);
  return value;
}
