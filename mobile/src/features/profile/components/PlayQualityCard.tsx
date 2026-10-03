import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { qualityBand, trendMessage, type QualityTrend } from '@/features/coach/playQuality';
import { BAND_COLOR } from '@/features/coach/qualityStyle';
import { haptics } from '@/services/haptics';
import { colors, radii, spacing } from '@/theme';

const CHART_HEIGHT = 72;

/**
 * Move quality game by game: is your play getting closer to the coach's?
 * Everyone sees their latest score; the trend comes with Premium.
 */
export function PlayQualityCard({ trend, pending, premium }: { trend: QualityTrend; pending: number; premium: boolean }) {
  if (trend.latest === null) {
    return (
      <Card style={styles.card} testID="play-quality">
        <AppText variant="label" color="textSecondary">
          Move quality
        </AppText>
        {pending > 0 ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <AppText variant="small" color="textSecondary" style={styles.flex}>
              Your coach is reviewing your recent games…
            </AppText>
          </View>
        ) : (
          <AppText variant="small" color="textSecondary">
            Finish a full game and your coach scores how close your moves came to the best ones.
          </AppText>
        )}
      </Card>
    );
  }

  const band = qualityBand(trend.latest);
  const change = trend.compare?.change ?? null;
  const message = premium ? trendMessage(trend) : null;

  return (
    <Card style={styles.card} testID="play-quality">
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="label" color="textSecondary">
            Move quality{premium ? '' : ' · last game'}
          </AppText>
          <View style={styles.score} accessibilityLabel={`Move quality ${trend.latest}, ${band.label}`}>
            <AppText variant="title">{trend.latest}</AppText>
            <AppText variant="smallStrong" color={BAND_COLOR[band.band]}>
              {band.label}
            </AppText>
          </View>
          {premium && trend.best !== null && trend.points.length > 1 ? (
            <AppText variant="caption" color="textSecondary">
              Your best: {trend.best}
            </AppText>
          ) : null}
        </View>
        {premium && change !== null ? <ChangePill change={change} /> : null}
      </View>

      {premium ? (
        <>
          <View
            style={styles.chart}
            accessibilityLabel={`Move quality in your last ${trend.points.length} games: ${trend.points.map((point) => point.quality).join(', ')}`}
          >
            {trend.points.map((point, index) => {
              const latest = index === trend.points.length - 1;
              const height = Math.max(4, (point.quality / 100) * CHART_HEIGHT);
              return (
                <View key={point.id} style={styles.column}>
                  <AppText variant="caption" color={latest ? 'primary' : 'textMuted'} style={styles.value}>
                    {point.quality}
                  </AppText>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor: latest ? colors.primary : colors.info,
                        opacity: latest ? 1 : 0.7,
                        animationName: { from: { height: 0 }, to: { height } },
                        animationDuration: 480,
                        animationDelay: 100 + index * 45,
                        animationTimingFunction: 'ease-out',
                        animationFillMode: 'backwards',
                      },
                    ]}
                  />
                  <View style={[styles.result, { backgroundColor: point.won ? colors.success : colors.surfaceRaised }]} />
                </View>
              );
            })}
            {Array.from({ length: Math.max(0, 5 - trend.points.length) }, (_, index) => (
              <View key={`empty-${index}`} style={styles.column}>
                <View style={[styles.bar, styles.emptyBar]} />
                <View style={styles.result} />
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            <AppText variant="caption" color="textMuted">
              Older
            </AppText>
            <AppText variant="caption" color="textMuted">
              Latest
            </AppText>
          </View>
          {message ? (
            <AppText variant="small" color="text" testID="play-quality-trend">
              {message}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            100 means every move matched the coach’s choice. Green dots mark the games you won.
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="small" color="textSecondary">
            How close your moves came to the coach’s choice. 100 means you matched it every time.
          </AppText>
          <Pressable
            testID="play-quality-upgrade"
            accessibilityRole="button"
            onPress={() => {
              haptics.tap();
              router.push({ pathname: '/paywall', params: { source: 'play_stats' } });
            }}
            style={({ pressed }) => [styles.teaser, pressed && styles.teaserPressed]}
          >
            <Icon name="chart-line" size={20} color={colors.info} />
            <AppText variant="smallStrong" style={styles.flex}>
              See your trend, game by game
            </AppText>
            <Icon name="crown" size={16} color={colors.star} />
            <AppText variant="caption" color="star">
              Premium
            </AppText>
          </Pressable>
        </>
      )}
    </Card>
  );
}

function ChangePill({ change }: { change: number }) {
  const up = change >= 3;
  const down = change <= -3;
  const tone = up ? colors.success : down ? colors.streak : colors.textSecondary;
  return (
    <View
      style={[styles.pill, { backgroundColor: up ? colors.successSoft : down ? 'rgba(255, 138, 61, 0.14)' : colors.surfaceRaised }]}
      accessibilityLabel={up ? `Up ${change} points` : down ? `Down ${-change} points` : 'About the same'}
    >
      <Icon name={up ? 'trending-up' : down ? 'trending-down' : 'trending-neutral'} size={16} color={tone} />
      <AppText variant="smallStrong" color={tone}>
        {up ? `+${change}` : down ? `${change}` : 'Steady'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  chart: { height: CHART_HEIGHT + 30, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  value: { fontSize: 10, lineHeight: 14 },
  bar: { width: '100%', maxWidth: 26, borderRadius: radii.sm },
  emptyBar: { height: 4, backgroundColor: colors.surfaceRaised },
  result: { width: 6, height: 6, borderRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teaserPressed: { backgroundColor: colors.surfacePressed },
});
