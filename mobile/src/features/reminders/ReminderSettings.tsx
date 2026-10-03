import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ToggleRow } from '@/components/ui/Toggle';
import { buildInfo } from '@/services/buildInfo';
import { haptics } from '@/services/haptics';
import { reminderService } from '@/services/reminders';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';
import { colors, radii, spacing } from '@/theme';

import { formatTime, REMINDER_PRESETS, sameTime } from './reminderPlan';

/** The daily reminder switch and its time, at the top of the settings card. */
export function ReminderSettings() {
  const reminders = useSettingsStore((state) => state.reminders);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!reminderService.available) return null;

  // A time chosen elsewhere (Home suggests one) is offered alongside the presets.
  const times = REMINDER_PRESETS.some((preset) => sameTime(preset, reminders))
    ? REMINDER_PRESETS
    : [...REMINDER_PRESETS, { hour: reminders.hour, minute: reminders.minute }].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      );

  const toggle = async (on: boolean) => {
    if (!on) {
      reminderService.disable();
      setBlocked(false);
      return;
    }
    if (busy) return;
    setBusy(true);
    const result = await reminderService.enable('settings');
    setBusy(false);
    setBlocked(result === 'denied');
  };

  return (
    <View testID="reminder-settings">
      <ToggleRow
        testID="setting-reminders"
        label="Daily reminder"
        description={
          reminders.enabled
            ? `Every day at ${formatTime(reminders)}, unless you’ve already learned that day.`
            : 'A nudge at the time you choose, so your streak doesn’t slip.'
        }
        value={reminders.enabled}
        onChange={(on) => void toggle(on)}
      />
      {reminders.enabled ? (
        <View style={styles.times} accessibilityRole="radiogroup" accessibilityLabel="Reminder time">
          {times.map((time) => {
            const selected = sameTime(time, reminders);
            const label = formatTime(time);
            return (
              <Pressable
                key={label}
                testID={`reminder-time-${time.hour}-${time.minute}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => {
                  haptics.tap();
                  reminderService.setTime(time);
                }}
                style={[styles.time, selected && styles.timeSelected]}
              >
                <AppText variant="smallStrong" color={selected ? 'textInverse' : 'text'}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {reminders.enabled && buildInfo.variant !== 'production' ? (
        <Button
          testID="reminder-test"
          label="Send a test reminder"
          icon="bell-ring-outline"
          variant="ghost"
          size="small"
          fullWidth={false}
          style={styles.test}
          onPress={async () => {
            const result = await reminderService.sendTest();
            if (result === 'denied') setBlocked(true);
            else
              useToastStore.getState().show({
                icon: 'bell-ring-outline',
                title: 'Test reminder on its way',
                message: 'It arrives in a few seconds, even with the app open.',
              });
          }}
        />
      ) : null}
      {blocked ? <NotificationsBlocked /> : null}
      <View style={styles.divider} />
    </View>
  );
}

/** When the system won't let us ask: say where to turn notifications on. */
export function NotificationsBlocked() {
  return (
    <View style={styles.blocked} testID="reminders-blocked">
      <AppText variant="small" color="textSecondary">
        Notifications are turned off for Backgammon Coach. You can turn them on in your phone’s settings.
      </AppText>
      {Platform.OS !== 'web' ? (
        <Button
          label="Open settings"
          variant="secondary"
          size="small"
          fullWidth={false}
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingBottom: spacing.md },
  time: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  timeSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  blocked: { gap: spacing.sm, paddingBottom: spacing.md, alignItems: 'flex-start' },
  test: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border },
});
