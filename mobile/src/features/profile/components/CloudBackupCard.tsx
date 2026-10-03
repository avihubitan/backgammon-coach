import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { ToggleRow } from '@/components/ui/Toggle';
import { analytics } from '@/services/analytics';
import { SyncApiError, syncService } from '@/services/sync';
import { useSyncStore } from '@/state/syncStore';
import { useToastStore } from '@/state/toastStore';
import { colors, fontFamilies, radii, SCREEN_GUTTER, spacing } from '@/theme';

function ago(iso: string | null, now = new Date()): string {
  if (!iso) return 'not yet';
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

const failure = (error: unknown) =>
  error instanceof SyncApiError ? error.message : 'Something went wrong. Please try again.';

/**
 * Optional cloud backup: anonymous (no email, no name), so progress survives a
 * new phone. Hidden entirely when the app has no backup server configured.
 */
export function CloudBackupCard() {
  const enabled = useSyncStore((state) => state.enabled);
  const status = useSyncStore((state) => state.status);
  const error = useSyncStore((state) => state.error);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const hasBackup = useSyncStore((state) => state.accountId !== null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!syncService.isConfigured()) return null;

  const toggle = async (on: boolean) => {
    if (!on) {
      syncService.disable();
      setCode(null);
      analytics.track('backup_disabled', {});
      return;
    }
    setBusy(true);
    analytics.track('backup_started', {});
    try {
      await syncService.enable();
      analytics.track('backup_completed', {});
    } catch (caught) {
      analytics.track('backup_failed', { action: 'enable', status: caught instanceof SyncApiError ? caught.status : null });
      useToastStore.getState().show({ icon: 'cloud-alert', title: 'Backup didn’t start', message: failure(caught) });
    } finally {
      setBusy(false);
    }
  };

  const deleteBackup = async () => {
    setConfirmDelete(false);
    setBusy(true);
    try {
      await syncService.deleteBackup();
      setCode(null);
      analytics.track('backup_deleted', {});
      useToastStore.getState().show({
        icon: 'cloud-off-outline',
        title: 'Backup deleted',
        message: 'Your progress on this phone is still here.',
      });
    } catch (caught) {
      analytics.track('backup_failed', { action: 'delete', status: caught instanceof SyncApiError ? caught.status : null });
      useToastStore.getState().show({ icon: 'cloud-alert', title: 'Backup not deleted', message: failure(caught) });
    } finally {
      setBusy(false);
    }
  };

  const statusLine =
    status === 'syncing' || busy
      ? 'Backing up…'
      : status === 'error'
        ? (error ?? 'Backup failed.')
        : `Backed up ${ago(lastSyncedAt)}`;

  return (
    <>
      <AppText variant="label" color="textSecondary">
        Cloud backup
      </AppText>
      <Card style={styles.card} testID="cloud-backup">
        <ToggleRow
          testID="backup-toggle"
          label="Back up my progress"
          description="Anonymous: no email or name. Only your learning progress is saved."
          value={enabled}
          onChange={(on) => void toggle(on)}
        />

        {!enabled && error ? (
          <AppText variant="small" color="textSecondary" testID="backup-note">
            {error}
          </AppText>
        ) : null}

        {enabled ? (
          <View style={styles.statusRow} testID="backup-status">
            <Icon
              name={status === 'error' ? 'cloud-alert' : status === 'syncing' || busy ? 'cloud-sync' : 'cloud-check'}
              size={20}
              color={status === 'error' ? colors.danger : colors.success}
            />
            <AppText variant="small" color={status === 'error' ? 'danger' : 'textSecondary'} style={styles.flex}>
              {statusLine}
            </AppText>
            <Button
              testID="backup-now"
              label="Back up now"
              size="medium"
              variant="ghost"
              fullWidth={false}
              onPress={() => void syncService.syncNow({ pull: true })}
            />
          </View>
        ) : null}

        {enabled ? (
          code ? (
            <View style={styles.codeBox} testID="backup-code">
              <AppText variant="caption" color="textSecondary">
                YOUR BACKUP CODE
              </AppText>
              <AppText variant="title" selectable style={styles.code}>
                {code}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Write it down. On a new phone, choose “Restore from a code” and enter it.
              </AppText>
            </View>
          ) : (
            <Button
              testID="backup-show-code"
              label="Show my backup code"
              icon="key-variant"
              variant="secondary"
              size="medium"
              onPress={async () => setCode(await syncService.revealCode())}
            />
          )
        ) : null}

        <Button
          testID="backup-restore"
          label="Restore from a code"
          icon="cloud-download-outline"
          variant="ghost"
          size="medium"
          onPress={() => setRestoring(true)}
        />

        {hasBackup ? (
          <Button
            testID="backup-delete"
            label="Delete my backup"
            icon="delete-outline"
            variant="ghost"
            size="medium"
            disabled={busy}
            onPress={() => setConfirmDelete(true)}
          />
        ) : null}

        <RestoreDialog visible={restoring} onClose={() => setRestoring(false)} />
        <ConfirmDialog
          visible={confirmDelete}
          title="Delete your backup?"
          message="Your backup and its code are deleted from our server. Progress on this phone stays. Other phones using this code stop backing up."
          confirmLabel="Delete backup"
          cancelLabel="Keep it"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteBackup()}
        />
      </Card>
    </>
  );
}

function RestoreDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const restore = async () => {
    setWorking(true);
    setProblem(null);
    analytics.track('backup_restore_started', {});
    try {
      await syncService.restore(value);
      analytics.track('backup_restore_completed', {});
      useToastStore.getState().show({
        icon: 'cloud-check',
        title: 'Progress restored',
        message: 'Your backup is merged with this device.',
      });
      setValue('');
      onClose();
    } catch (caught) {
      analytics.track('backup_failed', { action: 'restore', status: caught instanceof SyncApiError ? caught.status : null });
      setProblem(failure(caught));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Animated.View
          style={[
            styles.dialog,
            {
              animationName: { from: { opacity: 0, transform: [{ scale: 0.94 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
              animationDuration: 200,
            },
          ]}
        >
          <Pressable onPress={() => {}} style={styles.dialogInner} testID="restore-dialog">
            <Icon name="cloud-download-outline" size={36} color="primary" />
            <AppText variant="title" align="center">
              Restore your progress
            </AppText>
            <AppText variant="small" color="textSecondary" align="center">
              Enter the backup code from your other device. Your progress there and here is combined; nothing is lost.
            </AppText>
            <TextInput
              testID="restore-input"
              value={value}
              onChangeText={setValue}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            {problem ? (
              <AppText variant="small" color="danger" align="center" testID="restore-error">
                {problem}
              </AppText>
            ) : null}
            <Button
              testID="restore-submit"
              label={working ? 'Restoring…' : 'Restore'}
              icon="cloud-download-outline"
              disabled={working || value.trim().length < 8}
              onPress={() => void restore()}
            />
            <Button label="Cancel" variant="ghost" size="medium" onPress={onClose} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  codeBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: { letterSpacing: 1.5 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER },
  dialog: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogInner: { padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    letterSpacing: 1,
    textAlign: 'center',
    backgroundColor: colors.bgElevated,
  },
});
