import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BoardArt } from '@/components/board/BoardArt';
import { CheckerFace } from '@/components/board/Checker';
import { checkerCenterOnPoint, computeMetrics } from '@/components/board/geometry';
import { BoardPaletteContext } from '@/components/board/palette';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics } from '@/services/analytics';
import { haptics } from '@/services/haptics';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, radii, spacing } from '@/theme';
import { BOARD_THEMES, type BoardTheme } from '@/theme/boardThemes';

/** A few checkers in their starting spots: enough to show the style. */
const PREVIEW_STACKS: { point: number; count: number; player: 'player1' | 'player2' }[] = [
  { point: 13, count: 3, player: 'player1' },
  { point: 6, count: 3, player: 'player1' },
  { point: 8, count: 2, player: 'player1' },
  { point: 12, count: 3, player: 'player2' },
  { point: 19, count: 3, player: 'player2' },
  { point: 17, count: 2, player: 'player2' },
];

function Preview({ theme, width }: { theme: BoardTheme; width: number }) {
  const m = computeMetrics(width);
  return (
    <BoardPaletteContext.Provider value={theme.palette}>
      <View style={{ width: m.width, height: m.height }}>
        <BoardArt metrics={m} />
        {PREVIEW_STACKS.flatMap(({ point, count, player }) =>
          Array.from({ length: count }, (_, index) => {
            const c = checkerCenterOnPoint(m, point, index, count);
            return (
              <View
                key={`${point}-${index}`}
                style={[styles.abs, { left: c.x - m.checker / 2, top: c.y - m.checker / 2, pointerEvents: 'none' }]}
              >
                <CheckerFace player={player} size={m.checker} />
              </View>
            );
          }),
        )}
      </View>
    </BoardPaletteContext.Provider>
  );
}

/** Board styles: purely cosmetic, two free and two with Premium. */
export function BoardStylePicker({ previewWidth }: { previewWidth: number }) {
  const chosen = useSettingsStore((state) => state.boardTheme);
  const update = useSettingsStore((state) => state.update);
  const access = useFeatureAccess();

  return (
    <View style={styles.grid} testID="board-styles">
      {BOARD_THEMES.map((theme) => {
        const allowed = access.canUseBoardTheme(theme.id);
        const selected = chosen === theme.id && allowed;
        return (
          <Pressable
            key={theme.id}
            testID={`board-style-${theme.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !allowed }}
            accessibilityLabel={`${theme.name} board${allowed ? '' : ', Premium'}`}
            onPress={() => {
              haptics.tap();
              if (!allowed) {
                router.push({ pathname: '/paywall', params: { source: 'board_style' } });
                return;
              }
              update({ boardTheme: theme.id });
              analytics.track('board_style_selected', { style: theme.id });
            }}
            style={[styles.cell, selected && styles.cellSelected]}
          >
            <View style={[styles.preview, !allowed && styles.previewLocked]}>
              <Preview theme={theme} width={previewWidth} />
            </View>
            <View style={styles.caption}>
              <View style={styles.flex}>
                <AppText variant="smallStrong">{theme.name}</AppText>
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {theme.description}
                </AppText>
              </View>
              {selected ? (
                <Icon name="check-circle" size={20} color={colors.success} />
              ) : !allowed ? (
                <Icon name="crown" size={18} color={colors.star} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '48.5%',
    flexGrow: 1,
    padding: spacing.sm,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cellSelected: { borderColor: colors.success },
  preview: { alignItems: 'center', borderRadius: radii.sm, overflow: 'hidden' },
  previewLocked: { opacity: 0.75 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
