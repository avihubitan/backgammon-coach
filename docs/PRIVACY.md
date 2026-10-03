# Privacy: data inventory

A factual list of what the app collects, from the code as it is. It's the source for the privacy
policy, the App Store privacy labels and Google Play's data safety form. It is not legal advice and
doesn't claim compliance with any law: have it reviewed before the public launch.

The app works fully without an account. Nothing is collected about who the player is.

## What is collected

| Data | When | Why | Where it's kept | How long | Shared with | Identifies the person? | The player's control |
| ---- | ---- | --- | --------------- | -------- | ----------- | ---------------------- | -------------------- |
| Learning progress, XP, streak, games, mistakes, settings | Always | The app itself | On the phone (AsyncStorage) | Until reset or uninstall | Nobody (the phone's own iCloud/Google backup may include it) | No | Profile → Reset progress; uninstall |
| Backup code | When backup is turned on | Restoring on another phone | Phone's secure storage (Keychain/Keystore) | Until the backup is deleted (an iOS Keychain item can outlive uninstalling) | Nobody | No | Profile → Delete my backup |
| Progress snapshot | Backup on (opt-in) | Restore and keep phones in sync | Our API, in MongoDB (host and region to be chosen) | Until the player deletes it; no automatic expiry yet | Hosting and database providers, as processors | An anonymous account; the code is stored only as a hash | Profile → Delete my backup (deletes the snapshot and the account) |
| API request log lines | Each backup request | Running and debugging the API | The hosting platform's logs | The platform's log retention (to set) | Hosting provider | No: method, path, status and duration only. The platform's own edge logs may record IP addresses | – |
| Usage events (lesson completed, game finished, paywall viewed, …), see `mobile/src/services/analytics/events.ts` | "Share anonymous usage data" on (default on) | Deciding what to improve | PostHog (US or EU cloud, set by `EXPO_PUBLIC_POSTHOG_HOST`) | PostHog's retention for the plan (to set) | PostHog, as processor | Pseudonymous: a random install id. With each event PostHog also gets the app version, OS and version, screen size and device type; no device name, location lookup (GeoIP off), advertising id, name or email | The switch in Settings stops all new events; deleting past events needs a request to us |
| Feedback the player writes | When they send it | Beta feedback | PostHog, as an event | As above | PostHog | Same install id. The text is whatever they write; the form asks them not to include personal details | Not sending it |
| Crash and error reports | Usage data on, and the app crashes or a screen fails | Fixing crashes | Sentry (US or EU, per the DSN's organisation) | Sentry's retention for the plan (often 30–90 days) | Sentry, as processor | Pseudonymous: Sentry's random installation id. Reports include the stack trace, app version, device model, OS, and recent screens and taps; no IP address, user details, screenshots or device name (`sendDefaultPii` off, events scrubbed) | The same switch stops reports (remembered from the next start) |
| Performance timings | Usage data on: every session in preview builds, 1 in 5 in production | App start and screen load times | Sentry | As above | Sentry | As above | The same switch |
| Purchases | When the player buys or restores | Selling and restoring Premium | RevenueCat, Apple, Google | Per their policies | RevenueCat, as processor; the stores handle payment | RevenueCat gets an anonymous app user id and the store receipt; the store links it to the Apple ID or Google account, we don't | Manage in the store; RevenueCat can delete a customer on request |
| Notification permission and the reminder schedule | When reminders are turned on | Daily reminders | On the phone | Until turned off | Nobody | No | Profile → Daily reminder |

**Not collected:** name, email, phone number, contacts, precise or coarse location, photos,
microphone, advertising identifiers (no tracking, no App Tracking Transparency prompt), device name,
browsing history. No ads. No third-party sign-in.

**Permissions:** notifications only (asked when the player turns reminders on). Android also lists
internet, network state, vibration, audio settings, billing and starting reminders after a reboot;
none show a prompt.

## Third parties

| Service | Role | Configured by |
| ------- | ---- | ------------- |
| PostHog | Product analytics, feedback | `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` |
| Sentry | Crash reports, performance | `EXPO_PUBLIC_SENTRY_DSN` |
| RevenueCat | Subscriptions | `EXPO_PUBLIC_REVENUECAT_*_KEY` |
| Apple, Google | App distribution, payments | Store accounts |
| API hosting and MongoDB (to be chosen) | Cloud backup | `EXPO_PUBLIC_API_URL`, `MONGODB_URI` |

Recommended settings in those dashboards: PostHog "Discard client IP data" on; Sentry "Prevent
storing of IP addresses" on and data scrubbing on; data retention set to the shortest that still
covers the beta.

## Open decisions before the public launch

- **Consent:** usage data and crash reports are on by default, with a switch to turn them off. In
  the EU and UK, analytics identifiers stored on a device may need consent first (for example a
  question during onboarding). Decide with someone who knows the rules.
- **Retention:** set PostHog's and Sentry's retention, and decide what happens to backups that
  haven't synced for a long time (for example delete after 24 months).
- **Deleting analytics and crash data:** there's no self-service way yet. Requests need the install
  id, which the app doesn't show; consider showing it next to the version in Profile.
- **Children:** the app isn't aimed at children. Set the age ratings accordingly; if it could be
  marketed to under-13s, COPPA and similar rules change what may be collected.
- **Privacy policy:** host one (the draft below) and set `EXPO_PUBLIC_PRIVACY_URL`; add a contact
  email.

## Store answers (drafts to check against the table)

- **App Store privacy labels:** Data Not Linked to You: Usage Data (Product Interaction),
  Diagnostics (Crash Data, Performance Data), Purchases (Purchase History), User Content (Other User
  Content: backup and feedback), Identifiers (User ID: the random install id). Used for tracking:
  none. Whether a random install id counts as "linked" is a judgment call; when unsure, the stricter
  answer is the safe one.
- **Google Play data safety:** collected: App activity (app interactions; other user-generated
  content for feedback), App info and performance (crash logs, diagnostics), Financial info
  (purchase history), Device or other IDs (the random install id); backup data as "Other app data"
  (optional). Encrypted in transit: yes. Deletion: backups in the app; other data on request. Shared
  for advertising: no.

## Privacy policy (plain-language draft)

> **Backgammon Coach privacy policy (draft)**
>
> Backgammon Coach teaches backgammon. You don't need an account, and we don't ask who you are.
>
> **On your phone.** Your lessons, games, streak and settings are stored on your phone. Uninstalling
> the app or using "Reset progress" removes them.
>
> **Usage data and crash reports.** To improve the app we collect anonymous usage events (for
> example "lesson completed") through PostHog, and crash reports through Sentry. They carry a random
> id created on your phone, the app version and your phone's model and system version, never your
> name, email, contacts or location. You can turn this off any time in Profile → Settings → "Share
> anonymous usage data".
>
> **Feedback.** If you send feedback, we receive what you write with the same random id. Please
> don't include personal details.
>
> **Cloud backup (optional).** If you turn on backup, your learning progress is stored on our
> server under an anonymous account. Your backup code is the only key to it; we store only a
> scrambled (hashed) version. "Delete my backup" removes it from our server.
>
> **Purchases.** Subscriptions are handled by Apple or Google and by RevenueCat, which tells the app
> whether you have Premium. We don't see your payment details.
>
> **We don't sell your data, show ads or track you across apps.**
>
> **Contact:** [email address]. To delete usage data or crash reports, write to us.
>
> Last updated: [date].
