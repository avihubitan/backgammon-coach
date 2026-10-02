import { boardSection } from './sections/section1-board';
import { movingSection } from './sections/section2-moving';
import { hittingSection } from './sections/section3-hitting';
import { pointsSection } from './sections/section4-points';
import { positionSection } from './sections/section5-position';
import { bearingOffSection } from './sections/section6-bearing-off';
import { winningSection } from './sections/section7-winning';
import type { Lesson, Section } from './types';

export * from './types';

/** Sections in learning order. Lessons unlock one after another across sections. */
export const curriculum: Section[] = [
  boardSection,
  movingSection,
  hittingSection,
  pointsSection,
  positionSection,
  bearingOffSection,
  winningSection,
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
