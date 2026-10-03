/**
 * Every analytics event the app sends, with its properties. Properties are
 * flat primitives and never contain personal data: no names, emails, free
 * text or device identifiers, only an anonymous install id. (The one
 * exception is feedback the player writes and chooses to send.)
 *
 * docs/BETA.md maps these events to the beta's questions and metrics.
 */
export interface AnalyticsEvents {
  /**
   * A session starts: a cold start, or coming back after 30 minutes away.
   * Day 1/3/7 retention and sessions per week are counted from this.
   */
  app_opened: {
    first_open: boolean;
    cold: boolean;
    /** Cold starts only: from the JavaScript entry to the first screen being ready. */
    startup_ms?: number;
  };
  /** A screen failed to render (only the error's type is sent). */
  app_error: { name: string };

  onboarding_started: Record<string, never>;
  onboarding_completed: { skipped_intro: boolean; challenge_mistakes: number };

  lesson_started: { lesson_id: string; section_id: string; replay: boolean; source?: LaunchSource };
  lesson_completed: {
    lesson_id: string;
    section_id: string;
    stars: number;
    /** lesson_accuracy: 0..1 */
    accuracy: number;
    /** lesson_completion_time */
    duration_ms: number;
    xp: number;
    replay: boolean;
    /** Wrong answers before passing (retry_count). */
    retry_count: number;
    source?: LaunchSource;
  };
  lesson_failed: { lesson_id: string; section_id: string; accuracy: number; duration_ms: number; retry_count: number };
  lesson_exited: { lesson_id: string; step_index: number; steps: number };
  section_unlocked: { section_id: string };

  exercise_completed: {
    session: 'lesson' | 'practice';
    session_id: string;
    step_id: string;
    step_kind: string;
    first_try: boolean;
    retry_count: number;
    revealed: boolean;
  };
  exercise_failed: {
    session: 'lesson' | 'practice';
    session_id: string;
    step_id: string;
    step_kind: string;
    retry_count: number;
    /** What kind of mistake the coach recognised, when it did. */
    mistake_category?: string;
  };

  streak_freeze_earned: { streak: number };
  streak_freeze_used: { freezes: number; streak: number };

  practice_session_completed: { kind: string; steps: number; first_try: number; xp: number; source?: LaunchSource };
  /** One of the player's own mistakes, practised (fixed: found the move first time). */
  mistake_practiced: { fixed: boolean };
  daily_challenge_started: { challenge_id: string };
  daily_challenge_completed: { challenge_id: string; xp: number };

  /** Home's "Coach's pick" opened: what the coach suggested. */
  coach_pick_opened: { kind: 'lesson' | 'drill' | 'mistakes'; topic: string; done_today: boolean };
  /** The lesson or practice the pick opened was finished. */
  coach_pick_completed: { kind: 'lesson' | 'drill' | 'mistakes' };

  game_started: { mode: 'ai'; level: string; match_length: number };
  game_completed: {
    mode: 'ai';
    level: string;
    won: boolean;
    result: string;
    points: number;
    turns: number;
    /** game_duration: from the first roll to the end, in seconds. */
    duration_s: number;
    /** coach_usage in this game. */
    hints_used: number;
    coach_watch_shown: number;
  };
  /** The coach reviewed a finished game (in the background or when opened). */
  game_reviewed: { level: string; won: boolean; move_quality: number | null; mistakes: number; blunders: number };
  coach_review_opened: { source: 'game_result' | 'history'; mistakes: number };
  game_hint_used: { level: string; hints_used: number; premium: boolean };
  coach_watch_triggered: { level: string; severity: 'mistake' | 'blunder'; premium: boolean };
  /** "Try again" or "Show me" after Coach Watch. */
  coach_watch_accepted: { choice: 'show' | 'retry' };
  /** "Play anyway". */
  coach_watch_ignored: Record<string, never>;

  paywall_viewed: { source: string };
  purchase_started: { product_id: string };
  purchase_completed: { product_id: string };
  purchase_failed: { product_id: string; reason: string };
  purchase_restore_started: Record<string, never>;
  purchase_restore_completed: { restored: boolean; failed: boolean };
  subscription_started: { product_id: string; period: string; trial: boolean };
  subscription_cancelled: { product_id: string };

  backup_started: Record<string, never>;
  backup_completed: Record<string, never>;
  backup_restore_started: Record<string, never>;
  backup_restore_completed: Record<string, never>;
  backup_disabled: Record<string, never>;
  backup_deleted: Record<string, never>;
  backup_failed: { action: 'enable' | 'restore' | 'sync' | 'delete'; status: number | null };

  board_style_selected: { style: string };

  notification_enabled: { hour: number; minute: number; source: 'home' | 'settings' };
  notification_disabled: Record<string, never>;
  notification_permission_denied: { source: 'home' | 'settings' };
  notification_prompt_dismissed: Record<string, never>;
  /** The player opened the app from a reminder. */
  notification_opened: { kind: string };

  /** Beta feedback: "How was this?" after a lesson or a game. */
  feedback_rated: { context: 'lesson' | 'game'; rating: 'good' | 'okay' | 'bad'; subject?: string };
  /** Beta feedback the player wrote (after a rating, or from Profile). */
  feedback_submitted: {
    context: 'lesson' | 'game' | 'profile';
    rating?: 'good' | 'okay' | 'bad';
    /** Lesson id or computer level, for context. */
    subject?: string;
    /** What the player chose to write (they're asked not to include personal details). */
    text: string;
  };
}

/** Where a lesson or practice session was opened from. */
export type LaunchSource = 'coach_pick' | 'daily_challenge' | 'path' | 'practice' | 'review';

export type AnalyticsEventName = keyof AnalyticsEvents;
