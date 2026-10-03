import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { MoveStep } from '@/curriculum';
import { FeedbackPanel, type Feedback } from '@/features/lessons/components/FeedbackPanel';
import { MoveStepView } from '@/features/lessons/components/steps/MoveStepView';
import { analytics } from '@/services/analytics';
import { feedback as gameFeedback } from '@/services/feedback';
import { useProgressStore } from '@/state/progressStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { AttractBoard, DemoMoveBoard } from './AttractBoards';

const CHALLENGE: MoveStep = {
  id: 'onboarding-challenge',
  kind: 'move',
  prompt: 'You rolled a **5**. Tap your checker, then tap where it lands.',
  board: { position: { player1: { 13: 1 }, player2: { 19: 2 } }, dice: [5] },
  goal: { type: 'land-on', point: 8 },
  solution: '13/8',
  correct: 'You moved 5 spaces, from the 13-point to the 8-point. Your checkers always head toward your home board, bottom right.',
  wrong: 'Your checker moves toward your home board in the bottom right. Count 5 points from the 13-point.',
};

const ONBOARDING_XP = 10;

const PATH: { icon: IconName; label: string; color: string }[] = [
  { icon: 'checkerboard', label: 'Meet the board', color: '#62B6FF' },
  { icon: 'dice-multiple', label: 'Move checkers', color: '#3DD68C' },
  { icon: 'target', label: 'Hit and block', color: '#FF8A3D' },
  { icon: 'chess-rook', label: 'Build strategy', color: '#B98CFF' },
  { icon: 'trophy', label: 'Master the game', color: '#F3B847' },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Short phones (iPhone SE): tighter spacing so the whole path fits above the button.
  const compact = height < 740;
  const boardWidth = Math.min(width, MAX_CONTENT_WIDTH) - SCREEN_GUTTER * 2;
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'active' | 'correct' | 'wrong'>('active');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const completeOnboarding = useProgressStore((state) => state.completeOnboarding);
  const awardXp = useProgressStore((state) => state.awardXp);

  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    analytics.track('onboarding_started', {});
  }, []);

  const finish = () => {
    analytics.track('onboarding_completed', { skipped_intro: skipped, challenge_mistakes: mistakes });
    awardXp(ONBOARDING_XP);
    completeOnboarding();
    router.replace('/');
  };

  const intro = page < 3;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[styles.dot, index === page && styles.dotActive, index < page && styles.dotDone]} />
          ))}
        </View>
        {intro ? (
          <Button
            testID="onboarding-skip"
            label="Skip"
            variant="ghost"
            size="small"
            fullWidth={false}
            onPress={() => {
              setSkipped(true);
              setPage(3);
            }}
          />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {page === 0 ? (
          <Animated.View key="p0" style={[styles.page, fadeUp]}>
            <View style={styles.hero}>
              <AppText variant="label" color="primary">
                Backgammon Coach
              </AppText>
              <AppText variant="hero" align="center">
                Learn{'\n'}Backgammon
              </AppText>
              <AppText variant="callout" color="textSecondary" align="center">
                The 5,000-year-old game of luck and skill.
              </AppText>
            </View>
            <AttractBoard width={boardWidth} />
          </Animated.View>
        ) : null}

        {page === 1 ? (
          <Animated.View key="p1" style={[styles.page, compact && styles.pageCompact, fadeUp]}>
            <View style={styles.hero}>
              <AppText variant="display" align="center">
                Start from zero.{'\n'}Become a real player.
              </AppText>
              <AppText variant="callout" color="textSecondary" align="center">
                Short lessons build on each other, one idea at a time.
              </AppText>
            </View>
            <View style={[styles.path, compact && styles.pathCompact]}>
              {PATH.map((stop, index) => (
                <Animated.View key={stop.label} style={[styles.pathRow, compact && styles.pathRowCompact, riseIn(150 + index * 110)]}>
                  <View style={[styles.pathIcon, { backgroundColor: stop.color }]}>
                    <Icon name={stop.icon} size={22} color="textInverse" />
                  </View>
                  <AppText variant="bodyStrong">{stop.label}</AppText>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {page === 2 ? (
          <Animated.View key="p2" style={[styles.page, fadeUp]}>
            <View style={styles.hero}>
              <AppText variant="display" align="center">
                Interactive lessons.{'\n'}Real positions.{'\n'}Instant feedback.
              </AppText>
            </View>
            <DemoMoveBoard width={boardWidth} />
          </Animated.View>
        ) : null}

        {page === 3 ? (
          <Animated.View key="p3" style={[styles.challenge, fadeUp]}>
            <View style={styles.challengeTitle}>
              <AppText variant="label" color="primary">
                Your first move
              </AppText>
              <AppText variant="title">Let’s see what you know</AppText>
            </View>
            <MoveStepView
              key={attempt}
              step={CHALLENGE}
              boardWidth={Math.min(width, MAX_CONTENT_WIDTH)}
              status={status}
              mistakes={mistakes}
              onResult={(correct, message) => {
                if (!correct) setMistakes((value) => value + 1);
                setStatus(correct ? 'correct' : 'wrong');
                setFeedback({
                  tone: correct ? 'correct' : 'wrong',
                  title: correct ? 'You’re a natural!' : 'Not quite',
                  message,
                  xp: correct ? ONBOARDING_XP : undefined,
                });
                if (correct) gameFeedback.success();
                else gameFeedback.error();
              }}
            />
          </Animated.View>
        ) : null}
      </ScrollView>

      {intro ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button
            testID="onboarding-next"
            label={page === 0 ? 'Get started' : 'Continue'}
            onPress={() => setPage((value) => value + 1)}
          />
        </View>
      ) : feedback ? (
        <FeedbackPanel
          feedback={feedback}
          continueLabel={`Start learning · +${ONBOARDING_XP} XP`}
          onContinue={finish}
          onRetry={
            feedback.tone === 'wrong'
              ? () => {
                  setFeedback(null);
                  setStatus('active');
                  setAttempt((value) => value + 1);
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

const fadeUp = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: 24 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: 420,
  animationTimingFunction: 'ease-out' as const,
};

const riseIn = (delay: number) => ({
  animationName: {
    from: { opacity: 0, transform: [{ translateX: -16 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }] },
  },
  animationDuration: 360,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_GUTTER,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 24, backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.primaryShadow },
  content: { paddingBottom: 220, flexGrow: 1 },
  page: {
    flex: 1,
    gap: spacing.xxxl,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  pageCompact: { gap: spacing.xl, paddingTop: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.md },
  pathCompact: { gap: spacing.sm },
  pathRowCompact: { paddingVertical: spacing.sm },
  path: { gap: spacing.md, alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  challenge: { gap: spacing.lg, paddingTop: spacing.lg, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  challengeTitle: { paddingHorizontal: SCREEN_GUTTER, gap: spacing.xs },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
});
