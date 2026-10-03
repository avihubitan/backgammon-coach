# Development status

Short and current, so work can resume quickly. Update it when a milestone moves.

## Milestone: production beta (20–50 testers for several days)

### Done for the beta
- Build profiles in `mobile/eas.json` (development client, internal preview, production) and `expo-dev-client`.
- `app.json`: iPad full screen (portrait-only iPad apps must opt out of multitasking), no export-compliance
  prompt (HTTPS only), Android storage/microphone permissions blocked, notification icon and colour.
- Unused native packages removed (expo-image, expo-device, expo-linear-gradient, expo-web-browser).
- A crash screen (root `ErrorBoundary`) instead of a blank screen; reports only the error type.
- Saved data is checked when loaded (`src/state/sanitize.ts`): a damaged field falls back to its
  default and the rest of the player's progress is kept.
- Full games open after "Meet the Board" (`playAccess`: locked / early / open) instead of after 21 lessons.
- Production store: RevenueCat behind `SubscriptionService` (`services/purchases/revenueCatProvider.ts`),
  chosen when the build has `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`. Follows renewals/expiry,
  restore reports failed vs nothing-to-restore, cached Premium is trusted offline for 3 days past its end.

### In progress
- (see the task list below)

### Next
1. Product/UX audit at phone sizes; fix the top issues (Play gate done).
2. Coach Watch (a gentle check before confirming a clear mistake).
3. Release checklist, privacy model and the physical-device test list (`docs/RELEASE_CHECKLIST.md`).

### Known blockers outside the code
- EAS project: run `eas init` with the team's Expo account (adds `extra.eas.projectId`).
- Store accounts: App Store Connect and Play Console apps, subscription products, RevenueCat project and keys.
- Backend hosting with a real MongoDB (the in-memory store is for development and tests only).
- An analytics provider (events are typed and sent to a no-op provider in release builds).
- Nothing has been verified on a physical device yet.
