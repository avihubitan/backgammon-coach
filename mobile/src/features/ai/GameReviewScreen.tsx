import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { applyPlay, formatPlay, type BoardState } from '@/game';
import { useGameStore } from '@/state/gameStore';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';

/** Step through a finished game turn by turn. */
export function GameReviewScreen({ gameId }: { gameId: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGameStore((store) => store.finished.find((entry) => entry.id === gameId));
  const turns = (game?.history ?? []).filter((record) => !record.cubeAction);
  const [index, setIndex] = useState(0);

  if (!game || turns.length === 0) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="title">Game not found</AppText>
        <Button label="Back" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  const record = turns[Math.min(index, turns.length - 1)];
  const after: BoardState = applyPlay(record.boardBefore, record.player, record.moves);
  const mover = record.player === 'player1' ? 'You' : 'Computer';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => router.back()} />
        <AppText variant="subheading" style={styles.title}>
          Game review
        </AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.board}>
          <BackgammonBoard
            board={after}
            width={Math.min(width, MAX_CONTENT_WIDTH)}
            layoutKey={`review-${index}`}
            dice={record.roll ? { values: record.roll, player: record.player } : null}
            arrows={record.moves.map((move) => ({
              from: move.from,
              to: move.to,
              player: record.player,
              tone: record.player === 'player1' ? 'hint' : 'info',
            }))}
          />
        </View>
        <View style={styles.caption}>
          <AppText variant="label" color="textSecondary">
            Turn {index + 1} of {turns.length}
          </AppText>
          <AppText variant="heading">
            {mover} rolled {record.roll?.join('-')}: {formatPlay(record.player, record.moves)}
          </AppText>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Previous" icon="chevron-left" variant="secondary" disabled={index === 0} onPress={() => setIndex(index - 1)} />
          </View>
          <View style={styles.flex}>
            <Button label="Next" iconRight="chevron-right" disabled={index >= turns.length - 1} onPress={() => setIndex(index + 1)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 56 },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  content: { gap: spacing.lg, paddingBottom: spacing.huge, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  board: { alignItems: 'center' },
  caption: { paddingHorizontal: SCREEN_GUTTER, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: SCREEN_GUTTER },
  flex: { flex: 1 },
});
