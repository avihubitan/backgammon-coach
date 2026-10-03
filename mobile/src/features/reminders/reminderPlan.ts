import { dayKey, type StreakStatus } from '@/features/learning/progression';

/**
 * Daily reminders, planned a few days ahead. Pure, so the rules are testable:
 * the app re-plans whenever it opens or the streak changes, which keeps each
 * message true and stops the reminders a few days after the player stops
 * opening the app.
 */
export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface PlannedReminder {
  /** One per day, so planning again replaces a reminder instead of adding another. */
  id: string;
  date: Date;
  title: string;
  body: string;
}

/** Days ahead to schedule: a player who stops opening the app hears from us at most this often. */
export const REMINDER_DAYS = 4;
export const REMINDER_ID_PREFIX = 'daily-reminder-';

/** For days when we can't know how the streak will stand: encouragement that is always true. */
const GENERAL: { title: string; body: string }[] = [
  { title: 'Five minutes of backgammon?', body: 'A short lesson keeps the patterns fresh.' },
  { title: 'Your coach has a drill ready', body: 'Practise one skill in a few minutes.' },
  { title: 'Sharpen your game today', body: 'One lesson or one game: your choice.' },
  { title: 'The board is set up', body: 'Pick up right where you left off.' },
];

function message(offset: number, status: StreakStatus, date: Date): { title: string; body: string } {
  const { days, activeToday, covering } = status;
  if (offset === 0) {
    if (covering > 0) {
      return { title: 'A streak freeze saved yesterday', body: `Learn today to keep your ${days}-day streak going.` };
    }
    if (days > 0) return { title: `Keep your ${days}-day streak going`, body: 'A few minutes is all it takes today.' };
    return { title: 'Ready for a quick lesson?', body: 'Five minutes a day builds real backgammon skill.' };
  }
  // Tomorrow's streak is only certain when today is already done.
  if (offset === 1 && activeToday && days > 0) {
    return { title: `Keep your ${days}-day streak going`, body: 'A few minutes is all it takes today.' };
  }
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return GENERAL[dayNumber % GENERAL.length];
}

export function planReminders({
  now,
  time,
  status,
  days = REMINDER_DAYS,
}: {
  now: Date;
  time: ReminderTime;
  status: StreakStatus;
  days?: number;
}): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, time.hour, time.minute, 0, 0);
    // Nothing today once the player has learned, or when the time has passed.
    if (offset === 0 && (status.activeToday || date.getTime() <= now.getTime() + 60_000)) continue;
    plan.push({ id: `${REMINDER_ID_PREFIX}${dayKey(date)}`, date, ...message(offset, status, date) });
  }
  return plan;
}

/** A sensible first reminder time: when the player is learning now, on the half hour, during waking hours. */
export function suggestedTime(now: Date): ReminderTime {
  const minutes = Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  const clamped = Math.min(Math.max(minutes, 8 * 60), 21 * 60);
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/** Presets offered in settings. */
export const REMINDER_PRESETS: ReminderTime[] = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 18, minute: 30 },
  { hour: 21, minute: 0 },
];

export const sameTime = (a: ReminderTime, b: ReminderTime) => a.hour === b.hour && a.minute === b.minute;

/** "8:00 AM" or "08:00", following the device's locale. */
export function formatTime({ hour, minute }: ReminderTime): string {
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
