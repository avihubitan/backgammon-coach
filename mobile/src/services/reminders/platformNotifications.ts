import { createMemoryNotifications } from './memoryNotifications';
import type { NotificationsAdapter } from './types';

/**
 * Web: browsers can't schedule a notification for tomorrow, so reminders are
 * hidden. Development builds simulate them, so the flow can be tried.
 */
export const platformNotifications: NotificationsAdapter | null = __DEV__ ? createMemoryNotifications() : null;
