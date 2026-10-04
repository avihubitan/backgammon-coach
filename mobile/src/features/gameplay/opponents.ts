import type { IconName } from '@/components/ui/Icon';
import type { AiLevel } from '@/game';
import { colors } from '@/theme';

/**
 * The computer at each level, presented as an opponent rather than an
 * algorithm: a name, a face and a temperament. Presentation only: the
 * level alone decides how it plays.
 */
export interface Opponent {
  level: AiLevel;
  name: string;
  /** The level, as players see it. */
  title: string;
  icon: IconName;
  color: string;
  /** One line for the Play tab. */
  description: string;
}

export const OPPONENTS: Record<AiLevel, Opponent> = {
  beginner: {
    level: 'beginner',
    name: 'Niko',
    title: 'Beginner',
    icon: 'sprout',
    color: colors.success,
    description: 'Friendly and relaxed. Plays sensibly but makes understandable mistakes.',
  },
  intermediate: {
    level: 'intermediate',
    name: 'Leyla',
    title: 'Intermediate',
    icon: 'chess-knight',
    color: colors.info,
    description: 'Confident, with solid strategy. A fair fight.',
  },
  advanced: {
    level: 'advanced',
    name: 'Viktor',
    title: 'Advanced',
    icon: 'crown',
    color: colors.primary,
    description: 'Calm and exact: a neural network trained on 300,000 games. A real challenge.',
  },
};

export const opponentFor = (level: AiLevel): Opponent => OPPONENTS[level] ?? OPPONENTS.beginner;
