import { boardSection } from './sections/section1-board';
import { movingSection } from './sections/section2-moving';
import { hittingSection } from './sections/section3-hitting';
import { pointsSection } from './sections/section4-points';
import { positionSection } from './sections/section5-position';
import { bearingOffSection } from './sections/section6-bearing-off';
import { winningSection } from './sections/section7-winning';
import { openingsSection } from './sections/section8-openings';
import { middleGameSection } from './sections/section9-middle-game';
import { racingSection } from './sections/section10-racing';
import { cubeSection } from './sections/section11-cube';
import { advancedSection } from './sections/section12-advanced';
import type { SkillId } from './skills';
import type { Lesson, LessonStep, Section } from './types';

export * from './types';
export * from './skills';

/** Sections in learning order. Lessons unlock one after another across sections. */
export const curriculum: Section[] = [
  boardSection,
  movingSection,
  hittingSection,
  pointsSection,
  positionSection,
  bearingOffSection,
  winningSection,
  openingsSection,
  middleGameSection,
  racingSection,
  cubeSection,
  advancedSection,
];

export const allLessons: Lesson[] = curriculum.flatMap((section) => section.lessons);

const lessonById = new Map(allLessons.map((lesson) => [lesson.id, lesson]));
const sectionById = new Map(curriculum.map((section) => [section.id, section]));

export function getLesson(id: string): Lesson | undefined {
  return lessonById.get(id);
}

export function getSection(id: string): Section | undefined {
  return sectionById.get(id);
}

export function lessonIndex(id: string): number {
  return allLessons.findIndex((lesson) => lesson.id === id);
}

export function sectionOfLesson(id: string): Section | undefined {
  const lesson = getLesson(id);
  return lesson ? getSection(lesson.sectionId) : undefined;
}

/** 1-based position of a section on the learning path. */
export function sectionNumber(id: string): number {
  return curriculum.findIndex((section) => section.id === id) + 1;
}

/** Every skill a lesson trains: its own first, then the others its steps name. */
export function lessonSkills(lesson: Lesson): SkillId[] {
  return [lesson.skill, ...(lesson.alsoTrains ?? [])];
}

/** The skill a scored step counts toward. */
export function stepSkill(lesson: Pick<Lesson, 'skill'>, step: LessonStep): SkillId {
  return step.skill ?? lesson.skill;
}

/** The first lesson on the path that trains `skill`: where it is introduced. */
export function introducingLesson(skill: SkillId): Lesson | undefined {
  return allLessons.find((lesson) => lessonSkills(lesson).includes(skill));
}

/** The lessons that train `skill` as their main skill, in path order. */
export function lessonsForSkill(skill: SkillId): Lesson[] {
  return allLessons.filter((lesson) => lesson.skill === skill);
}
