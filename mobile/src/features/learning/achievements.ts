import type { IconName } from '@/components/ui/Icon';
import { curriculum } from '@/curriculum';

import type { ProgressData } from './progressModel';

export interface GameAchievementStats {
  gamesPlayed: number;
  gamesWon: number;
  gammonsWon: number;
  winsByLevel: Partial<Record<'beginner' | 'intermediate' | 'advanced', number>>;
}

export interface AchievementContext {
  progress: ProgressData;
  games?: GameAchievementStats;
  /** Daily challenges completed recently (the store keeps about two months). */
  challengesCompleted?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  isUnlocked: (context: AchievementContext) => boolean;
}

const completedCount = (progress: ProgressData) =>
  Object.values(progress.lessons).filter((record) => record.completed).length;

const masteredCount = (progress: ProgressData) =>
  Object.values(progress.lessons).filter((record) => record.bestStars === 3).length;

const sectionDone = (progress: ProgressData, sectionId: string) => {
  const section = curriculum.find((candidate) => candidate.id === sectionId);
  return !!section && section.lessons.length > 0 && section.lessons.every((lesson) => progress.lessons[lesson.id]?.completed);
};

/**
 * Achievements only ever reflect things the learner really did; each check
 * reads recorded progress or game results.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first lesson.',
    icon: 'shoe-print',
    isUnlocked: ({ progress }) => completedCount(progress) >= 1,
  },
  {
    id: 'board-explorer',
    title: 'Board Explorer',
    description: 'Finish the “Meet the Board” section.',
    icon: 'map-check',
    isUnlocked: ({ progress }) => sectionDone(progress, 'board'),
  },
  {
    id: 'graduate',
    title: 'Graduate',
    description: 'Finish the beginner course.',
    icon: 'certificate',
    isUnlocked: ({ progress }) => sectionDone(progress, 'winning'),
  },
  {
    id: 'opening-book',
    title: 'Opening Book',
    description: 'Finish the “Opening Moves” section.',
    icon: 'book-open-page-variant',
    isUnlocked: ({ progress }) => sectionDone(progress, 'openings'),
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Earn three stars on a lesson.',
    icon: 'star-shooting',
    isUnlocked: ({ progress }) => masteredCount(progress) >= 1,
  },
  {
    id: 'high-achiever',
    title: 'High Achiever',
    description: 'Master five lessons with three stars.',
    icon: 'star-circle',
    isUnlocked: ({ progress }) => masteredCount(progress) >= 5,
  },
  {
    id: 'on-fire',
    title: 'On Fire',
    description: 'Learn three days in a row.',
    icon: 'fire',
    isUnlocked: ({ progress }) => progress.streak.longest >= 3,
  },
  {
    id: 'dedicated',
    title: 'Dedicated',
    description: 'Keep a seven-day streak.',
    icon: 'calendar-check',
    isUnlocked: ({ progress }) => progress.streak.longest >= 7,
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Earn 100 XP.',
    icon: 'lightning-bolt',
    isUnlocked: ({ progress }) => progress.xp >= 100,
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Earn 500 XP.',
    icon: 'school',
    isUnlocked: ({ progress }) => progress.xp >= 500,
  },
  {
    id: 'sharp-eye',
    title: 'Sharp Eye',
    description: 'Get 50 lesson exercises right on the first try.',
    icon: 'eye-check-outline',
    isUnlocked: ({ progress }) => progress.stats.exercisesFirstTry >= 50,
  },
  {
    id: 'drill-sergeant',
    title: 'Drill Sergeant',
    description: 'Finish 5 practice sessions.',
    icon: 'whistle',
    isUnlocked: ({ progress }) => progress.stats.practiceSessions >= 5,
  },
  {
    id: 'challenger',
    title: 'Challenger',
    description: 'Complete 5 daily challenges.',
    icon: 'calendar-star',
    isUnlocked: ({ challengesCompleted }) => (challengesCompleted ?? 0) >= 5,
  },
  {
    id: 'first-win',
    title: 'First Victory',
    description: 'Win a game against the computer.',
    icon: 'trophy',
    isUnlocked: ({ games }) => (games?.gamesWon ?? 0) >= 1,
  },
  {
    id: 'gammon',
    title: 'Gammon!',
    description: 'Win a gammon: bear off before your opponent bears off any.',
    icon: 'trophy-award',
    isUnlocked: ({ games }) => (games?.gammonsWon ?? 0) >= 1,
  },
  {
    id: 'giant-slayer',
    title: 'Giant Slayer',
    description: 'Beat the Advanced computer.',
    icon: 'sword-cross',
    isUnlocked: ({ games }) => (games?.winsByLevel?.advanced ?? 0) >= 1,
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
