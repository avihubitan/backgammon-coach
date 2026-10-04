import { introducingLesson, lessonsForSkill, type Lesson, type SkillId } from '@/curriculum';
import { DRILL_CATEGORIES, type DrillCategory } from '@/curriculum/drills';
import { REVIEW_HEADLINES, type MistakeCategory } from '@/game';

/**
 * Skill extraction: puts what the coach sees in a game into the curriculum's
 * terms. The review says what went wrong (a category and a headline); this
 * says which skill that was, and where that skill is taught and practised.
 * Pure, so the coach, practice and statistics all agree.
 */

/** Each review headline names one idea, so it decides the skill. */
const SKILL_OF_HEADLINE: Record<string, SkillId> = {
  [REVIEW_HEADLINES.bearOffMore]: 'bear-off',
  [REVIEW_HEADLINES.smootherBearOff]: 'bear-off',
  [REVIEW_HEADLINES.raceEfficiently]: 'racing',
  [REVIEW_HEADLINES.missedHit]: 'hitting',
  [REVIEW_HEADLINES.pressure]: 'hitting',
  [REVIEW_HEADLINES.anchor]: 'anchors',
  [REVIEW_HEADLINES.point]: 'points',
  [REVIEW_HEADLINES.structure]: 'points',
  [REVIEW_HEADLINES.safer]: 'safety',
  [REVIEW_HEADLINES.slightlySafer]: 'safety',
  [REVIEW_HEADLINES.backCheckers]: 'escaping',
};

/** For anything a headline doesn't settle (older saves, cube decisions). */
const SKILL_OF_CATEGORY: Record<MistakeCategory, SkillId> = {
  opening: 'openings',
  hitting: 'hitting',
  positioning: 'points',
  running: 'escaping',
  racing: 'racing',
  'bearing-off': 'bear-off',
  cube: 'cube',
  risk: 'safety',
};

/** The skill a reviewed move (or a saved mistake) belongs to. A first move is about the opening book. */
export function skillOfMistake(mistake: { category: MistakeCategory; headline: string }): SkillId {
  if (mistake.category === 'opening') return 'openings';
  return SKILL_OF_HEADLINE[mistake.headline] ?? SKILL_OF_CATEGORY[mistake.category] ?? 'points';
}

/** The skill a drill category trains. */
export function skillOfDrill(drill: DrillCategory): SkillId {
  return DRILL_CATEGORIES.find((info) => info.id === drill)?.skill ?? 'points';
}

export interface SkillTraining {
  /** A drill that practises the skill, if there is one. */
  drill?: DrillCategory;
  /** The lesson that teaches it best: its first lesson as the main skill, else where it's introduced. */
  lesson?: Lesson;
}

/** Where a skill is practised and taught: a drill made for it first, else one that also trains it. */
export function trainingFor(skill: SkillId): SkillTraining {
  const drill =
    DRILL_CATEGORIES.find((info) => info.skill === skill) ?? DRILL_CATEGORIES.find((info) => info.alsoTrains?.includes(skill));
  return { drill: drill?.id, lesson: lessonsForSkill(skill)[0] ?? introducingLesson(skill) };
}
