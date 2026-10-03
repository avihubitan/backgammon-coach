import type { IconName } from '@/components/ui/Icon';
import { colors } from '@/theme';

import type { Reward } from './progressModel';

/** What completion screens say about streak freezes earned or spent with this reward. */
export function freezeLines(reward: Pick<Reward, 'freezesUsed' | 'freezeEarned'>): { icon: IconName; color: string; text: string }[] {
  const lines: { icon: IconName; color: string; text: string }[] = [];
  if (reward.freezesUsed > 0) {
    lines.push({
      icon: 'snowflake-check',
      color: colors.info,
      text: reward.freezesUsed === 1 ? 'A streak freeze saved your streak' : `${reward.freezesUsed} streak freezes saved your streak`,
    });
  }
  if (reward.freezeEarned) lines.push({ icon: 'snowflake', color: colors.info, text: 'Streak freeze earned!' });
  return lines;
}
