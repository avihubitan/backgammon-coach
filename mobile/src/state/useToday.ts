import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { currentTime, todayKey } from './progressStore';

/** How often the date is checked while the app is open. */
export const TODAY_CHECK_MS = 60_000;

export interface Today {
  /** Today's key, as the progress store counts days. */
  day: string;
  /** The hour now (0–23), for greetings. */
  hour: number;
}

const read = (): Today => ({ day: todayKey(), hour: currentTime().getHours() });

/**
 * Today, kept current. A screen that stays mounted (the app kept in memory
 * overnight) otherwise keeps showing yesterday: the streak, "Daily goal done",
 * yesterday's challenge. Checks when the app comes back to the front and once
 * a minute while it's open; re-renders only when the day or hour changes.
 */
export function useToday(): Today {
  const [today, setToday] = useState(read);
  useEffect(() => {
    const check = () =>
      setToday((previous) => {
        const next = read();
        return next.day === previous.day && next.hour === previous.hour ? previous : next;
      });
    const timer = setInterval(check, TODAY_CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return today;
}
