import type { StreakStatus } from '@/features/learning/progression';

import { planReminders, REMINDER_DAYS, REMINDER_ID_PREFIX, suggestedTime } from '../reminderPlan';

const status = (overrides: Partial<StreakStatus> = {}): StreakStatus => ({
  days: 0,
  activeToday: false,
  covering: 0,
  freezes: 0,
  nextFreezeIn: 7,
  ...overrides,
});

const at = (day: number, hour: number, minute = 0) => new Date(2026, 2, day, hour, minute);
const evening = { hour: 19, minute: 30 };

describe('reminder plan', () => {
  it('schedules one reminder a day at the chosen time, starting today', () => {
    const plan = planReminders({ now: at(10, 9), time: evening, status: status() });
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan.map((reminder) => reminder.date)).toEqual([at(10, 19, 30), at(11, 19, 30), at(12, 19, 30), at(13, 19, 30)]);
    expect(plan[0].id).toBe(`${REMINDER_ID_PREFIX}2026-03-10`);
    expect(new Set(plan.map((reminder) => reminder.id)).size).toBe(plan.length);
  });

  it('skips today once the player has learned, or when the time has passed', () => {
    expect(planReminders({ now: at(10, 9), time: evening, status: status({ activeToday: true, days: 3 }) })[0].date).toEqual(
      at(11, 19, 30),
    );
    expect(planReminders({ now: at(10, 20), time: evening, status: status() })[0].date).toEqual(at(11, 19, 30));
    // A reminder due within the minute is skipped too.
    expect(planReminders({ now: at(10, 19, 29), time: evening, status: status() })[0].date).toEqual(at(11, 19, 30));
  });

  it('names the streak today, and tomorrow only when today is already done', () => {
    const atRisk = planReminders({ now: at(10, 9), time: evening, status: status({ days: 12 }) });
    expect(atRisk[0].title).toBe('Keep your 12-day streak going');
    // Whether the streak survives today is unknown, so tomorrow stays general.
    expect(atRisk[1].title).not.toMatch(/streak/);

    const done = planReminders({ now: at(10, 9), time: evening, status: status({ days: 12, activeToday: true }) });
    expect(done[0].title).toBe('Keep your 12-day streak going');
    expect(done[0].date).toEqual(at(11, 19, 30));
    expect(done.slice(1).every((reminder) => !/streak/.test(reminder.title))).toBe(true);
  });

  it('mentions a freeze that is covering a missed day', () => {
    const [today] = planReminders({ now: at(10, 9), time: evening, status: status({ days: 9, covering: 1 }) });
    expect(today.title).toBe('A streak freeze saved yesterday');
    expect(today.body).toContain('9-day streak');
  });

  it('invites a player without a streak', () => {
    expect(planReminders({ now: at(10, 9), time: evening, status: status() })[0].title).toBe('Ready for a quick lesson?');
  });

  it('varies the general messages from day to day', () => {
    const plan = planReminders({ now: at(10, 9), time: evening, status: status(), days: 6 });
    expect(new Set(plan.slice(1).map((reminder) => reminder.title)).size).toBeGreaterThan(2);
  });

  it('keeps local times across a daylight saving change', () => {
    // Whatever the time zone, each reminder lands at 19:30 local time.
    const plan = planReminders({ now: at(27, 9), time: evening, status: status(), days: 4 });
    expect(plan.every((reminder) => reminder.date.getHours() === 19 && reminder.date.getMinutes() === 30)).toBe(true);
  });
});

describe('suggested reminder time', () => {
  it('rounds to the half hour the player is learning at, during waking hours', () => {
    expect(suggestedTime(at(10, 19, 10))).toEqual({ hour: 19, minute: 0 });
    expect(suggestedTime(at(10, 19, 20))).toEqual({ hour: 19, minute: 30 });
    expect(suggestedTime(at(10, 6, 0))).toEqual({ hour: 8, minute: 0 });
    expect(suggestedTime(at(10, 23, 40))).toEqual({ hour: 21, minute: 0 });
  });
});
