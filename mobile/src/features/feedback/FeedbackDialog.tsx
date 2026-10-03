import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { analytics, canSendFeedback } from '@/services/analytics';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';
import { colors, fontFamilies, radii, SCREEN_GUTTER, spacing } from '@/theme';

import type { FeedbackRating } from './feedbackPolicy';

const MAX_LENGTH = 1000;

interface FeedbackDialogProps {
  visible: boolean;
  context: 'lesson' | 'game' | 'profile';
  rating?: FeedbackRating;
  /** Lesson id or computer level. */
  subject?: string;
  title: string;
  placeholder: string;
  onClose: () => void;
}

/** A short note to the team: sent with the anonymous usage data, never with personal details. */
export function FeedbackDialog({ visible, context, rating, subject, title, placeholder, onClose }: FeedbackDialogProps) {
  const [text, setText] = useState('');
  const usageData = useSettingsStore((state) => state.analytics);
  const canSend = canSendFeedback(usageData);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    analytics.track('feedback_submitted', { context, rating, subject, text: trimmed });
    useToastStore.getState().show({ icon: 'message-text-outline', title: 'Thanks!', message: 'Your feedback was sent.' });
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable style={styles.dialog} onPress={() => {}} testID="feedback-dialog">
            <View style={styles.icon}>
              <Icon name="message-text-outline" size={32} color="primary" />
            </View>
            <AppText variant="title" align="center">
              {title}
            </AppText>
            {canSend ? (
              <>
                <TextInput
                  testID="feedback-input"
                  value={text}
                  onChangeText={setText}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={MAX_LENGTH}
                  textAlignVertical="top"
                  style={styles.input}
                  autoFocus
                />
                <AppText variant="caption" color="textMuted" align="center">
                  Please don’t include your name, email or other personal details.
                </AppText>
                <Button testID="feedback-send" label="Send" icon="send" disabled={!text.trim()} onPress={send} />
              </>
            ) : (
              <AppText variant="body" color="textSecondary" align="center" testID="feedback-off">
                Feedback is sent with anonymous usage data, which is turned off. You can turn it on in Settings.
              </AppText>
            )}
            <Button label={canSend ? 'Cancel' : 'Close'} variant="ghost" size="medium" onPress={onClose} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  icon: { alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER },
  dialog: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    alignItems: 'stretch',
    padding: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 110,
    maxHeight: 200,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    backgroundColor: colors.bgElevated,
  },
});
