#!/usr/bin/env node
/**
 * Checks a running API end to end, the way the app uses it, and cleans up
 * after itself (the test account is deleted at the end).
 *
 *   API_URL=https://api.example.com npm run smoke
 *
 * Expects MongoDB storage unless ALLOW_MEMORY=1 (local development).
 */
const base = (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '') + '/v1';
const allowMemory = process.env.ALLOW_MEMORY === '1';
let failures = 0;

async function call(method, path, { code, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (code) headers.Authorization = `Bearer ${code}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: keep null.
  }
  return { status: response.status, json };
}

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`);
  return ok;
}

const snapshot = (xp) => ({ schemaVersion: 1, createdAt: new Date().toISOString(), smokeTest: true, xp });

try {
  console.log(`Checking ${base}`);
  const health = await call('GET', '/health');
  check('health answers 200', health.status === 200, `got ${health.status}`);
  check('storage is MongoDB', allowMemory || health.json?.storage === 'mongo', `storage: ${health.json?.storage}`);

  const created = await call('POST', '/accounts');
  if (!check('creates an anonymous account', created.status === 201 && typeof created.json?.code === 'string', `got ${created.status}`)) {
    throw new Error('Cannot continue without an account.');
  }
  const { code, accountId } = created.json;

  const me = await call('GET', '/accounts/me', { code });
  check('the backup code identifies the account', me.status === 200 && me.json?.accountId === accountId);

  const empty = await call('GET', '/progress', { code });
  check('a new account has no progress yet', empty.status === 200 && empty.json?.revision === 0);

  const first = await call('PUT', '/progress', { code, body: { baseRevision: 0, snapshot: snapshot(10) } });
  check('stores a snapshot', first.status === 200 && first.json?.revision === 1, `got ${first.status}`);

  const stale = await call('PUT', '/progress', { code, body: { baseRevision: 0, snapshot: snapshot(20) } });
  check('refuses a stale upload with the stored copy', stale.status === 409 && stale.json?.snapshot?.xp === 10, `got ${stale.status}`);

  const stored = await call('GET', '/progress', { code });
  check('reads the snapshot back', stored.status === 200 && stored.json?.snapshot?.xp === 10);

  const wrong = await call('GET', '/progress', { code: 'AAAA-BBBB-CCCC-DDDD-EEEE' });
  check('refuses an unknown code', wrong.status === 401, `got ${wrong.status}`);

  const removed = await call('DELETE', '/accounts/me', { code });
  check('deletes the backup and the account', removed.status === 204, `got ${removed.status}`);

  const gone = await call('GET', '/progress', { code });
  check('the deleted code stops working', gone.status === 401, `got ${gone.status}`);
} catch (error) {
  failures += 1;
  console.log(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
