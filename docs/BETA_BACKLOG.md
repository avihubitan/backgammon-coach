# Beta backlog

Ideas and gaps noticed while preparing the device beta, deliberately not built yet: the beta is
for learning what testers need, not for adding features. Decide after the first week of feedback
([BETA.md](BETA.md)). Bugs don't go here: they're fixed when found.

## Data and devices

- **The phone's own backup doesn't include progress.** On iPhone, AsyncStorage marks its files
  "excluded from backup" by default, so iCloud backups (and restoring a new iPhone from one) skip
  lessons, streak and games. On Android, `expo-secure-store`'s backup rules (needed so a restored
  phone doesn't hold an unreadable backup code) only let small settings files into Google backup
  and phone-to-phone transfer. Today, in-app cloud backup is the only way to move progress to a new
  phone. Fix, if wanted: iOS, one Info.plist key (`RCTAsyncStorageExcludeFromBackup: false` under
  `ios.infoPlist` in `app.json`); Android, a small config plugin with rules that include
  AsyncStorage's database and still exclude SecureStore. Then check a restore on a second phone
  (`adb shell bmgr` on Android) and update [PRIVACY.md](PRIVACY.md) (progress would then be in the
  player's own backups).
- **Easier backup code transfer.** Moving to a new phone means typing 24 characters. A "Copy"
  button next to the code and a "Paste" button in the restore box would help; a QR code more so.
- **"Show my backup code" gives no feedback** if the phone's secure storage fails to read it
  (rare). A short message would be friendlier.
- **Resuming the computer's turn** replays its whole turn after the game was left mid-turn (the
  board jumps back a move or two). It could continue from where it stopped instead.
- **A failed save is silent.** If the phone refuses to store progress (out of space), the app
  carries on and reports it to Sentry; the player isn't told.

## Privacy

- **Show the install id** next to the version in Profile, so a player can ask for their usage data
  and crash reports to be deleted ([PRIVACY.md](PRIVACY.md), open decisions).
- **A consent question for the EU and UK** before analytics, if the legal review asks for it
  ([PRIVACY.md](PRIVACY.md)).

## Learning

- **Hide pip counts from beginners** until the pip-count lesson; the number means nothing before
  it.
- **"What you learned"**: a one-line summary of the lesson's idea on the lesson-complete screen.
- **Onboarding experiment** (start learning at once vs. one tiny game interaction first), only if
  the activation funnel shows many testers dropping before the first lesson ([BETA.md](BETA.md)).

## Operations

- **Automatic build checks in CI**: tests, typecheck, lint and the web smoke test on every push
  (they run by hand today).
- **Expire old backups** that haven't synced for a long time (for example 24 months), once a
  retention period is decided ([PRIVACY.md](PRIVACY.md)).
