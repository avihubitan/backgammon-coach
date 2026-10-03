import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useBoardPalette } from '@/components/board/palette';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

interface PlayerRowProps {
  name: string;
  light: boolean;
  pips: number;
  borneOff: number;
  score?: number | null;
  active: boolean;
  thinking?: boolean;
  ownsCube?: number | null;
}

export function PlayerRow({ name, light, pips, borneOff, score, active, thinking, ownsCube }: PlayerRowProps) {
  const palette = useBoardPalette();
  return (
    <View style={styles.row} accessibilityLabel={`${name}: ${pips} pips, ${borneOff} borne off`}>
      <View
        style={[
          styles.chip,
          { backgroundColor: light ? palette.lightCheckerFace : palette.darkCheckerFace },
          active && styles.chipActive,
        ]}
      />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <AppText variant="subheading" color={active ? 'text' : 'textSecondary'}>
            {name}
          </AppText>
          {thinking ? (
            <Animated.View
              style={{
                animationName: { from: { opacity: 0.3 }, to: { opacity: 1 } },
                animationDuration: 600,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
              }}
            >
              <AppText variant="caption" color="primary">
                thinking…
              </AppText>
            </Animated.View>
          ) : null}
        </View>
        <AppText variant="caption" color="textMuted">
          {pips} pips{borneOff > 0 ? ` · ${borneOff} off` : ''}
        </AppText>
      </View>
      {ownsCube ? (
        <View style={styles.cube}>
          <AppText variant="caption" color="textInverse">
            {ownsCube}
          </AppText>
        </View>
      ) : null}
      {score !== null && score !== undefined ? (
        <View style={styles.score}>
          <AppText variant="number">{score}</AppText>
        </View>
      ) : null}
      {active && !thinking ? <Icon name="circle-small" size={28} color={colors.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: SCREEN_GUTTER,
    paddingVertical: spacing.sm,
  },
  chip: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  chipActive: { borderColor: colors.primary },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cube: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F6EFDF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    minWidth: 36,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
