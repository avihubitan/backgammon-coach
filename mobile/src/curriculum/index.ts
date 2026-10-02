import { boardSection } from './sections/section1-board';
import type { Lesson, Section } from './types';

export * from './types';

/** Sections in learning order. Lessons unlock one after another across sections. */
export const curriculum: Section[] = [boardSection];

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
