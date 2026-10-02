import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Stars';
import { isScored, type Lesson } from '@/curriculum';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { maxLessonXp, type LessonRecord, type LessonStatus } from '../progression';

interface LessonSheetProps {
  lesson: Lesson | null;
  status: LessonStatus;
  record?: LessonRecord;
  color: string;
  /** The lesson needs Premium (whether or not the learner has reached it yet). */
  requiresPremium?: boolean;
  /** A free first lesson of a premium course. */
  preview?: boolean;
  /** What to finish first when the lesson is locked. */
  blockedBy?: Lesson | null;
  onStart: (lesson: Lesson) => void;
  onUpgrade: () => void;
  onClose: () => void;
}

/** Details for a lesson node: what you'll learn, rewards and a start button. */
export function LessonSheet({
  lesson,
  status,
  record,
  color,
  requiresPremium = false,
  preview = false,
  blockedBy,
  onStart,
  onUpgrade,
  onClose,
}: LessonSheetProps) {
  const insets = useSafeAreaInsets();
  if (!lesson) return null;
  const exercises = lesson.steps.filter(isScored).length;
  const locked = status === 'locked' || requiresPremium;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close lesson details">
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              animationName: { from: { transform: [{ translateY: 120 }] }, to: { transform: [{ translateY: 0 }] } },
              animationDuration: 260,
            },
          ]}
        >
          <Pressable onPress={() => {}} style={styles.inner} testID="lesson-sheet">
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <View style={[styles.icon, { backgroundColor: locked ? colors.locked : color }]}>
                <Icon
                  name={requiresPremium ? 'crown' : locked ? 'lock' : lesson.icon}
                  size={26}
                  color={requiresPremium ? colors.star : locked ? 'textMuted' : 'textInverse'}
                />
              </View>
              <View style={styles.flex}>
                <AppText variant="title">{lesson.title}</AppText>
                <AppText variant="small" color="textSecondary">
                  {lesson.description}
                </AppText>
              </View>
            </View>

            <View style={styles.meta}>
              <Meta
                icon="lightning-bolt"
                color={colors.xp}
                text={record?.completed ? 'Replay for practice XP' : `Up to ${maxLessonXp(lesson)} XP`}
              />
              <Meta icon="puzzle-outline" color={colors.info} text={`${exercises} exercises`} />
              {record?.completed ? <Stars count={record.bestStars} size={18} /> : null}
            </View>

            <View style={styles.objectives}>
              <AppText variant="label" color="textSecondary">
                You’ll learn
              </AppText>
              {lesson.objectives.map((objective) => (
                <View key={objective.id} style={styles.objective}>
                  <Icon name="check-circle" size={18} color={record?.completed ? colors.success : colors.textMuted} />
                  <AppText variant="bodyStrong">{objective.text}</AppText>
                </View>
              ))}
              {lesson.passingScore > 0 ? (
                <AppText variant="small" color="textSecondary">
                  Pass with {Math.round(lesson.passingScore * 100)}% or more to unlock what comes next.
                </AppText>
              ) : null}
            </View>

            {preview && !record?.completed ? (
              <View style={styles.previewNote} testID="preview-note">
                <Icon name="gift-outline" size={18} color="primary" />
                <AppText variant="small" color="textSecondary" style={styles.flex}>
                  A free preview of a Premium course.
                </AppText>
              </View>
            ) : null}

            {requiresPremium ? (
              <>
                <View style={styles.lockedNote}>
                  <Icon name="crown" size={18} color={colors.star} />
                  <AppText variant="small" color="textSecondary" style={styles.flex}>
                    This lesson is part of Premium, with every advanced course.
                  </AppText>
                </View>
                <Button testID="unlock-premium" label="Unlock with Premium" icon="crown" onPress={onUpgrade} />
              </>
            ) : locked ? (
              <View style={styles.lockedNote}>
                <Icon name="lock" size={18} color="textSecondary" />
                <AppText variant="small" color="textSecondary" style={styles.flex}>
                  {blockedBy ? `Complete “${blockedBy.title}” to unlock this lesson.` : 'Keep going on your path to unlock this lesson.'}
                </AppText>
              </View>
            ) : (
              <Button
                testID="start-lesson"
                label={record?.completed ? 'Practice again' : 'Start lesson'}
                icon="play"
                onPress={() => onStart(lesson)}
              />
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Meta({ icon, color, text }: { icon: 'lightning-bolt' | 'puzzle-outline'; color: string; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={16} color={color} />
      <AppText variant="smallStrong" color="textSecondary">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  inner: { paddingHorizontal: SCREEN_GUTTER, paddingTop: spacing.sm, gap: spacing.lg },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  titleRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  objectives: { gap: spacing.sm },
  objective: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lockedNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
  },
});
