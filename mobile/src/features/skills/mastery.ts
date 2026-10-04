import type { IconName } from '@/components/ui/Icon';
import { allLessons, introducingLesson, lessonSkills, SKILL_IDS, type SkillId } from '@/curriculum';
import { DRILL_CATEGORIES, type DrillCategoryInfo, type DrillLevel } from '@/curriculum/drills';
import { dayKey, daysBetween, type LessonRecords } from '@/features/learning/progression';
import { emptySkillStats, type SkillStats } from '@/features/learning/progressModel';
import { levelCleared, type LevelStats } from '@/features/practice/drillLevels';
import { isMastered, type UserMistake } from '@/features/practice/mistakes';

import { skillOfMistake } from './extract';
import { MASTERY_LEVELS, masteryRank, type MasteryLevel } from './masteryLevel';

export { isMasteryLevel, MASTERY_LEVELS, masteryRank, type MasteryLevel } from './masteryLevel';

/**
 * Skill mastery, from what the learner actually did. A skill is Introduced
 * once a lesson has taught it, Practised once they've come back to it on
 * another day, Reliable when their latest answers are mostly right, a drill
 * level is cleared and it holds up in their games, and Mastered when that has
 * lasted. Rules, not a model: each level says in one sentence what it takes to
 * reach the next. Pure, so profile badges, rewards and tests agree.
 */
/** How each level shows to the learner. */
export const MASTERY_BADGE: Record<Exclude<MasteryLevel, 'none'>, { label: string; icon: IconName }> = {
  introduced: { label: 'Learning', icon: 'check' },
  practised: { label: 'Practising', icon: 'check-all' },
  reliable: { label: 'Strong', icon: 'star' },
  mastered: { label: 'Mastered', icon: 'star-circle' },
};

export const MASTERY_RULES = {
  /** Come back to it: this many answers, on this many different days. */
  practised: { answers: 8, days: 2 },
  /** Of the latest answers (at least `recent` of them), this share right on the first try. */
  reliable: { answers: 15, days: 3, recent: 8, share: 0.8 },
  /** ...and keep it up: a right answer within `freshDays`, every open drill level cleared, no recent game mistakes. */
  mastered: { answers: 30, days: 5, recent: 10, share: 0.85, freshDays: 30 },
  /** Open mistakes about the skill from games in this many days... */
  gameDays: 14,
  /** ...this many of them (a pattern) keep it below Reliable. */
  gamePattern: 3,
  /** Not practised for this many days: it's fading, and a refresher is due. */
  fadingDays: 21,
} as const;

/** XP the first time a skill reaches each level: real improvement, earned once. */
export const MASTERY_XP: Record<MasteryLevel, number> = { none: 0, introduced: 0, practised: 20, reliable: 40, mastered: 80 };

export interface MasteryInput {
  lessons: LessonRecords;
  bySkill: Partial<Record<SkillId, SkillStats>>;
  /** Each drill's results per level. */
  drillLevels: Partial<Record<string, Partial<Record<string, LevelStats>>>>;
  mistakes: readonly UserMistake[];
  /** YYYY-MM-DD. */
  today: string;
}

export interface SkillMastery {
  skill: SkillId;
  level: MasteryLevel;
  /** What it takes to reach the next level, in one sentence (null once mastered). */
  next: string | null;
  /** How far along the way to the next level, 0..1. */
  progress: number;
  /** Not practised for a while: a quick round keeps it. */
  fading: boolean;
  /** Open mistakes about it in recent games. */
  gameMistakes: number;
}

interface Requirement {
  met: boolean;
  /** 0..1 */
  share: number;
  todo: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const part = (have: number, need: number) => (need <= 0 ? 1 : Math.max(0, Math.min(1, have / need)));

/** The drill levels that train `skill` and that the learner has opened. */
function trainingLevels(skill: SkillId, lessons: LessonRecords): { drill: DrillCategoryInfo; level: DrillLevel }[] {
  const done = (lessonId: string) => !!lessons[lessonId]?.completed;
  return DRILL_CATEGORIES.flatMap((drill) =>
    done(drill.requiresLesson)
      ? drill.levels
          .filter((level) => (level.skill ?? drill.skill) === skill && (!level.requiresLesson || done(level.requiresLesson)))
          .map((level) => ({ drill, level }))
      : [],
  );
}

/** Unmastered mistakes about `skill` from games in the last few days. */
function recentGameMistakes(skill: SkillId, mistakes: readonly UserMistake[], today: string): number {
  return mistakes.filter((mistake) => {
    if (isMastered(mistake) || skillOfMistake(mistake) !== skill) return false;
    const made = new Date(mistake.createdAt);
    return !Number.isNaN(made.getTime()) && daysBetween(dayKey(made), today) <= MASTERY_RULES.gameDays;
  }).length;
}

function answers(stats: SkillStats, need: number): Requirement {
  const missing = need - stats.attempted;
  return { met: missing <= 0, share: part(stats.attempted, need), todo: `Answer ${plural(missing, 'more question')} about it.` };
}

function days(stats: SkillStats, need: number): Requirement {
  const missing = need - stats.days;
  return {
    met: missing <= 0,
    share: part(stats.days, need),
    todo: missing === 1 ? 'Practise it on one more day.' : `Practise it on ${missing} more days.`,
  };
}

function recentShare(stats: SkillStats, need: number, share: number): Requirement {
  const recent = stats.recent.length;
  const right = [...stats.recent].filter((answer) => answer === '1').length;
  if (recent < need) return { met: false, share: part(recent, need), todo: `Answer ${plural(need - recent, 'more question')} about it.` };
  const met = right >= share * recent;
  return {
    met,
    share: part(right / recent, share),
    todo: `Get more right on the first try: ${right} of your last ${recent} so far.`,
  };
}

function games(count: number, allowed: number): Requirement {
  return {
    met: count <= allowed,
    share: count <= allowed ? 1 : 0,
    todo:
      count === 1
        ? 'Fix the position you got wrong in a recent game.'
        : `Fix the ${count} positions you got wrong in recent games.`,
  };
}

export function skillMastery(skill: SkillId, input: MasteryInput): SkillMastery {
  const stats = input.bySkill[skill] ?? emptySkillStats();
  const introduced = allLessons.some((lesson) => input.lessons[lesson.id]?.completed && lessonSkills(lesson).includes(skill));
  const levels = trainingLevels(skill, input.lessons);
  const cleared = (entry: { drill: DrillCategoryInfo; level: DrillLevel }) =>
    levelCleared(input.drillLevels[entry.drill.id]?.[entry.level.id]);
  const clearedCount = levels.filter(cleared).length;
  const firstUncleared = levels.find((entry) => !cleared(entry));
  const gameMistakes = recentGameMistakes(skill, input.mistakes, input.today);
  const sinceRight = stats.lastFirstTryDay ? daysBetween(stats.lastFirstTryDay, input.today) : Infinity;
  const { practised, reliable, mastered } = MASTERY_RULES;

  const steps: { level: MasteryLevel; requirements: Requirement[] }[] = [
    { level: 'practised', requirements: [answers(stats, practised.answers), days(stats, practised.days)] },
    {
      level: 'reliable',
      requirements: [
        games(gameMistakes, MASTERY_RULES.gamePattern - 1),
        answers(stats, reliable.answers),
        recentShare(stats, reliable.recent, reliable.share),
        days(stats, reliable.days),
        levels.length === 0 || clearedCount > 0
          ? { met: true, share: 1, todo: '' }
          : { met: false, share: 0, todo: `Clear a level of the “${levels[0].drill.title}” drill.` },
      ],
    },
    {
      level: 'mastered',
      requirements: [
        games(gameMistakes, 0),
        answers(stats, mastered.answers),
        recentShare(stats, mastered.recent, mastered.share),
        days(stats, mastered.days),
        firstUncleared
          ? {
              met: false,
              share: part(clearedCount, levels.length),
              todo: `Clear “${firstUncleared.level.title}” in the “${firstUncleared.drill.title}” drill.`,
            }
          : { met: true, share: 1, todo: '' },
        {
          met: sinceRight <= mastered.freshDays,
          share: sinceRight <= mastered.freshDays ? 1 : 0,
          todo: 'Get one right again: it’s been a while.',
        },
      ],
    },
  ];

  let level: MasteryLevel = introduced ? 'introduced' : 'none';
  let ahead: Requirement[] | null = null;
  if (introduced) {
    for (const step of steps) {
      if (step.requirements.every((requirement) => requirement.met)) {
        level = step.level;
      } else {
        ahead = step.requirements;
        break;
      }
    }
  }

  const fading =
    masteryRank(level) >= masteryRank('practised') &&
    !!stats.lastDay &&
    daysBetween(stats.lastDay, input.today) >= MASTERY_RULES.fadingDays;
  let next: string | null = null;
  let progress = 1;
  if (!introduced) {
    const lesson = introducingLesson(skill);
    next = lesson ? `Finish the lesson “${lesson.title}” to start.` : null;
    progress = 0;
  } else if (ahead) {
    next = ahead.find((requirement) => !requirement.met)?.todo ?? null;
    progress = ahead.reduce((sum, requirement) => sum + requirement.share, 0) / ahead.length;
  }
  return { skill, level, next, progress, fading, gameMistakes };
}

/** Every skill a lesson has taught, in learning-path order. */
export function allMastery(input: MasteryInput): SkillMastery[] {
  return SKILL_IDS.map((skill) => skillMastery(skill, input)).filter((mastery) => mastery.level !== 'none');
}

/** Each skill's level, for comparing before and after a session. */
export function masteryLevels(input: MasteryInput): Partial<Record<SkillId, MasteryLevel>> {
  return Object.fromEntries(allMastery(input).map((mastery) => [mastery.skill, mastery.level]));
}

export interface MasteryUp {
  skill: SkillId;
  level: MasteryLevel;
  /** XP for every level passed on the way, each earned once. */
  xp: number;
}

/**
 * Skills that reached a level they had never reached before. `before` is the
 * learner's levels when the session started, `best` the highest ever saved
 * (missing for saves from before mastery existed: then `before` stands in, so
 * an update never pays out for old progress all at once).
 */
export function masteryUps(
  before: Partial<Record<SkillId, MasteryLevel>>,
  best: Partial<Record<SkillId, MasteryLevel>>,
  after: Partial<Record<SkillId, MasteryLevel>>,
): MasteryUp[] {
  return SKILL_IDS.flatMap((skill) => {
    const now = after[skill] ?? 'none';
    const floor = Math.max(masteryRank(before[skill] ?? 'none'), masteryRank(best[skill] ?? 'none'));
    if (masteryRank(now) <= floor) return [];
    const xp = MASTERY_LEVELS.slice(floor + 1, masteryRank(now) + 1).reduce((sum, level) => sum + MASTERY_XP[level], 0);
    return [{ skill, level: now, xp }];
  });
}
