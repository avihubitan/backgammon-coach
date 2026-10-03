import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { reminderService } from '@/services/reminders';

/** Tabs a reminder may move the player away from. Lessons, games and practice are never interrupted. */
const OTHER_TABS = ['/learn', '/play', '/practice', '/profile'];

/**
 * Opening the app from a reminder shows Home: the streak and the coach's pick
 * the reminder talks about. (A cold start opens on Home anyway.)
 */
export function useReminderTaps() {
  const pathname = usePathname();
  const current = useRef(pathname);
  useEffect(() => {
    current.current = pathname;
  }, [pathname]);
  useEffect(
    () =>
      reminderService.onOpened(() => {
        if (OTHER_TABS.includes(current.current)) router.navigate('/');
      }),
    [],
  );
}
