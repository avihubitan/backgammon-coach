import { platformNotifications } from './platformNotifications';
import { createReminderService } from './reminderService';

export type { EnableResult, ReminderService } from './reminderService';
export type { ReminderPermission } from './types';

export const reminderService = createReminderService({ adapter: platformNotifications });
