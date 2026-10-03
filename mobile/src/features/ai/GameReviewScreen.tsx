import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import {
  categoryLabel,
  formatPlay,
  moveOutcome,
  reviewGame,
  type MoveReview,
  type Severity,
} from '@/game';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardArrow } from '@/types/board';
import { analytics } from '@/services/analytics';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useEntitlementsStore } from '@/state/entitlementsStore';
import { todayKey } from '@/state/progressStore';

/** Explanations that already compare the two moves' shots. */
const SAFETY_HEADLINES = new Set(['You had a safer option', 'A slightly safer play existed']);

const percent = (chance: number) => `${Math.round(chance * 100)}%`;

export const SEVERITY_STYLE: Record<Severity, { label: string; color: string }> = {
  best: { label: 'Best', color: colors.success },
  fine: { label: 'Good', color: '#8FDDB4' },
  inaccuracy: { label: 'Inaccuracy', color: colors.primary },
  mistake: { label: 'Mistake', color: colors.streak },
  blunder: { label: 'Blunder', color: colors.danger },
};

/** The AI coach: what went well, the biggest lessons, and every move explained. */
export function GameReviewScreen({
  gameId,
  source = 'game_result',
}: {
  gameId: string;
  source?: 'game_result' | 'history';
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const game = useGameStore((store) => store.finished.find((entry) => entry.id === gameId));
  const saveReview = useGameStore((store) => store.saveReview);
  const addMistakes = useMistakesStore((store) => store.addFromReview);
  // Usually saved by the background review before this screen opens.
  const saved = useMistakesStore((store) => store.mistakes.filter((mistake) => mistake.gameId === gameId).length);
  const technicalSetting = useSettingsStore((store) => store.showTechnicalStats);
  const access = useFeatureAccess();
  const unlockReview = useEntitlementsStore((store) => store.unlockReview);
  const premiumCoach = access.canUseAiCoach();
  // Free players get one full review a day; others see the summary and the biggest lesson.
  const fullReview = access.canReviewGame(gameId);
  const technical = technicalSetting && access.canAnalyzeGame();
  const [selected, setSelected] = useState<number | null>(null);
  const [showBest, setShowBest] = useState(true);
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const review = game?.review;

  const reviewed = !!review;
  useEffect(() => {
    if (reviewed && fullReview && !premiumCoach) unlockReview(gameId, todayKey());
  }, [reviewed, fullReview, premiumCoach, unlockReview, gameId]);

  const mistakeCount = review ? review.moves.filter((move) => move.severity === 'mistake' || move.severity === 'blunder').length : 0;
  useEffect(() => {
    if (reviewed) analytics.track('coach_opened', { source, mistakes: mistakeCount });
    // Once, as soon as the review is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewed]);

  // Analyse once, after the first paint so the "analysing" state is visible.
  useEffect(() => {
    if (!game || game.review) return;
    const timer = setTimeout(() => {
      const result = reviewGame(game.history, 'player1');
      saveReview(game.id, result);
      addMistakes(game.id, result);
    }, 60);
    return () => clearTimeout(timer);
  }, [game, saveReview, addMistakes]);

  if (!game) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="title">Game not found</AppText>
        <Button label="Back" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  const header = (
    <View style={styles.topBar}>
      <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/play'))} />
      <AppText variant="subheading" style={styles.title}>
        Coach review
      </AppText>
      <View style={styles.spacer} />
    </View>
  );

  if (!review) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="bodyStrong" color="textSecondary">
            Your coach is reviewing every move…
          </AppText>
        </View>
      </View>
    );
  }

  const moves = review.moves.filter((move) => !onlyMistakes || ['inaccuracy', 'mistake', 'blunder'].includes(move.severity));
  const current: MoveReview | undefined =
    (fullReview ? review.moves.find((move) => move.index === selected) : undefined) ??
    review.moves.find((move) => move.index === review.summary.biggest) ??
    review.moves[0];
  const { summary } = review;
  const worst = review.moves.find((move) => move.index === summary.biggest);
  const boardWidth = Math.min(width, MAX_CONTENT_WIDTH);

  const arrows: BoardArrow[] = current
    ? (showBest ? current.best : current.played).map((move) => ({
        from: move.from,
        to: move.to,
        tone: showBest ? 'hint' : current.severity === 'best' || current.severity === 'fine' ? 'info' : 'wrong',
      }))
    : [];

  const position = (current ? review.moves.indexOf(current) : 0) + 1;
  // What each move leads to (only worked out for the move on screen).
  const outcome = current && current.severity !== 'best' && current.severity !== 'fine' ? moveOutcome(current) : null;
  // The shots line, unless the explanation already compares them.
  const showShots =
    !!outcome &&
    outcome.shots.played > outcome.shots.best &&
    outcome.shots.played >= 4 &&
    !SAFETY_HEADLINES.has(current?.headline ?? '');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.huge }]}>
        {fullReview && !premiumCoach ? (
          <Pressable
            testID="free-review-banner"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/paywall', params: { source: 'coach_review' } })}
            style={styles.freeBanner}
          >
            <Icon name="gift-outline" size={18} color={colors.primary} />
            <AppText variant="small" color="textSecondary" style={styles.flex}>
              Today’s free full review. <AppText variant="smallStrong" color="primary">Premium</AppText> reviews every game.
            </AppText>
          </Pressable>
        ) : null}
        <Card style={styles.summary} testID="review-summary">
          <View style={styles.summaryTop}>
            <View style={[styles.resultBadge, { backgroundColor: game.playerWon ? colors.success : colors.danger }]}>
              <Icon name={game.playerWon ? 'trophy' : 'flag'} size={22} color="textInverse" />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading">{game.playerWon ? 'You won' : 'You lost'}</AppText>
              <AppText variant="small" color="textSecondary">
                {game.result.type === 'single' ? 'Single game' : game.result.type === 'gammon' ? 'Gammon' : 'Backgammon'} vs{' '}
                {game.level} computer
              </AppText>
            </View>
          </View>
          <View style={styles.statRow}>
            <Stat value={`${summary.bestMoves}/${summary.movesReviewed}`} label="Strong moves" color={colors.success} />
            <Stat value={summary.inaccuracies} label="Inaccuracies" color={colors.primary} />
            <Stat value={summary.mistakes + summary.blunders} label="Mistakes" color={colors.danger} />
          </View>
          {worst ? (
            <Pressable
              onPress={() => setSelected(worst.index)}
              style={styles.lesson}
              accessibilityRole="button"
              accessibilityLabel="Show your biggest lesson"
            >
              <Icon name="lightbulb-on-outline" size={20} color={colors.primary} />
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  BIGGEST LESSON
                </AppText>
                <AppText variant="bodyStrong">{worst.headline}</AppText>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ) : (
            <AppText variant="bodyStrong" color="success">
              No serious mistakes this game. Great discipline!
            </AppText>
          )}
          {summary.focus ? (
            <AppText variant="small" color="textSecondary">
              Area to improve: <AppText variant="smallStrong">{categoryLabel(summary.focus)}</AppText>
              {saved > 0 ? ` · ${saved} position${saved === 1 ? '' : 's'} saved to “My mistakes”` : ''}
            </AppText>
          ) : null}
          {review.cube.map((decision) => (
            <View key={decision.index} style={styles.cubeRow}>
              <Icon name={decision.correct ? 'check-circle' : 'alert-circle'} size={18} color={decision.correct ? colors.success : colors.danger} />
              <AppText variant="small" style={styles.flex}>
                <AppText variant="smallStrong">{decision.headline}. </AppText>
                {decision.explanation}
              </AppText>
            </View>
          ))}
        </Card>

        {current ? (
          <>
            <View style={styles.boardWrap}>
              <BackgammonBoard
                board={current.boardBefore}
                width={boardWidth}
                layoutKey={`r-${current.index}`}
                dice={{ values: current.roll, player: 'player1' }}
                arrows={arrows}
              />
            </View>
            <Card style={styles.detail} testID="move-detail">
              <View style={styles.detailTop}>
                <AppText variant="label" color="textSecondary" style={styles.flex}>
                  Your move {position} of {review.moves.length} · rolled {current.roll.join('-')}
                </AppText>
                <SeverityBadge severity={current.severity} />
              </View>
              <AppText variant="heading">{current.headline}</AppText>
              <AppText variant="body" color="textSecondary">
                {current.explanation}
              </AppText>
              {outcome && (showShots || access.canAnalyzeGame()) ? (
                <View style={styles.outcomes} testID="review-outcome">
                  {showShots ? (
                    <View style={styles.outcomeRow}>
                      <Icon name="target" size={16} color={colors.streak} />
                      <AppText variant="small" color="textSecondary" style={styles.flex}>
                        Your move: hit by {outcome.shots.played} of 36 rolls · the coach’s: {outcome.shots.best}
                      </AppText>
                    </View>
                  ) : null}
                  {access.canAnalyzeGame() ? (
                    <View style={styles.outcomeRow}>
                      <Icon name="chart-line" size={16} color={colors.info} />
                      <AppText variant="small" color="textSecondary" style={styles.flex}>
                        Winning chances: {percent(outcome.winChance.played)} after your move ·{' '}
                        {percent(outcome.winChance.best)} after the coach’s
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.toggleRow}>
                <ToggleChip active={!showBest} label={`You: ${formatPlay('player1', current.played)}`} onPress={() => setShowBest(false)} />
                <ToggleChip active={showBest} label={`Best: ${formatPlay('player1', current.best)}`} onPress={() => setShowBest(true)} />
              </View>
              {fullReview && (current.severity === 'mistake' || current.severity === 'blunder') ? (
                <Button
                  testID="review-practise-position"
                  label="Practise this position"
                  icon={access.canUseAdvancedTraining() ? 'target' : 'crown'}
                  variant="secondary"
                  size="medium"
                  onPress={() =>
                    access.canUseAdvancedTraining()
                      ? router.push({ pathname: '/practice/[kind]', params: { kind: 'mistakes', focus: `${game.id}:${current.index}` } })
                      : router.push({ pathname: '/paywall', params: { source: 'mistakes' } })
                  }
                />
              ) : null}
              {technical ? (
                <AppText variant="caption" color="textMuted">
                  Equity: yours {current.playedEquity.toFixed(3)} · best {current.bestEquity.toFixed(3)} · loss{' '}
                  {current.loss.toFixed(3)} · rank {current.rank}/{current.alternatives}
                </AppText>
              ) : null}
              {fullReview ? (
              <View style={styles.navRow}>
                <View style={styles.flex}>
                  <Button
                    label="Previous"
                    icon="chevron-left"
                    variant="secondary"
                    size="medium"
                    disabled={position <= 1}
                    onPress={() => setSelected(review.moves[position - 2].index)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Next"
                    iconRight="chevron-right"
                    size="medium"
                    disabled={position >= review.moves.length}
                    onPress={() => setSelected(review.moves[position].index)}
                  />
                </View>
              </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {!fullReview ? (
          <Card style={styles.locked} testID="review-locked">
            <View style={styles.lockedIcon}>
              <Icon name="crown" size={26} color="textInverse" />
            </View>
            <AppText variant="heading" align="center">
              See every move explained
            </AppText>
            <AppText variant="small" color="textSecondary" align="center">
              You’ve used today’s free full review. Premium reviews every game move by move, or come back tomorrow for
              your next free one.
            </AppText>
            <Button
              testID="review-unlock"
              label="See Premium"
              icon="crown"
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'coach_review' } })}
            />
          </Card>
        ) : (
        <>
        <View style={styles.listHeader}>
          <AppText variant="label" color="textSecondary" style={styles.flex}>
            All your moves
          </AppText>
          <Pressable onPress={() => setOnlyMistakes((value) => !value)} accessibilityRole="switch" accessibilityState={{ checked: onlyMistakes }}>
            <AppText variant="smallStrong" color="primary">
              {onlyMistakes ? 'Show all' : 'Only mistakes'}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.list}>
          {moves.map((move) => (
            <Pressable
              key={move.index}
              testID={`review-move-${move.index}`}
              onPress={() => {
                setSelected(move.index);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={[styles.moveRow, current?.index === move.index && styles.moveRowActive]}
            >
              <View style={[styles.dot, { backgroundColor: SEVERITY_STYLE[move.severity].color }]} />
              <AppText variant="smallStrong" style={styles.dice}>
                {move.roll.join('-')}
              </AppText>
              <AppText variant="small" style={styles.flex} numberOfLines={1}>
                {formatPlay('player1', move.played)}
              </AppText>
              <AppText variant="caption" color={SEVERITY_STYLE[move.severity].color}>
                {SEVERITY_STYLE[move.severity].label}
              </AppText>
            </Pressable>
          ))}
          {moves.length === 0 ? (
            <AppText variant="small" color="textSecondary">
              Nothing to show here. Well played!
            </AppText>
          ) : null}
        </View>

        </>
        )}

        {summary.mistakes + summary.blunders > 0 ? (
          <Button
            label="Practice my mistakes"
            icon={access.canUseAdvancedTraining() ? 'target' : 'crown'}
            variant={fullReview ? 'primary' : 'secondary'}
            onPress={() =>
              access.canUseAdvancedTraining()
                ? router.push('/practice/mistakes')
                : router.push({ pathname: '/paywall', params: { source: 'mistakes' } })
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="title" color={color}>
        {value}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <View style={[styles.badge, { borderColor: style.color }]}>
      <AppText variant="caption" color={style.color}>
        {style.label}
      </AppText>
    </View>
  );
}

function ToggleChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <AppText variant="smallStrong" color={active ? 'textInverse' : 'textSecondary'} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outcomes: { gap: 4 },
  outcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: SCREEN_GUTTER },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 56,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  content: { gap: spacing.lg, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  flex: { flex: 1 },
  summary: { marginHorizontal: SCREEN_GUTTER, gap: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resultBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
  },
  lesson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  locked: { alignItems: 'center', gap: spacing.md, borderColor: colors.primary },
  lockedIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  boardWrap: { alignItems: 'center' },
  detail: { marginHorizontal: SCREEN_GUTTER, gap: spacing.sm },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderWidth: 1.5, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 2 },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.success },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER },
  list: { paddingHorizontal: SCREEN_GUTTER, gap: spacing.xs },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  moveRowActive: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dice: { width: 34 },
});
