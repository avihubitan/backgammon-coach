import type { SkillId } from '@/curriculum';
import { analytics } from '@/services/analytics';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { todayKey, useProgressStore } from '@/state/progressStore';

import { allMastery, masteryLevels, masteryUps, type MasteryInput, type MasteryLevel, type MasteryUp, type SkillMastery } from './mastery';

/** What the mastery rules need, as the stores hold it now. */
export function currentMasteryInput(): MasteryInput {
  const progress = useProgressStore.getState();
  const records = usePracticeStore.getState().records;
  return {
    lessons: progress.lessons,
    bySkill: progress.stats.bySkill,
    drillLevels: Object.fromEntries(Object.entries(records).map(([kind, record]) => [kind, record?.levels ?? {}])),
    mistakes: useMistakesStore.getState().mistakes,
    today: todayKey(),
  };
}

/** Each skill's level right now: taken when a session starts, to compare at its end. */
export function currentMasteryLevels(): Partial<Record<SkillId, MasteryLevel>> {
  return masteryLevels(currentMasteryInput());
}

export function currentMastery(): SkillMastery[] {
  return allMastery(currentMasteryInput());
}

/**
 * At the end of a lesson or practice session, once its results are saved:
 * the skills that reached a level they never had before (since `before`),
 * worth XP once each. Saves the new levels; the caller adds the XP to the
 * session's reward so it's celebrated with everything else.
 */
export function settleMastery(before: Partial<Record<SkillId, MasteryLevel>>): MasteryUp[] {
  const progress = useProgressStore.getState();
  const after = currentMasteryLevels();
  const ups = masteryUps(before, progress.skillLevels, after);
  progress.recordSkillLevels(after);
  for (const up of ups) analytics.track('skill_level_up', { skill: up.skill, level: up.level, xp: up.xp });
  return ups;
}
