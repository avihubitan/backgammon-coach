/**
 * Every analytics event the app sends, with its properties. Properties are
 * flat primitives and never contain personal data: no names, emails,
 * free text or device identifiers, only an anonymous install id.
 */
export interface AnalyticsEvents {
  app_opened: { first_open: boolean };

  onboarding_started: Record<string, never>;
  onboarding_completed: { skipped_intro: boolean; challenge_mistakes: number };

  lesson_started: { lesson_id: string; section_id: string; replay: boolean };
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

  practice_session_completed: { kind: string; steps: number; first_try: number; xp: number };
  daily_challenge_completed: { challenge_id: string; xp: number };

  game_started: { mode: 'ai'; level: string; match_length: number };
  game_completed: { mode: 'ai'; level: string; won: boolean; result: string; points: number; turns: number };
  ai_game_started: { level: string; match_length: number };
  ai_game_completed: { level: string; won: boolean; result: string; points: number };
  coach_opened: { source: 'game_result' | 'history'; mistakes: number };

  paywall_viewed: { source: string };
  purchase_started: { product_id: string };
  purchase_completed: { product_id: string };
  purchase_failed: { product_id: string; reason: string };
  purchases_restored: { restored: boolean };
  subscription_started: { product_id: string; period: string; trial: boolean };
  subscription_cancelled: { product_id: string };

  backup_enabled: { restored: boolean };
  backup_disabled: Record<string, never>;
  backup_failed: { action: 'enable' | 'restore' | 'sync'; status: number | null };

  board_style_selected: { style: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
