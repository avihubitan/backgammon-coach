/** Runtime settings, read from the environment once at startup. */
export interface AppConfig {
  port: number;
  /** MongoDB connection string; without one, data lives in memory (development and tests). */
  mongoUri: string | null;
  mongoDb: string;
  /** Browser origins allowed to call the API (the web build). Native apps don't send an Origin. */
  corsOrigins: string[];
  /** Largest request body accepted, e.g. '512kb'. A progress snapshot is a few kilobytes. */
  bodyLimit: string;
  /** Requests per minute per client, and new accounts per minute per client. */
  rateLimit: { perMinute: number; newAccountsPerMinute: number };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    port: number(env.PORT, 3000),
    mongoUri: env.MONGODB_URI?.trim() || null,
    mongoDb: env.MONGODB_DB?.trim() || 'backgammon_coach',
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    bodyLimit: env.BODY_LIMIT?.trim() || '512kb',
    rateLimit: {
      perMinute: number(env.RATE_LIMIT_PER_MINUTE, 120),
      newAccountsPerMinute: number(env.NEW_ACCOUNTS_PER_MINUTE, 5),
    },
  };
}
