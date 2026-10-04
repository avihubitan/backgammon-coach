import type { IconName } from '@/components/ui/Icon';
import { SKILL_IDS, SKILLS, type SkillId } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import { shiftDay } from '@/features/learning/progression';
import type { SkillStats } from '@/features/learning/progressModel';
import { isMastered, type UserMistake } from '@/features/practice/mistakes';
import { trainingFor } from '@/features/skills/extract';
import type { MistakeCategory } from '@/game';

/**
 * Pure helpers behind the profile statistics. Every number comes from
 * something the learner actually did; sections only appear once there is
 * real data to show.
 */

export interface DayBar {
  day: string;
  /** One-letter weekday label. */
  label: string;
  xp: number;
  today: boolean;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** XP for the last seven days, oldest first, ending today. */
export function lastSevenDays(xpByDay: Record<string, number>, today: string): DayBar[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, index - 6);
    const [y, m, d] = day.split('-').map(Number);
    return {
      day,
      label: WEEKDAY_LETTERS[new Date(y, m - 1, d, 12).getDay()],
      xp: xpByDay[day] ?? 0,
      today: index === 6,
    };
  });
}

export interface SkillInfo {
  label: string;
  icon: IconName;
  /** Drill that trains this skill, if there is one. */
  drill?: DrillCategory;
}

export function skillInfo(id: SkillId): SkillInfo {
  return { label: SKILLS[id].title, icon: SKILLS[id].icon, drill: trainingFor(id).drill };
}

/** A skill needs this many answers before its accuracy is shown. */
export const MIN_SKILL_ANSWERS = 3;

export interface SkillRow extends SkillInfo {
  id: SkillId;
  attempted: number;
  firstTry: number;
  /** First-try accuracy, 0..1. */
  accuracy: number;
}

/** Skills with enough answers to show, in learning-path order. */
export function skillRows(bySkill: Partial<Record<SkillId, Pick<SkillStats, 'attempted' | 'firstTry'>>>): SkillRow[] {
  return SKILL_IDS.map((id) => {
    const stats = bySkill[id] ?? { attempted: 0, firstTry: 0 };
    return {
      id,
      ...skillInfo(id),
      attempted: stats.attempted,
      firstTry: stats.firstTry,
      accuracy: stats.attempted > 0 ? stats.firstTry / stats.attempted : 0,
    };
  }).filter((row) => row.attempted >= MIN_SKILL_ANSWERS);
}

/** The weakest skill worth working on, if any is clearly below par. */
export function focusSkill(rows: SkillRow[], threshold = 0.8): SkillRow | null {
  const candidates = rows.filter((row) => row.attempted >= 5 && row.accuracy < threshold);
  if (candidates.length === 0) return null;
  return candidates.reduce((weakest, row) => (row.accuracy < weakest.accuracy ? row : weakest));
}

export interface CoachSummary {
  found: number;
  fixed: number;
  /** The kind of mistake that comes up most, when there is a clear one. */
  common: MistakeCategory | null;
}

export function coachSummary(mistakes: UserMistake[]): CoachSummary {
  const counts = new Map<MistakeCategory, number>();
  for (const mistake of mistakes) counts.set(mistake.category, (counts.get(mistake.category) ?? 0) + 1);
  let common: MistakeCategory | null = null;
  let best = 1;
  for (const [category, count] of counts) {
    if (count > best) {
      best = count;
      common = category;
    }
  }
  return { found: mistakes.length, fixed: mistakes.filter(isMastered).length, common };
}
