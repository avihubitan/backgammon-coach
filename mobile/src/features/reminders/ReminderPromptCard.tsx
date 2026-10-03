import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { reminderService } from '@/services/reminders';
import { useProgressStore } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';
import { colors, radii, spacing } from '@/theme';

import { formatTime, suggestedTime } from './reminderPlan';
import { NotificationsBlocked } from './ReminderSettings';

/**
 * Offered once, after the first lesson: a daily reminder at about the time the
 * player is learning now. Declining is one tap and it doesn't come back.
 */
export function ReminderPromptCard({ enterDelay }: { enterDelay?: number }) {
  const prompt = useSettingsStore((state) => state.reminderPrompt);
  const enabled = useSettingsStore((state) => state.reminders.enabled);
  const startedPath = useProgressStore((state) => Object.values(state.lessons).some((record) => record.completed));
  const [time] = useState(() => suggestedTime(new Date()));
  const [status, setStatus] = useState<'idle' | 'busy' | 'denied'>('idle');
  if (!reminderService.available || enabled || prompt !== 'unasked' || !startedPath) return null;

  const turnOn = async () => {
    setStatus('busy');
    const result = await reminderService.enable('home', time);
    if (result === 'enabled') {
      useToastStore.getState().show({
        icon: 'bell-check',
        title: 'Reminder set',
        message: `Every day at ${formatTime(time)}, unless you’ve already learned.`,
      });
      return;
    }
    setStatus(result === 'denied' ? 'denied' : 'idle');
  };

  return (
    <Card style={styles.card} enterDelay={enterDelay} testID="reminder-prompt">
      <View style={styles.top}>
        <View style={styles.icon}>
          <Icon name="bell-ring-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">Make it a daily habit</AppText>
          <AppText variant="small" color="textSecondary">
            A short reminder at {formatTime(time)} each day, and only if you haven’t learned yet.
          </AppText>
        </View>
      </View>
      {status === 'denied' ? (
        <>
          <NotificationsBlocked />
          <Button label="OK" variant="ghost" size="medium" onPress={() => reminderService.dismissPrompt()} />
        </>
      ) : (
        <View style={styles.actions}>
          <Button
            testID="reminder-accept"
            label={`Remind me at ${formatTime(time)}`}
            icon="bell-ring"
            size="medium"
            loading={status === 'busy'}
            onPress={() => void turnOn()}
          />
          <Button
            testID="reminder-dismiss"
            label="Not now"
            variant="ghost"
            size="medium"
            onPress={() => reminderService.dismissPrompt()}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  actions: { gap: spacing.xs },
});
