import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { GameStats } from '@/features/gameplay/gameModel';
import { categoryLabel, type AiLevel } from '@/game';
import { colors, radii, spacing } from '@/theme';

import type { CoachSummary } from '../profileStats';

const LEVELS: { id: AiLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

/** Results against the computer, plus what the coach found in your games. */
export function GamesCard({ stats, coach }: { stats: GameStats; coach: CoachSummary | null }) {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  return (
    <Card style={styles.card} testID="games-card">
      <View style={styles.tiles}>
        <Tile value={stats.gamesPlayed} label="Played" />
        <Tile value={stats.gamesWon} label="Won" />
        <Tile value={`${winRate}%`} label="Win rate" />
        <Tile value={stats.gammonsWon} label="Gammons" />
      </View>

      <View style={styles.levels}>
        {LEVELS.filter((level) => (stats.playedByLevel[level.id] ?? 0) > 0).map((level) => {
          const played = stats.playedByLevel[level.id] ?? 0;
          const won = stats.winsByLevel[level.id] ?? 0;
          return (
            <View key={level.id} style={styles.levelRow}>
              <AppText variant="smallStrong" style={styles.flex}>
                vs {level.label}
              </AppText>
              <View style={styles.record}>
                {Array.from({ length: Math.min(played, 10) }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.dot, { backgroundColor: index < Math.min(won, 10) ? colors.success : colors.surfaceRaised }]}
                  />
                ))}
              </View>
              <AppText variant="caption" color="textSecondary" style={styles.score}>
                {won}–{played - won}
              </AppText>
            </View>
          );
        })}
      </View>

      {coach && coach.found > 0 ? (
        <View style={styles.coach} testID="coach-summary">
          <Icon name="school" size={22} color="info" />
          <View style={styles.flex}>
            <AppText variant="smallStrong">
              Coach found {coach.found} mistake{coach.found === 1 ? '' : 's'} · {coach.fixed} fixed
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {coach.common ? `Most common: ${categoryLabel(coach.common).toLowerCase()}.` : 'No single weak spot yet.'}
            </AppText>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.tile} accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
  },
  levels: { gap: spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  record: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  score: { minWidth: 34, textAlign: 'right' },
  coach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.infoSoft,
  },
});
