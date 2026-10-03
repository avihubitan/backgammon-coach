#!/usr/bin/env node
/**
 * Checks a build's environment variables before building: keys of the right
 * kind, https addresses, nothing secret in EXPO_PUBLIC_ variables (those are
 * bundled into the app, where anyone can read them). It never prints a value,
 * only the variable and what's wrong.
 *
 *   npm run check:env -- --profile preview
 *
 * Locally it reads the shell and the .env files, as Expo does; to check what
 * EAS will use, first `eas env:pull --environment preview`. On EAS Build it
 * runs after install for the build's profile: errors stop the build (a
 * production build with a Test Store key, a secret in a public variable, an
 * http address phones would block), warnings only print.
 */
const path = require('path');

const PROFILES = ['development', 'preview', 'production'];

/** Public values that are really secrets: never ship them inside the app. */
const SECRETS = [
  [/^sk_/, 'a RevenueCat secret key'],
  [/^sntry[su]_/, 'a Sentry auth token'],
  [/^phx_/, 'a PostHog personal API key'],
  [/mongodb(\+srv)?:\/\//i, 'a database connection string'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY/, 'a private key'],
];

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * The problems with `env` for a build profile, as { level, name, message }:
 * 'error' (the build would be wrong), 'warning' (works, with something
 * missing) or 'note'. `platform` (ios or android) skips the other platform's
 * missing key.
 */
function checkEnv(env, profile, platform) {
  const results = [];
  const add = (level, name, message) => results.push({ level, name, message });
  const value = (name) => (env[name] ?? '').trim();
  const release = profile !== 'development';
  const production = profile === 'production';

  const variant = value('EXPO_PUBLIC_APP_VARIANT');
  if (variant && variant !== profile) {
    add('error', 'EXPO_PUBLIC_APP_VARIANT', `is "${variant}" but this is a ${profile} build; eas.json sets it per profile.`);
  }

  for (const [name, raw] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || !raw) continue;
    const secret = SECRETS.find(([pattern]) => pattern.test(raw.trim()));
    if (secret) {
      add('error', name, `looks like ${secret[1]}. EXPO_PUBLIC_ values are readable inside the app: use the public key, and keep secrets as EAS secrets without the EXPO_PUBLIC_ prefix.`);
    }
  }

  // RevenueCat public SDK keys.
  for (const [name, prefix, store, other, keyPlatform] of [
    ['EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'appl_', 'App Store', 'goog_', 'ios'],
    ['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_', 'Google Play', 'appl_', 'android'],
  ]) {
    const key = value(name);
    if (!key) {
      if (release && (!platform || platform === keyPlatform)) {
        add('warning', name, 'not set: this platform shows "Premium isn’t on sale in this version yet".');
      }
      continue;
    }
    if (key.startsWith('sk_')) continue; // already reported as a secret
    if (key.startsWith(other)) add('error', name, `is the other platform’s key (${other}…); this one needs the ${store} key (${prefix}…).`);
    else if (key.startsWith('test_')) {
      if (production) add('error', name, 'is a Test Store key, which production builds ignore: Premium would show "not on sale". Use the ' + store + ` key (${prefix}…).`);
      else add('note', name, 'is a Test Store key: purchases are simulated by RevenueCat, not the real store.');
    } else if (!key.startsWith(prefix)) {
      add('warning', name, `doesn’t start with ${prefix}: check it’s the ${store} public SDK key from RevenueCat (Project settings → API keys).`);
    }
  }

  // Sentry.
  const dsn = value('EXPO_PUBLIC_SENTRY_DSN');
  if (!dsn) {
    if (release) add('warning', 'EXPO_PUBLIC_SENTRY_DSN', 'not set: crashes from this build aren’t reported.');
  } else {
    const url = parseUrl(dsn);
    if (!url || !url.username || !/^\/\d+$/.test(url.pathname)) {
      add('error', 'EXPO_PUBLIC_SENTRY_DSN', 'isn’t a Sentry DSN (https://<key>@<host>/<project id>, from Project settings → Client Keys).');
    } else if (url.protocol !== 'https:') {
      add('warning', 'EXPO_PUBLIC_SENTRY_DSN', 'isn’t https.');
    }
  }
  if (value('SENTRY_AUTH_TOKEN')) {
    for (const name of ['SENTRY_ORG', 'SENTRY_PROJECT']) {
      if (!value(name)) add('error', name, 'not set, but SENTRY_AUTH_TOKEN is: the source map upload would fail the build.');
    }
  } else if (release && dsn) {
    add('warning', 'SENTRY_AUTH_TOKEN', 'not set: crash reports will show minified code instead of file names and lines.');
  }

  // PostHog.
  const posthogKey = value('EXPO_PUBLIC_POSTHOG_KEY');
  const posthogHost = value('EXPO_PUBLIC_POSTHOG_HOST');
  if (!posthogKey) {
    if (release) add('warning', 'EXPO_PUBLIC_POSTHOG_KEY', 'not set: no usage data, and in-app feedback is turned off.');
  } else if (!posthogKey.startsWith('phc_') && !SECRETS.some(([pattern]) => pattern.test(posthogKey))) {
    add('warning', 'EXPO_PUBLIC_POSTHOG_KEY', 'doesn’t start with phc_: check it’s the project API key (Project settings → Project API key).');
  }
  if (posthogHost) {
    const url = parseUrl(posthogHost);
    if (!url || url.protocol !== 'https:') add('error', 'EXPO_PUBLIC_POSTHOG_HOST', 'must be an https address, such as https://eu.i.posthog.com.');
  } else if (posthogKey) {
    add('note', 'EXPO_PUBLIC_POSTHOG_HOST', 'not set: events go to PostHog’s US cloud. Set https://eu.i.posthog.com for an EU project.');
  }

  // Cloud backup API.
  const api = value('EXPO_PUBLIC_API_URL');
  if (!api) {
    add('note', 'EXPO_PUBLIC_API_URL', 'not set: cloud backup is hidden in the app.');
  } else {
    const url = parseUrl(api);
    if (!url || !/^https?:$/.test(url.protocol)) add('error', 'EXPO_PUBLIC_API_URL', 'isn’t a web address.');
    else if (url.protocol === 'http:' && !(profile === 'development' && LOCAL_HOST.test(url.hostname))) {
      add('error', 'EXPO_PUBLIC_API_URL', 'is plain http: iPhones and Android phones block it in release builds. Use https.');
    }
  }

  // Links the stores require next to a subscription offer.
  for (const [name, missing] of [
    ['EXPO_PUBLIC_PRIVACY_URL', production ? 'warning' : 'note'],
    ['EXPO_PUBLIC_TERMS_URL', 'note'],
  ]) {
    const link = value(name);
    if (!link) {
      if (release) {
        add(missing, name, name === 'EXPO_PUBLIC_PRIVACY_URL'
          ? 'not set: no privacy policy link in the app; App Review expects one next to a subscription.'
          : 'not set: iOS links Apple’s standard Terms of Use; Android shows no terms link.');
      }
    } else if (parseUrl(link)?.protocol !== 'https:') {
      add('error', name, 'must be an https address; the app ignores anything else.');
    }
  }

  if (value('EXPO_PUBLIC_STORE') && release) {
    add('note', 'EXPO_PUBLIC_STORE', 'only applies to development builds; ignored here.');
  }
  return results;
}

function loadEnvFiles(root) {
  try {
    // Expo's own loader: the shell wins over .env, .env.local and the rest.
    require('@expo/env').loadProjectEnv(root, { silent: true });
  } catch {
    // Without it, only the shell's variables are checked.
  }
}

function main(argv, env) {
  const flag = argv.indexOf('--profile');
  const profile = flag >= 0 ? argv[flag + 1] : env.EAS_BUILD_PROFILE;
  if (!profile) {
    console.error('Usage: npm run check:env -- --profile <development|preview|production>');
    return 2;
  }
  if (!env.EAS_BUILD) loadEnvFiles(path.join(__dirname, '..'));
  // A custom profile is checked as the variant eas.json gives it (preview when it has none).
  const variant = (env.EXPO_PUBLIC_APP_VARIANT ?? '').trim();
  const kind = PROFILES.includes(profile) ? profile : PROFILES.includes(variant) ? variant : 'preview';
  const results = checkEnv(env, kind, env.EAS_BUILD_PLATFORM);
  const marks = { error: '✗', warning: '!', note: '·' };
  console.log(`Build environment for the ${profile} profile${kind === profile ? '' : ` (checked as ${kind})`}:`);
  for (const level of ['error', 'warning', 'note']) {
    for (const result of results.filter((candidate) => candidate.level === level)) {
      console.log(`  ${marks[level]} ${result.name} ${result.message}`);
    }
  }
  const errors = results.filter((result) => result.level === 'error').length;
  const warnings = results.filter((result) => result.level === 'warning').length;
  console.log(errors || warnings ? `${errors} error(s), ${warnings} warning(s).` : 'Looks right.');
  return errors > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2), process.env));

module.exports = { checkEnv, main };
