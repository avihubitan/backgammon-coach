import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { createApp } from '../src/app.factory';
import { loadConfig, type AppConfig } from '../src/config';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  ...loadConfig({}),
  rateLimit: { perMinute: 1000, newAccountsPerMinute: 100 },
  ...overrides,
});

const snapshot = (xp: number) => ({ schemaVersion: 1, createdAt: '2026-10-03T10:00:00.000Z', progress: { xp } });

describe('Backgammon Coach API', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp(config());
    await app.init();
  });
  afterAll(async () => app.close());

  const newAccount = async () => {
    const response = await http().post('/v1/accounts').expect(201);
    return response.body as { accountId: string; code: string };
  };

  it('reports health and the storage in use', async () => {
    await http().get('/v1/health').expect(200, { status: 'ok', storage: 'memory' });
  });

  it('creates anonymous accounts with a readable backup code', async () => {
    const account = await newAccount();
    expect(account.accountId).toMatch(/^[0-9a-f-]{36}$/);
    expect(account.code).toMatch(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/);
    const me = await http().get('/v1/accounts/me').set('Authorization', `Bearer ${account.code}`).expect(200);
    expect(me.body.accountId).toBe(account.accountId);
  });

  it('accepts the code the way people type it', async () => {
    const account = await newAccount();
    const typed = account.code.toLowerCase().replace(/-/g, ' ');
    await http().get('/v1/accounts/me').set('Authorization', `Bearer ${typed}`).expect(200);
  });

  it('rejects missing, malformed and unknown codes', async () => {
    await http().get('/v1/progress').expect(401);
    await http().get('/v1/progress').set('Authorization', 'Bearer nope').expect(401);
    await http().get('/v1/progress').set('Authorization', 'Bearer 0000-0000-0000-0000-0000').expect(401);
  });

  it('stores a snapshot, then refuses a stale upload with the stored copy', async () => {
    const { code } = await newAccount();
    const auth = { Authorization: `Bearer ${code}` };
    await http().get('/v1/progress').set(auth).expect(200, { revision: 0, updatedAt: null, snapshot: null });

    const first = await http().put('/v1/progress').set(auth).send({ baseRevision: 0, snapshot: snapshot(10) }).expect(200);
    expect(first.body.revision).toBe(1);

    // A second device that never saw revision 1 must merge first.
    const stale = await http().put('/v1/progress').set(auth).send({ baseRevision: 0, snapshot: snapshot(99) }).expect(409);
    expect(stale.body).toMatchObject({ revision: 1, snapshot: snapshot(10) });

    const merged = await http().put('/v1/progress').set(auth).send({ baseRevision: 1, snapshot: snapshot(99) }).expect(200);
    expect(merged.body.revision).toBe(2);
    const stored = await http().get('/v1/progress').set(auth).expect(200);
    expect(stored.body).toMatchObject({ revision: 2, snapshot: snapshot(99) });
  });

  it('keeps accounts apart', async () => {
    const a = await newAccount();
    const b = await newAccount();
    await http().put('/v1/progress').set('Authorization', `Bearer ${a.code}`).send({ baseRevision: 0, snapshot: snapshot(5) }).expect(200);
    const other = await http().get('/v1/progress').set('Authorization', `Bearer ${b.code}`).expect(200);
    expect(other.body.snapshot).toBeNull();
  });

  it('validates uploads', async () => {
    const { code } = await newAccount();
    const auth = { Authorization: `Bearer ${code}` };
    const bad = [
      {},
      { baseRevision: -1, snapshot: snapshot(1) },
      { baseRevision: 0.5, snapshot: snapshot(1) },
      { baseRevision: 0, snapshot: 'nope' },
      { baseRevision: 0, snapshot: { progress: {} } },
    ];
    for (const body of bad) {
      const response = await http().put('/v1/progress').set(auth).send(body).expect(400);
      expect(response.body.issues.length).toBeGreaterThan(0);
    }
  });

  it('refuses oversized uploads', async () => {
    const { code } = await newAccount();
    const huge = { ...snapshot(1), padding: 'x'.repeat(600 * 1024) };
    await http().put('/v1/progress').set('Authorization', `Bearer ${code}`).send({ baseRevision: 0, snapshot: huge }).expect(413);
  });
});

describe('rate limits', () => {
  it('limits how fast new accounts can be created', async () => {
    const app = await createApp(config({ rateLimit: { perMinute: 1000, newAccountsPerMinute: 2 } }));
    await app.init();
    const http = request(app.getHttpServer());
    await http.post('/v1/accounts').expect(201);
    await http.post('/v1/accounts').expect(201);
    await http.post('/v1/accounts').expect(429);
    // Other routes keep their own, more generous budget.
    await http.get('/v1/health').expect(200);
    await app.close();
  });
});
